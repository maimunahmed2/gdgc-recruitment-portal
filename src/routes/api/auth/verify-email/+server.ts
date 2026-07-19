import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { normalizeEmail } from '$lib/server/auth';
import { readUsers, toSafeUser, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		const code = typeof body.code === 'string' ? body.code.trim() : '';
		if (!email || !code) return json({ error: 'Email and verification code are required' }, { status: 400 });

		const users = await readUsers();
		const index = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		if (user.isVerified) return json({ error: 'Email is already verified' }, { status: 400 });
		if (!user.verificationCode || user.verificationCode !== code) {
			await logActivity(event, user.id, user.email, 'email_verify_success', 'failed', 'Invalid verification code');
			return json({ error: 'Invalid verification code' }, { status: 400 });
		}
		if (user.verificationCodeExpires && Date.now() > user.verificationCodeExpires) {
			await logActivity(event, user.id, user.email, 'email_verify_success', 'failed', 'Expired verification code');
			return json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
		}

		user.isVerified = true;
		user.verificationCode = null;
		user.verificationCodeExpires = null;
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'email_verify_success', 'success', 'Email verified successfully');

		return json({ message: 'Email verified successfully! You can now log in.', user: toSafeUser(user) });
	} catch (error) {
		console.error('Email verification failed:', error);
		return json({ error: 'Server error during email verification' }, { status: 500 });
	}
};
