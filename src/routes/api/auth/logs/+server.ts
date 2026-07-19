import { json, type RequestHandler } from '@sveltejs/kit';

import { requireAuth } from '$lib/server/auth';
import { readLogs } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	try {
		const auth = requireAuth(event);
		if ('response' in auth) return auth.response;
		const logs = await readLogs();
		return json({ logs: logs.filter((log) => log.userId === auth.user.id || log.email === auth.user.email) });
	} catch (error) {
		console.error('Activity history lookup failed:', error);
		return json({ error: 'Server error fetching activity history' }, { status: 500 });
	}
};
