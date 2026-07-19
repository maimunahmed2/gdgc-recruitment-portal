import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

import { logActivity } from '$lib/server/activity';
import { emailRegex, generateOtp, normalizeEmail, passwordRegex } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser, writeUsers } from '$lib/server/db';
import { buildVerificationEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';
import type { UserWithPassword } from '../../../../types';

export const POST: RequestHandler = async (event) => {
	try {
		await seedDatabase();
		const body = await event.request.json();
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		const email = normalizeEmail(body.email);
		const password = typeof body.password === 'string' ? body.password : '';
		const adminCode = typeof body.adminCode === 'string' ? body.adminCode : '';

		if (!name || !email || !password) return json({ error: 'All fields are required' }, { status: 400 });
		if (name.length < 2) return json({ error: 'Name must be at least 2 characters long' }, { status: 400 });
		if (!emailRegex.test(email)) return json({ error: 'Invalid email address format' }, { status: 400 });
		if (!passwordRegex.test(password)) {
			return json({ error: 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.' }, { status: 400 });
		}

		let role: 'user' | 'admin' = 'user';
		if (adminCode) {
			const expected = env.ADMIN_REGISTRATION_SECRET || 'GDGC_ADMIN_2026';
			if (adminCode !== expected) return json({ error: 'Invalid admin registration secret code.' }, { status: 400 });
			role = 'admin';
		}

		const users = await readUsers();
		if (users.some((user) => normalizeEmail(user.email) === email)) {
			await logActivity(event, 'unknown', email, 'register', 'failed', 'Email already registered');
			return json({ error: 'Email address is already registered' }, { status: 409 });
		}

		const verificationCode = generateOtp();
		const newUser: UserWithPassword = {
			id: `usr_${randomUUID()}`,
			name,
			email,
			role,
			isVerified: false,
			createdAt: new Date().toISOString(),
			passwordHash: await bcrypt.hash(password, 10),
			verificationCode,
			verificationCodeExpires: Date.now() + 15 * 60 * 1000,
			twoFactorEnabled: false
		};

		users.push(newUser);
		await writeUsers(users);
		await logActivity(event, newUser.id, email, 'register', 'success', role === 'admin' ? 'Admin registered successfully' : 'User registered successfully');
		await sendEmail(buildVerificationEmail(email, name, verificationCode));

		return json({
			message: 'Registration successful! Verification code sent to email.',
			smtpConfigured: hasSmtpConfig(),
			user: toSafeUser(newUser)
		}, { status: 201 });
	} catch (error) {
		console.error('Registration failed:', error);
		return json({ error: error instanceof Error ? error.message : 'Server error during registration' }, { status: 500 });
	}
};
