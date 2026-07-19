import { requireAdmin } from '$lib/server/auth';
import {
  readUsers,
  seedDatabase,
  toSafeUser
} from '$lib/server/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	try {
		await seedDatabase();

		const auth = await requireAdmin(event);

		if ('response' in auth) {
			return auth.response;
		}

		const users = await readUsers();

		return json({
			users: users.map((user) => toSafeUser(user))
		});
	} catch (error) {
		console.error(
			'Error retrieving admin users:',
			error
		);

		return json(
			{
				error:
					'Server error retrieving admin users list'
			},
			{ status: 500 }
		);
	}
};