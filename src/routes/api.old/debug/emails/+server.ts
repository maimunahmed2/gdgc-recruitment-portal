import { json, type RequestHandler } from '@sveltejs/kit';
import { readEmails } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  return json({ emails: readEmails() });
};
