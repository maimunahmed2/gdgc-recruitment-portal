import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		const auth = requireAuth(event);
		if ('response' in auth) return auth.response;
		await logActivity(event, auth.user.id, auth.user.email, 'logout', 'success', 'Logged out successfully');
		return json({ message: 'Logged out successfully' });
	} catch (error) {
		console.error('Logout failed:', error);
		return json({ error: 'Server error during logout' }, { status: 500 });
	}
};
