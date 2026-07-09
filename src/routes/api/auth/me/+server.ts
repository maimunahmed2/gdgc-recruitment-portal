import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  try {
    seedDatabase();
    const auth = requireAuth(event);
    if ('response' in auth) return auth.response;

    const user = readUsers().find((item) => item.id === auth.user.id);
    if (!user) return json({ error: 'User not found' }, { status: 404 });

    return json({ user: toSafeUser(user) });
  } catch {
    return json({ error: 'Server error retrieving current profile' }, { status: 500 });
  }
};
