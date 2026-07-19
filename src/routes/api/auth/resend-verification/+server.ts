import { json, type RequestHandler } from '@sveltejs/kit';

import { logActivity } from '$lib/server/activity';
import { generateOtp, normalizeEmail } from '$lib/server/auth';
import { readUsers, writeUsers } from '$lib/server/db';
import { buildVerificationEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const email = normalizeEmail(body.email);
		if (!email) return json({ error: 'Email is required' }, { status: 400 });

		const users = await readUsers();
		const index = users.findIndex((user) => normalizeEmail(user.email) === email);
		if (index === -1) return json({ error: 'User not found' }, { status: 404 });

		const user = users[index];
		if (user.isVerified) return json({ error: 'Email is already verified' }, { status: 400 });

		const code = generateOtp();
		user.verificationCode = code;
		user.verificationCodeExpires = Date.now() + 15 * 60 * 1000;
		users[index] = user;
		await writeUsers(users);
		await logActivity(event, user.id, user.email, 'email_verify_request', 'success', 'Verification code resent');
		await sendEmail(buildVerificationEmail(user.email, user.name, code, true));

		return json({ message: 'Verification email resent successfully', smtpConfigured: hasSmtpConfig() });
	} catch (error) {
		console.error('Resend verification failed:', error);
		return json({ error: 'Server error resending verification' }, { status: 500 });
	}
};
