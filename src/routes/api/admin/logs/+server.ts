import { json, type RequestHandler } from '@sveltejs/kit';

import { requireAdmin } from '$lib/server/auth';
import { readLogs } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	try {
		const auth = requireAdmin(event);
		if ('response' in auth) return auth.response;
		return json({ logs: await readLogs() });
	} catch (error) {
		console.error('Admin logs lookup failed:', error);
		return json({ error: 'Server error retrieving admin logs' }, { status: 500 });
	}
};
