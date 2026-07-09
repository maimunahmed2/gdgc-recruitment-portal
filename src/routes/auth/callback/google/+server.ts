import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';
import { oauthResponseHtml } from '$lib/server/oauth';

export const GET: RequestHandler = async (event) => {
  try {
    const mock = event.url.searchParams.get('mock');
    const email = event.url.searchParams.get('email');
    const name = event.url.searchParams.get('name');
    const code = event.url.searchParams.get('code');

    if (mock === 'true') {
      return html(oauthResponseHtml(event, email || '', name || 'Google User', 'google'));
    }

    if (!code) {
      return html(oauthResponseHtml(event, '', '', 'google', 'Authorization code is missing'));
    }

    const redirectUri = `${event.url.origin}/auth/callback/google`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      return html(oauthResponseHtml(event, '', '', 'google', `Failed to exchange token: ${errorText}`));
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!profileResponse.ok) {
      return html(oauthResponseHtml(event, '', '', 'google', 'Failed to retrieve profile information'));
    }

    const profile = await profileResponse.json();

    if (!profile.email) {
      return html(oauthResponseHtml(event, '', '', 'google', 'No email address associated with Google profile'));
    }

    return html(oauthResponseHtml(event, profile.email, profile.name || 'Google User', 'google'));
  } catch (error: any) {
    return html(oauthResponseHtml(event, '', '', 'google', error.message || 'Server error during Google auth callback'));
  }
};

function html(body: string) {
  return new Response(body, { headers: { 'Content-Type': 'text/html' } });
}
