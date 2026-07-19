import { json, type RequestHandler } from '@sveltejs/kit';
import { getOAuthUrl } from '$lib/server/oauth';

export const GET: RequestHandler = async (event) => {
  const provider = event.url.searchParams.get('provider') || 'google';
  return json(getOAuthUrl(event, provider));
};
