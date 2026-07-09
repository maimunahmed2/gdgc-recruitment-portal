import { env } from '$env/dynamic/private';
import { oauthResponseHtml } from '$lib/server/oauth';
import type { RequestHandler } from '@sveltejs/kit';

type GoogleTokenResponse = {
	access_token?: string;
	error?: string;
	error_description?: string;
};

type GoogleProfile = {
	email?: string;
	name?: string;
	picture?: string;
	sub?: string;
};

export const GET: RequestHandler = async (event) => {
	try {
		const mock = event.url.searchParams.get('mock');
		const email = event.url.searchParams.get('email');
		const name = event.url.searchParams.get('name');
		const code = event.url.searchParams.get('code');

		if (mock === 'true') {
			return html(await oauthResponseHtml(event, email || '', name || 'Google User', 'google'));
		}

		if (!code) {
			return html(
				await oauthResponseHtml(event, '', '', 'google', 'Authorization code is missing')
			);
		}

		const redirectUri = `${event.url.origin}/auth/callback/google`;

		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				code,
				client_id: env.GOOGLE_CLIENT_ID || '',
				client_secret: env.GOOGLE_CLIENT_SECRET || '',
				redirect_uri: redirectUri,
				grant_type: 'authorization_code'
			}).toString()
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();

			return html(
				await oauthResponseHtml(
					event,
					'',
					'',
					'google',
					`Failed to exchange token: ${errorText}`
				)
			);
		}

		const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
		const accessToken = tokens.access_token;

		if (!accessToken) {
			const errorMessage =
				tokens.error_description || tokens.error || 'No access token returned from Google';

			return html(await oauthResponseHtml(event, '', '', 'google', errorMessage));
		}

		const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (!profileResponse.ok) {
			return html(
				await oauthResponseHtml(
					event,
					'',
					'',
					'google',
					'Failed to retrieve profile information'
				)
			);
		}

		const profile = (await profileResponse.json()) as GoogleProfile;

		if (!profile.email) {
			return html(
				await oauthResponseHtml(
					event,
					'',
					'',
					'google',
					'No email address associated with Google profile'
				)
			);
		}

		return html(
			await oauthResponseHtml(
				event,
				profile.email,
				profile.name || 'Google User',
				'google'
			)
		);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : 'Server error during Google auth callback';

		return html(await oauthResponseHtml(event, '', '', 'google', message));
	}
};

function html(body: string) {
	return new Response(body, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}