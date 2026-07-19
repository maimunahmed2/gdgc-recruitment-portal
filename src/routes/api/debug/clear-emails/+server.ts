import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';

import { writeEmails } from '$lib/server/db';

export const POST: RequestHandler = async () => {
	if (env.NODE_ENV === 'production') return json({ error: 'Not found' }, { status: 404 });
	await writeEmails([]);
	return json({ message: 'Email inbox cleared' });
};
