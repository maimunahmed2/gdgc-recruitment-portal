import { logActivity } from '$lib/server/activity';
import { createToken, generateOtp } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser, writeUsers } from '$lib/server/db';
import { buildTwoFactorEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';
import { json, type RequestHandler } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async (event) => {
  try {
    await seedDatabase();
    const { email, password, rememberMe } = await event.request.json();

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    const users = await readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      await logActivity(event, 'unknown', email, 'login', 'failed', 'User not found');
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = users[userIndex];

    if (!bcrypt.compareSync(password, user.passwordHash)) {
      await logActivity(event, user.id, user.email, 'login', 'failed', 'Incorrect password entered');
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.twoFactorEnabled) {
      const twoFactorCode = generateOtp();
      user.twoFactorCode = twoFactorCode;
      user.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000;
      users[userIndex] = user;
      await writeUsers(users);

      await logActivity(event, user.id, user.email, 'two_factor_toggle', 'success', 'Two-Factor challenge initiated during login');
      await sendEmail(buildTwoFactorEmail(user.email, user.name, twoFactorCode));

      return json({
        mfaRequired: true,
        email: user.email,
        smtpConfigured: hasSmtpConfig(),
        message: 'Two-factor verification required'
      });
    }

    const expiresIn = rememberMe ? '7d' : '1h';
    const token = createToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      },
      expiresIn
    );

    await logActivity(event, user.id, user.email, 'login', 'success', `Logged in successfully (rememberMe: ${!!rememberMe})`);

    return json({
      message: 'Login successful',
      token,
      user: toSafeUser(user)
    });
  } catch (error: any) {
    return json({ error: error.message || 'Server error during login' }, { status: 500 });
  }
};
