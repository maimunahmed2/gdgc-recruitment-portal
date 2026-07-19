import type { RequestHandler } from '@sveltejs/kit';

import { oauthSimulatorHtml } from '$lib/server/oauth';

export const GET: RequestHandler = async (event) => {
	return new Response(oauthSimulatorHtml(event.url), {
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
};
