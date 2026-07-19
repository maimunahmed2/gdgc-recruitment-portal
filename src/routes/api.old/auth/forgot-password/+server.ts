import { logActivity } from '$lib/server/activity';
import { generateOtp } from '$lib/server/auth';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';
import { buildPasswordResetEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	try {
		await seedDatabase();

		const body = await event.request.json();
		const email =
			typeof body.email === 'string'
				? body.email.trim().toLowerCase()
				: '';
		
		if (!email) {
			return json(
				{ error: 'Email is required' },
				{ status: 400 }
			);
		}

		const users = await readUsers();
		const userIndex = users.findIndex(
			(user) =>
				user.email.trim().toLowerCase() === email
		);
		
		// Do not reveal whether the account exists.
		if (userIndex === -1) {
			return json({
				message:
					'If the email matches a registered account, a reset code will be sent.',
				smtpConfigured: hasSmtpConfig()
			});
		}
		const user = users[userIndex];
		
		const resetCode = generateOtp();

		user.passwordResetCode = resetCode;
		user.passwordResetCodeExpires =
			Date.now() + 15 * 60 * 1000;

		users[userIndex] = user;
		
		await writeUsers(users);

		await logActivity(
			event,
			user.id,
			user.email,
			'password_reset_request',
			'success',
			'Password reset requested'
		);

		const origin =
			event.request.headers.get('origin') ??
			event.url.origin;

		const resetUrl =
			`${origin}/?view=reset-password` +
			`&email=${encodeURIComponent(user.email)}` +
			`&code=${encodeURIComponent(resetCode)}`;

		const emailContent = buildPasswordResetEmail(
			user.email,
			user.name,
			resetCode,
			resetUrl
		);

		// Important: wait for the email operation to finish
		const emailResult = await sendEmail(emailContent);

		console.log('Password reset email result:', emailResult);

		return json({
			message:
				'If the email matches a registered account, a reset code will be sent.',
			smtpConfigured: hasSmtpConfig()
		});
	} catch (error) {
		console.error(
			'Password reset request failed:',
			error
		);

		return json(
			{
				error:
					'Server error requesting password reset'
			},
			{ status: 500 }
		);
	}
};