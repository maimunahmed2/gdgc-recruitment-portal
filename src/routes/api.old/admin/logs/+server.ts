import { requireAdmin } from '$lib/server/auth';
import { readLogs } from '$lib/server/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	try {
		const auth = await requireAdmin(event);

		if ('response' in auth) {
			return auth.response;
		}

		const logs = await readLogs();

		return json({
			logs: Array.isArray(logs) ? logs : []
		});
	} catch (error) {
		console.error('Error retrieving admin logs:', error);

		return json(
			{
				error: 'Server error retrieving admin logs'
			},
			{ status: 500 }
		);
	}
};