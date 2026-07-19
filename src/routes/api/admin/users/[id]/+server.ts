import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { requireAdmin } from '$lib/server/auth';
import { readUsers, writeUsers } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
	try {
		const auth = requireAdmin(event);
		if ('response' in auth) return auth.response;

		const targetUserId = event.params.id;
		if (!targetUserId) return json({ error: 'User ID is required' }, { status: 400 });
		if (targetUserId === auth.user.id) return json({ error: 'Self-deletion is forbidden.' }, { status: 400 });

		const users = await readUsers();
		const target = users.find((user) => user.id === targetUserId);
		if (!target) return json({ error: 'User not found' }, { status: 404 });

		await writeUsers(users.filter((user) => user.id !== targetUserId));
		await logActivity(event, auth.user.id, auth.user.email, 'admin_delete', 'success', `Admin deleted ${target.email} (${targetUserId})`);
		return json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Delete user failed:', error);
		return json({ error: 'Server error deleting user' }, { status: 500 });
	}
};
