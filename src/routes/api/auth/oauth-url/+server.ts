import { env } from '$env/dynamic/private';
import { randomUUID } from 'node:crypto';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	const provider = event.url.searchParams.get('provider');
	if (provider !== 'google' && provider !== 'github') {
		return json({ error: 'Unsupported OAuth provider' }, { status: 400 });
	}

	const redirectUri = `${event.url.origin}/auth/callback/${provider}`;
	const state = randomUUID();
	event.cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: event.url.protocol === 'https:',
		maxAge: 10 * 60
	});

	if (provider === 'google' && env.GOOGLE_CLIENT_ID) {
		const params = new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: 'openid email profile',
			state,
			prompt: 'select_account'
		});
		return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
	}

	if (provider === 'github' && env.GITHUB_CLIENT_ID) {
		const params = new URLSearchParams({
			client_id: env.GITHUB_CLIENT_ID,
			redirect_uri: redirectUri,
			scope: 'read:user user:email',
			state
		});
		return json({ url: `https://github.com/login/oauth/authorize?${params}` });
	}

	const simulator = `/auth/simulator?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
	return json({ url: simulator, simulator: true });
};
