import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { generateOtp, normalizeEmail } from '$lib/server/auth';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';
import { buildPasswordResetEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';

const genericMessage = 'If the email matches a registered account, a reset code will be sent.';

export const POST: RequestHandler = async (event) => {
	try {
		await seedDatabase();
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		if (!email) return json({ error: 'Email is required' }, { status: 400 });

		const users = await readUsers();
		const index = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (index === -1) return json({ message: genericMessage, smtpConfigured: hasSmtpConfig() });

		const user = users[index];
		const code = generateOtp();
		user.passwordResetCode = code;
		user.passwordResetCodeExpires = Date.now() + 15 * 60 * 1000;
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'password_reset_request', 'success', 'Password reset requested');

		const resetUrl = `${event.url.origin}/?view=reset-password&email=${encodeURIComponent(user.email)}&code=${encodeURIComponent(code)}`;
		await sendEmail(buildPasswordResetEmail(user.email, user.name, code, resetUrl));

		return json({ message: genericMessage, smtpConfigured: hasSmtpConfig() });
	} catch (error) {
		console.error('Forgot password failed:', error);
		return json({ error: 'Server error requesting password reset' }, { status: 500 });
	}
};
