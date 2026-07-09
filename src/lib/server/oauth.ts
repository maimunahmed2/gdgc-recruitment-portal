import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import type { UserWithPassword } from '$lib/types';
import { createToken } from './auth';
import { logActivity } from './activity';
import { readUsers, toSafeUser, writeUsers } from './db';

function escapeForScript(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"');
}

export function oauthResponseHtml(event: RequestEvent, email: string, name: string, provider: 'google' | 'github', errorDetail?: string) {
  if (errorDetail) {
    const safeError = escapeForScript(errorDetail);
    return `
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${safeError}" }, '*');
              window.close();
            } else {
              window.location.href = '/?error=${encodeURIComponent(errorDetail)}';
            }
          </script>
          <p>Authentication failed: ${errorDetail}. This window should close automatically.</p>
        </body>
      </html>
    `;
  }

  const users = readUsers();
  let user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  const providerLabel = provider === 'google' ? 'Google' : 'GitHub';

  if (!user) {
    const newUser: UserWithPassword = {
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      name,
      email: email.toLowerCase(),
      role: 'user',
      isVerified: true,
      createdAt: new Date().toISOString(),
      passwordHash: bcrypt.hashSync(Math.random().toString(36), 10)
    };

    users.push(newUser);
    writeUsers(users);
    user = newUser;

    logActivity(event, user.id, email, 'register', 'success', `Signed up via ${providerLabel} OAuth`);
  } else {
    if (!user.isVerified) {
      user.isVerified = true;
      writeUsers(users);
    }

    logActivity(event, user.id, email, 'login', 'success', `Logged in via ${providerLabel} OAuth`);
  }

  const token = createToken(
    { id: user.id, email: user.email, role: user.role, isVerified: user.isVerified },
    '1h'
  );

  const safeUser = toSafeUser(user);

  return `
    <html>
      <head>
        <title>GDGC Authentication Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-50 dark:bg-slate-950 font-sans flex items-center justify-center min-h-screen">
        <div class="text-center p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl max-w-sm w-full mx-4">
          <div class="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <svg class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Auth Success!</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Directing secure session. This window will close automatically...</p>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  token: '${token}',
                  user: ${JSON.stringify(safeUser)}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 1000);
          </script>
        </div>
      </body>
    </html>
  `;
}

export function getOAuthRedirectUri(event: RequestEvent, provider: string) {
  return `${event.url.origin}/auth/callback/${provider}`;
}

export function getOAuthUrl(event: RequestEvent, provider: string) {
  const redirectUri = getOAuthRedirectUri(event, provider);

  if (provider === 'google' && env.GOOGLE_CLIENT_ID) {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'google-state-secure-2026',
      prompt: 'select_account'
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, simulator: false };
  }

  if (provider === 'github' && env.GITHUB_CLIENT_ID) {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state: 'github-state-secure-2026'
    });

    return { url: `https://github.com/login/oauth/authorize?${params.toString()}`, simulator: false };
  }

  return {
    url: `/auth/simulator?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    simulator: true
  };
}
