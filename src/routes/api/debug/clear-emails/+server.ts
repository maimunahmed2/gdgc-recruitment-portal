import { json, type RequestHandler } from '@sveltejs/kit';
import { writeEmails } from '$lib/server/db';

function clear() {
  writeEmails([]);
  return json({ message: 'Email inbox cleared' });
}

export const GET: RequestHandler = async () => clear();
export const POST: RequestHandler = async () => clear();
