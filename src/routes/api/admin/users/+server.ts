import { requireAdmin } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser } from '$lib/server/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
  try {
    await seedDatabase();
    const auth = requireAdmin(event);
    if ('response' in auth) return auth.response;

    return json({ users: readUsers().map(toSafeUser) });
  } catch {
    return json({ error: 'Server error retrieving admin users lists' }, { status: 500 });
  }
};
