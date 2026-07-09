import { json, type RequestHandler } from '@sveltejs/kit';
import { createToken } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { readUsers, seedDatabase, toSafeUser, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  try {
    seedDatabase();
    const { email, code, rememberMe } = await event.request.json();

    if (!email || !code) {
      return json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];

    if (!user.twoFactorCode || user.twoFactorCode !== code) {
      logActivity(event, user.id, user.email, 'login', 'failed', 'Invalid 2FA code entered');
      return json({ error: 'Invalid verification code' }, { status: 400 });
    }

    if (user.twoFactorCodeExpires && Date.now() > user.twoFactorCodeExpires) {
      logActivity(event, user.id, user.email, 'login', 'failed', 'Expired 2FA code entered');
      return json({ error: 'Verification code has expired. Please try logging in again.' }, { status: 400 });
    }

    user.twoFactorCode = null;
    user.twoFactorCodeExpires = null;
    users[userIndex] = user;
    writeUsers(users);

    const token = createToken(
      { id: user.id, email: user.email, role: user.role, isVerified: user.isVerified },
      rememberMe ? '7d' : '1h'
    );

    logActivity(event, user.id, user.email, 'login', 'success', `Logged in successfully via 2FA (rememberMe: ${!!rememberMe})`);

    return json({ message: 'Login successful', token, user: toSafeUser(user) });
  } catch (error: any) {
    return json({ error: error.message || 'Server error during 2FA verification' }, { status: 500 });
  }
};
