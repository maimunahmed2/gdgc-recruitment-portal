import bcrypt from 'bcryptjs';
import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { normalizeEmail, passwordRegex } from '$lib/server/auth';
import { readUsers, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		const code = typeof body.code === 'string' ? body.code.trim() : '';
		const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
		if (!email || !code || !newPassword) return json({ error: 'All fields are required' }, { status: 400 });
		if (!passwordRegex.test(newPassword)) {
			return json({ error: 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.' }, { status: 400 });
		}

		const users = await readUsers();
		const index = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		if (!user.passwordResetCode || user.passwordResetCode !== code) {
			await logActivity(event, user.id, user.email, 'password_reset_success', 'failed', 'Invalid reset code');
			return json({ error: 'Invalid password reset code' }, { status: 400 });
		}
		if (user.passwordResetCodeExpires && Date.now() > user.passwordResetCodeExpires) {
			await logActivity(event, user.id, user.email, 'password_reset_success', 'failed', 'Expired reset code');
			return json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 });
		}
		if (await bcrypt.compare(newPassword, user.passwordHash)) {
			return json({ error: 'New password cannot be the same as your current password' }, { status: 400 });
		}

		user.passwordHash = await bcrypt.hash(newPassword, 10);
		user.passwordResetCode = null;
		user.passwordResetCodeExpires = null;
		user.isVerified = true;
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'password_reset_success', 'success', 'Password reset successfully');

		return json({ message: 'Password reset successfully! You can now log in with your new password.' });
	} catch (error) {
		console.error('Reset password failed:', error);
		return json({ error: 'Server error resetting password' }, { status: 500 });
	}
};
