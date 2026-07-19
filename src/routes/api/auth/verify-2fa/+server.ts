import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { createAccessToken, normalizeEmail } from '$lib/server/auth';
import { readUsers, toSafeUser, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		const code = typeof body.code === 'string' ? body.code.trim() : '';
		const rememberMe = Boolean(body.rememberMe);
		if (!email || !code) return json({ error: 'Email and verification code are required' }, { status: 400 });

		const users = await readUsers();
		const index = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		if (!user.twoFactorCode || user.twoFactorCode !== code) {
			await logActivity(event, user.id, user.email, 'login', 'failed', 'Invalid 2FA code entered');
			return json({ error: 'Invalid verification code' }, { status: 400 });
		}
		if (user.twoFactorCodeExpires && Date.now() > user.twoFactorCodeExpires) {
			await logActivity(event, user.id, user.email, 'login', 'failed', 'Expired 2FA code entered');
			return json({ error: 'Verification code has expired. Please try logging in again.' }, { status: 400 });
		}

		user.twoFactorCode = null;
		user.twoFactorCodeExpires = null;
		users[index] = user;
		await writeUsers(users);

		const token = createAccessToken(user, rememberMe);
		await logActivity(event, user.id, user.email, 'login', 'success', `Logged in successfully via 2FA (rememberMe: ${rememberMe})`);
		return json({ message: 'Login successful', token, user: toSafeUser(user) });
	} catch (error) {
		console.error('2FA verification failed:', error);
		return json({ error: 'Server error during 2FA verification' }, { status: 500 });
	}
};
