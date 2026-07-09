import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  try {
    seedDatabase();
    const auth = requireAdmin(event);
    if ('response' in auth) return auth.response;

    return json({ users: readUsers().map(toSafeUser) });
  } catch {
    return json({ error: 'Server error retrieving admin users lists' }, { status: 500 });
  }
};
