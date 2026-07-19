import bcrypt from 'bcryptjs';
import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { createAccessToken, generateOtp, normalizeEmail } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser, writeUsers } from '$lib/server/db';
import { buildTwoFactorEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async (event) => {
	try {
		await seedDatabase();
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		const password = typeof body.password === 'string' ? body.password : '';
		const rememberMe = Boolean(body.rememberMe);

		if (!email || !password) return json({ error: 'Email and password are required' }, { status: 400 });

		const users = await readUsers();
		const userIndex = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (userIndex === -1) {
			await logActivity(event, 'unknown', email, 'login', 'failed', 'User not found');
			return json({ error: 'Invalid email or password' }, { status: 401 });
		}

		const user = users[userIndex];
		if (!(await bcrypt.compare(password, user.passwordHash))) {
			await logActivity(event, user.id, user.email, 'login', 'failed', 'Incorrect password entered');
			return json({ error: 'Invalid email or password' }, { status: 401 });
		}

		if (!user.isVerified) {
			return json({ error: 'Please verify your email before logging in.' }, { status: 403 });
		}

		if (user.twoFactorEnabled) {
			const code = generateOtp();
			user.twoFactorCode = code;
			user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;
			users[userIndex] = user;
			await writeUsers(users);
			await logActivity(event, user.id, user.email, 'two_factor_toggle', 'success', 'Two-factor challenge initiated during login');
			await sendEmail(buildTwoFactorEmail(user.email, user.name, code));

			return json({
				mfaRequired: true,
				email: user.email,
				smtpConfigured: hasSmtpConfig(),
				message: 'Two-factor verification required'
			});
		}

		const token = createAccessToken(user, rememberMe);
		await logActivity(event, user.id, user.email, 'login', 'success', `Logged in successfully (rememberMe: ${rememberMe})`);
		return json({ message: 'Login successful', token, user: toSafeUser(user) });
	} catch (error) {
		console.error('Login failed:', error);
		return json({ error: error instanceof Error ? error.message : 'Server error during login' }, { status: 500 });
	}
};
