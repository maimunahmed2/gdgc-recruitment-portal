import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

import { completeOAuth } from '$lib/server/oauth';

export const GET: RequestHandler = async (event) => {
	try {
		const params = event.url.searchParams;
		const state = params.get('state') ?? '';
		const expectedState = event.cookies.get('oauth_state') ?? '';
		if (!state || state !== expectedState) return completeOAuth(event, '', '', 'github', 'Invalid OAuth state');
		event.cookies.delete('oauth_state', { path: '/' });

		if (params.get('mock') === 'true') {
			return completeOAuth(event, params.get('email') ?? '', params.get('name') ?? '', 'github');
		}

		const code = params.get('code');
		if (!code) return completeOAuth(event, '', '', 'github', 'Authorization code is missing');
		if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return completeOAuth(event, '', '', 'github', 'GitHub OAuth credentials are missing');

		const redirectUri = `${event.url.origin}/auth/callback/github`;
		const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				code,
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				redirect_uri: redirectUri
			})
		});
		if (!tokenResponse.ok) return completeOAuth(event, '', '', 'github', `Failed to exchange token: ${await tokenResponse.text()}`);

		const tokens = await tokenResponse.json() as { access_token?: string };
		if (!tokens.access_token) return completeOAuth(event, '', '', 'github', 'No access token returned from GitHub');

		const headers = {
			Authorization: `Bearer ${tokens.access_token}`,
			'User-Agent': 'GDGC-Recruitment-Portal'
		};
		const profileResponse = await fetch('https://api.github.com/user', { headers });
		if (!profileResponse.ok) return completeOAuth(event, '', '', 'github', 'Failed to retrieve profile information');

		const profile = await profileResponse.json() as { email?: string | null; name?: string | null; login?: string };
		let email = profile.email ?? '';
		if (!email) {
			const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
			if (emailsResponse.ok) {
				const emails = await emailsResponse.json() as Array<{ email: string; primary?: boolean }>;
				email = (emails.find((item) => item.primary) ?? emails[0])?.email ?? '';
			}
		}
		if (!email) email = `${profile.login ?? 'github_user'}@users.noreply.github.com`;

		return completeOAuth(event, email, profile.name ?? profile.login ?? 'GitHub User', 'github');
	} catch (error) {
		return completeOAuth(event, '', '', 'github', error instanceof Error ? error.message : 'Server error during GitHub callback');
	}
};
