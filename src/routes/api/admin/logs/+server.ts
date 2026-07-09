import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { readLogs } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const auth = requireAdmin(event);
  if ('response' in auth) return auth.response;

  return json({ logs: readLogs() });
};
