import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';

export const POST: RequestHandler = async (event) => {
  try {
    const auth = requireAuth(event);
    if ('response' in auth) return auth.response;

    logActivity(event, auth.user.id, auth.user.email, 'logout', 'success', 'Logged out successfully');
    return json({ message: 'Logged out successfully' });
  } catch {
    return json({ error: 'Server error during logout' }, { status: 500 });
  }
};
