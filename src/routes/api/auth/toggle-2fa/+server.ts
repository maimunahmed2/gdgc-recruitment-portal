import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { requireAuth } from '$lib/server/auth';
import { readUsers, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	try {
		const auth = requireAuth(event);
		if ('response' in auth) return auth.response;

		const users = await readUsers();
		const index = users.findIndex((user) => user.id === auth.user.id);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		user.twoFactorEnabled = !user.twoFactorEnabled;
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'two_factor_toggle', 'success', `Two-Factor Authentication toggled ${user.twoFactorEnabled ? 'ON' : 'OFF'}`);

		return json({
			message: `Two-Factor Authentication has been ${user.twoFactorEnabled ? 'enabled' : 'disabled'}.`,
			twoFactorEnabled: Boolean(user.twoFactorEnabled)
		});
	} catch (error) {
		console.error('Toggle 2FA failed:', error);
		return json({ error: 'Server error toggling 2FA' }, { status: 500 });
	}
};
