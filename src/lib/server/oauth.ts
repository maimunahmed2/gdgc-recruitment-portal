import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

import type { UserWithPassword } from '../../types';
import { logActivity } from './activity';
import { createAccessToken, normalizeEmail } from './auth';
import { readUsers, toSafeUser, writeUsers } from './db';

function htmlResponse(markup: string, status = 200): Response {
	return new Response(markup, {
		status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}

function safeJson(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

function popupHtml(payload: unknown, message: string): string {
	return `<!doctype html>
	<html>
		<head><meta charset="utf-8"><title>GDGC Authentication</title></head>
		<body style="font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;background:#f8fafc">
			<div style="padding:24px;background:white;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.1);text-align:center;max-width:360px">
				<h2>${message}</h2>
				<p>This window should close automatically.</p>
			</div>
			<script>
				const payload = ${safeJson(payload)};
				if (window.opener) {
					window.opener.postMessage(payload, window.location.origin);
					window.close();
				} else {
					window.location.href = '/';
				}
			</script>
		</body>
	</html>`;
}

export async function completeOAuth(
	event: RequestEvent,
	emailValue: string,
	nameValue: string,
	provider: 'google' | 'github',
	errorDetail?: string
): Promise<Response> {
	if (errorDetail) {
		return htmlResponse(
			popupHtml(
				{ type: 'OAUTH_AUTH_FAILURE', error: errorDetail },
				'Authentication failed'
			),
			400
		);
	}

	const email = normalizeEmail(emailValue);
	const name = nameValue.trim() || `${provider === 'google' ? 'Google' : 'GitHub'} User`;
	if (!email) {
		return htmlResponse(
			popupHtml(
				{ type: 'OAUTH_AUTH_FAILURE', error: 'OAuth provider did not return an email address' },
				'Authentication failed'
			),
			400
		);
	}

	const users = await readUsers();
	let user = users.find((item) => normalizeEmail(item.email) === email);
	const providerLabel = provider === 'google' ? 'Google' : 'GitHub';

	if (!user) {
		user = {
			id: `usr_${randomUUID()}`,
			name,
			email,
			role: 'user',
			isVerified: true,
			createdAt: new Date().toISOString(),
			passwordHash: await bcrypt.hash(randomUUID(), 10),
			twoFactorEnabled: false
		} satisfies UserWithPassword;

		users.push(user);
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'register', 'success', `Signed up via ${providerLabel} OAuth`);
	} else {
		if (!user.isVerified) {
			user.isVerified = true;
			await writeUsers(users);
		}
		await logActivity(event, user.id, user.email, 'login', 'success', `Logged in via ${providerLabel} OAuth`);
	}

	const token = createAccessToken(user);
	return htmlResponse(
		popupHtml(
			{ type: 'OAUTH_AUTH_SUCCESS', token, user: toSafeUser(user) },
			'Authentication successful'
		)
	);
}

export function oauthSimulatorHtml(url: URL): string {
	const provider = url.searchParams.get('provider') === 'github' ? 'github' : 'google';
	const redirectUri = url.searchParams.get('redirect_uri') ?? '';
	const state = url.searchParams.get('state') ?? '';

	return `<!doctype html>
	<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width,initial-scale=1">
		<title>GDGC OAuth Simulator</title>
		<style>
			body{font-family:Arial,sans-serif;background:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;color:#0f172a}
			.card{width:min(100%,420px);background:white;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 50px rgba(15,23,42,.12);overflow:hidden}
			.header{background:#4f46e5;color:white;padding:16px 22px;font-weight:700}.content{padding:24px}.preset,.submit{width:100%;padding:12px;border-radius:10px;margin-top:10px;cursor:pointer}.preset{background:white;border:1px solid #cbd5e1;text-align:left}.submit{background:#4f46e5;color:white;border:0;font-weight:700}input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:9px;margin:5px 0 10px}
		</style>
	</head>
	<body>
		<div class="card">
			<div class="header">OAuth Sandbox Simulator · ${provider}</div>
			<div class="content">
				<h2>Choose a simulated identity</h2>
				<button class="preset" onclick="finish('alex.oauth@gdgc.edu','Alex Candidate')"><strong>Alex Candidate</strong><br>alex.oauth@gdgc.edu</button>
				<button class="preset" onclick="finish('taylor.coder@github.com','Taylor GitHub')"><strong>Taylor GitHub</strong><br>taylor.coder@github.com</button>
				<hr style="margin:22px 0;border:0;border-top:1px solid #e2e8f0">
				<label>Name</label><input id="name" placeholder="John Doe">
				<label>Email</label><input id="email" type="email" placeholder="john@example.com">
				<button class="submit" onclick="submitCustom()">Authorize simulated credentials</button>
			</div>
		</div>
		<script>
			const redirectUri = ${safeJson(redirectUri)};
			const state = ${safeJson(state)};
			const provider = ${safeJson(provider)};
			function finish(email,name){
				if(!redirectUri){alert('Redirect URI is missing');return;}
				const target = new URL(redirectUri, window.location.origin);
				target.searchParams.set('mock','true');
				target.searchParams.set('email',email);
				target.searchParams.set('name',name);
				target.searchParams.set('provider',provider);
				target.searchParams.set('state',state);
				window.location.href = target.toString();
			}
			function submitCustom(){
				const name = document.getElementById('name').value.trim() || 'Simulated User';
				const email = document.getElementById('email').value.trim() || 'simulated@gdgc.edu';
				if(!email.includes('@')){alert('Enter a valid email address');return;}
				finish(email,name);
			}
		</script>
	</body>
	</html>`;
}
