import bcrypt from 'bcryptjs';
import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { passwordRegex, requireAuth } from '$lib/server/auth';
import { readUsers, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	try {
		const auth = requireAuth(event);
		if ('response' in auth) return auth.response;

		const body = await event.request.json();
		const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
		const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
		if (!currentPassword || !newPassword) return json({ error: 'Current and new passwords are required' }, { status: 400 });
		if (!passwordRegex.test(newPassword)) {
			return json({ error: 'New password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.' }, { status: 400 });
		}

		const users = await readUsers();
		const index = users.findIndex((user) => user.id === auth.user.id);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
			await logActivity(event, user.id, user.email, 'password_change', 'failed', 'Incorrect current password during change request');
			return json({ error: 'Incorrect current password' }, { status: 400 });
		}
		if (await bcrypt.compare(newPassword, user.passwordHash)) {
			return json({ error: 'New password must be different from current password' }, { status: 400 });
		}

		user.passwordHash = await bcrypt.hash(newPassword, 10);
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'password_change', 'success', 'Password changed from Security Center');
		return json({ message: 'Password updated successfully!' });
	} catch (error) {
		console.error('Update password failed:', error);
		return json({ error: 'Server error updating password' }, { status: 500 });
	}
};
