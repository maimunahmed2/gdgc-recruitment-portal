import { json, type RequestHandler } from '@sveltejs/kit';

import { requireAdmin } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	try {
		await seedDatabase();
		const auth = requireAdmin(event);
		if ('response' in auth) return auth.response;
		const users = await readUsers();
		return json({ users: users.map(toSafeUser) });
	} catch (error) {
		console.error('Admin users lookup failed:', error);
		return json({ error: 'Server error retrieving admin users list' }, { status: 500 });
	}
};
