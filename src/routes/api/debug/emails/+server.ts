import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';

import { readEmails } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	if (env.NODE_ENV === 'production') return json({ error: 'Not found' }, { status: 404 });
	return json({ emails: await readEmails() });
};
