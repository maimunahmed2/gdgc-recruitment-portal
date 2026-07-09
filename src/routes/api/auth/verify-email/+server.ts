import { json, type RequestHandler } from '@sveltejs/kit';
import { logActivity } from '$lib/server/activity';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  try {
    seedDatabase();
    const { email, code } = await event.request.json();

    if (!email || !code) return json({ error: 'Email and verification code are required' }, { status: 400 });

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];

    if (user.isVerified) return json({ error: 'Email is already verified' }, { status: 400 });

    if (!user.verificationCode || user.verificationCode !== code) {
      logActivity(event, user.id, user.email, 'email_verify_success', 'failed', 'Invalid verification code');
      return json({ error: 'Invalid verification code' }, { status: 400 });
    }

    if (user.verificationCodeExpires && Date.now() > user.verificationCodeExpires) {
      logActivity(event, user.id, user.email, 'email_verify_success', 'failed', 'Expired verification code');
      return json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    users[userIndex] = user;
    writeUsers(users);

    logActivity(event, user.id, user.email, 'email_verify_success', 'success', 'Email verified successfully');

    return json({
      message: 'Email verified successfully! You can now log in.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch {
    return json({ error: 'Server error during email verification' }, { status: 500 });
  }
};
