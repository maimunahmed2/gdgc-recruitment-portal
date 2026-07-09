import { logActivity } from '$lib/server/activity';
import { generateOtp } from '$lib/server/auth';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';
import { buildVerificationEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  try {
    await seedDatabase();
    const { email } = await event.request.json();

    if (!email) return json({ error: 'Email is required' }, { status: 400 });

    const users = await readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];
    if (user.isVerified) return json({ error: 'Email is already verified' }, { status: 400 });

    const verificationCode = generateOtp();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000;
    users[userIndex] = user;
    await writeUsers(users);

    await logActivity(event, user.id, user.email, 'email_verify_request', 'success', 'Verification code resent');
    sendEmail(buildVerificationEmail(email, user.name, verificationCode));

    return json({
      message: 'Verification email resent successfully',
      smtpConfigured: hasSmtpConfig()
    });
  } catch {
    return json({ error: 'Server error resending verification' }, { status: 500 });
  }
};
