import { json, type RequestHandler } from '@sveltejs/kit';
import { generateOtp } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';
import { buildTwoFactorEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async (event) => {
  try {
    seedDatabase();
    const { email } = await event.request.json();

    if (!email) return json({ error: 'Email is required' }, { status: 400 });

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];

    if (!user.twoFactorEnabled) {
      return json({ error: 'Two-Factor Authentication is not enabled for this user' }, { status: 400 });
    }

    const twoFactorCode = generateOtp();
    user.twoFactorCode = twoFactorCode;
    user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;
    users[userIndex] = user;
    writeUsers(users);

    logActivity(event, user.id, user.email, 'two_factor_toggle', 'success', 'Two-Factor code resent');
    sendEmail(buildTwoFactorEmail(user.email, user.name, twoFactorCode));

    return json({
      message: 'A new Two-Factor verification code has been sent.',
      smtpConfigured: hasSmtpConfig()
    });
  } catch (error: any) {
    return json({ error: error.message || 'Server error resending 2FA code' }, { status: 500 });
  }
};
