import { requireAuth } from '$lib/server/auth';
import { readLogs } from '$lib/server/db';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
  try {
    const auth = requireAuth(event);
    if ('response' in auth) return auth.response;

    const logs = await readLogs();
    const userLogs = logs.filter((log) => log.userId === auth.user.id || log.email === auth.user.email);

    return json({ logs: userLogs });
  } catch {
    return json({ error: 'Server error fetching activity history' }, { status: 500 });
  }
};
