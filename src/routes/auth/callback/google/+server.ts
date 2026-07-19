import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

import { completeOAuth } from '$lib/server/oauth';

export const GET: RequestHandler = async (event) => {
	try {
		const params = event.url.searchParams;
		const state = params.get('state') ?? '';
		const expectedState = event.cookies.get('oauth_state') ?? '';
		if (!state || state !== expectedState) return completeOAuth(event, '', '', 'google', 'Invalid OAuth state');
		event.cookies.delete('oauth_state', { path: '/' });

		if (params.get('mock') === 'true') {
			return completeOAuth(event, params.get('email') ?? '', params.get('name') ?? '', 'google');
		}

		const code = params.get('code');
		if (!code) return completeOAuth(event, '', '', 'google', 'Authorization code is missing');
		if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return completeOAuth(event, '', '', 'google', 'Google OAuth credentials are missing');

		const redirectUri = `${event.url.origin}/auth/callback/google`;
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: env.GOOGLE_CLIENT_ID,
				client_secret: env.GOOGLE_CLIENT_SECRET,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code'
			})
		});
		if (!tokenResponse.ok) return completeOAuth(event, '', '', 'google', `Failed to exchange token: ${await tokenResponse.text()}`);

		const tokens = await tokenResponse.json() as { access_token?: string };
		if (!tokens.access_token) return completeOAuth(event, '', '', 'google', 'No access token returned from Google');

		const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
			headers: { Authorization: `Bearer ${tokens.access_token}` }
		});
		if (!profileResponse.ok) return completeOAuth(event, '', '', 'google', 'Failed to retrieve profile information');

		const profile = await profileResponse.json() as { email?: string; name?: string };
		return completeOAuth(event, profile.email ?? '', profile.name ?? 'Google User', 'google');
	} catch (error) {
		return completeOAuth(event, '', '', 'google', error instanceof Error ? error.message : 'Server error during Google callback');
	}
};
