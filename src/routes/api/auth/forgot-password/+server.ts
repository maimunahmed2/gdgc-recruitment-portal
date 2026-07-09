import { json, type RequestHandler } from '@sveltejs/kit';
import { generateOtp } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';
import { buildPasswordResetEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async (event) => {
  try {
    seedDatabase();
    const { email } = await event.request.json();

    if (!email) return json({ error: 'Email is required' }, { status: 400 });

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      return json({ message: 'If the email matches a registered account, a reset code will be sent.' });
    }

    const user = users[userIndex];
    const resetCode = generateOtp();
    user.passwordResetCode = resetCode;
    user.passwordResetCodeExpires = Date.now() + 15 * 60 * 1000;
    users[userIndex] = user;
    writeUsers(users);

    logActivity(event, user.id, user.email, 'password_reset_request', 'success', 'Password reset requested');

    const origin = event.request.headers.get('origin') || event.url.origin;
    const resetUrl = `${origin}/?view=reset-password&email=${encodeURIComponent(email)}&code=${resetCode}`;
    sendEmail(buildPasswordResetEmail(email, user.name, resetCode, resetUrl));

    return json({
      message: 'If the email matches a registered account, a reset code will be sent.',
      smtpConfigured: hasSmtpConfig()
    });
  } catch {
    return json({ error: 'Server error requesting password reset' }, { status: 500 });
  }
};
