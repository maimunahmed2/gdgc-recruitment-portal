import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { generateOtp, normalizeEmail } from '$lib/server/auth';
import { readUsers, writeUsers } from '$lib/server/db';
import { buildTwoFactorEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		if (!email) return json({ error: 'Email is required' }, { status: 400 });

		const users = await readUsers();
		const index = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		if (!user.twoFactorEnabled) return json({ error: 'Two-Factor Authentication is not enabled for this user' }, { status: 400 });

		const code = generateOtp();
		user.twoFactorCode = code;
		user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'two_factor_toggle', 'success', 'Two-factor code resent');
		await sendEmail(buildTwoFactorEmail(user.email, user.name, code));

		return json({ message: 'A new Two-Factor verification code has been sent.', smtpConfigured: hasSmtpConfig() });
	} catch (error) {
		console.error('Resend 2FA failed:', error);
		return json({ error: 'Server error resending 2FA code' }, { status: 500 });
	}
};
