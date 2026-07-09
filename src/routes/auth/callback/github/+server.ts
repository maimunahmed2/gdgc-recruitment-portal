import { env } from '$env/dynamic/private';
import { oauthResponseHtml } from '$lib/server/oauth';
import type { RequestHandler } from '@sveltejs/kit';

type GitHubProfile = {
	email?: string | null;
	name?: string | null;
	login?: string | null;
};

type GitHubEmail = {
	email: string;
	primary?: boolean;
	verified?: boolean;
	visibility?: string | null;
};

type GitHubTokenResponse = {
	access_token?: string;
	error?: string;
	error_description?: string;
};

export const GET: RequestHandler = async (event) => {
	try {
		const mock = event.url.searchParams.get('mock');
		const email = event.url.searchParams.get('email');
		const name = event.url.searchParams.get('name');
		const code = event.url.searchParams.get('code');

		if (mock === 'true') {
			return html(await oauthResponseHtml(event, email || '', name || 'GitHub User', 'github'));
		}

		if (!code) {
			return html(
				await oauthResponseHtml(event, '', '', 'github', 'Authorization code is missing')
			);
		}

		const redirectUri = `${event.url.origin}/auth/callback/github`;

		const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				code,
				client_id: env.GITHUB_CLIENT_ID || '',
				client_secret: env.GITHUB_CLIENT_SECRET || '',
				redirect_uri: redirectUri
			})
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();

			return html(
				await oauthResponseHtml(
					event,
					'',
					'',
					'github',
					`Failed to exchange token: ${errorText}`
				)
			);
		}

		const tokens = (await tokenResponse.json()) as GitHubTokenResponse;
		const accessToken = tokens.access_token;

		if (!accessToken) {
			const errorMessage =
				tokens.error_description || tokens.error || 'No access token returned from GitHub';

			return html(await oauthResponseHtml(event, '', '', 'github', errorMessage));
		}

		const profileResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'User-Agent': 'GDGC-Recruitment-Portal'
			}
		});

		if (!profileResponse.ok) {
			return html(
				await oauthResponseHtml(
					event,
					'',
					'',
					'github',
					'Failed to retrieve profile information'
				)
			);
		}

		const profile = (await profileResponse.json()) as GitHubProfile;
		let githubEmail = profile.email || '';

		if (!githubEmail) {
			const emailsResponse = await fetch('https://api.github.com/user/emails', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'User-Agent': 'GDGC-Recruitment-Portal'
				}
			});

			if (emailsResponse.ok) {
				const emails = (await emailsResponse.json()) as GitHubEmail[];

				if (Array.isArray(emails) && emails.length > 0) {
					const primaryEmail = emails.find((item) => item.primary) || emails[0];
					githubEmail = primaryEmail.email;
				}
			}
		}

		if (!githubEmail) {
			githubEmail = `${profile.login || 'github_user'}@users.noreply.github.com`;
		}

		return html(
			await oauthResponseHtml(
				event,
				githubEmail,
				profile.name || profile.login || 'GitHub User',
				'github'
			)
		);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : 'Server error during GitHub auth callback';

		return html(await oauthResponseHtml(event, '', '', 'github', message));
	}
};

function html(body: string) {
	return new Response(body, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}