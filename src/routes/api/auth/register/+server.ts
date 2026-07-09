import { logActivity } from '$lib/server/activity';
import { emailRegex, generateOtp, passwordRegex } from '$lib/server/auth';
import { readUsers, seedDatabase, toSafeUser, writeUsers } from '$lib/server/db';
import { buildVerificationEmail, hasSmtpConfig, sendEmail } from '$lib/server/email';
import type { UserWithPassword } from '$lib/types';
import { json, type RequestHandler } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async (event) => {
  try {
    await seedDatabase();
    const { name, email, password } = await event.request.json();

    if (!name || !email || !password) {
      return json({ error: 'All fields are required' }, { status: 400 });
    }

    if (name.trim().length < 2) {
      return json({ error: 'Name must be at least 2 characters long' }, { status: 400 });
    }

    if (!emailRegex.test(email)) {
      return json({ error: 'Invalid email address format' }, { status: 400 });
    }

    if (!passwordRegex.test(password)) {
      return json(
        {
          error:
            'Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character.'
        },
        { status: 400 }
      );
    }

    const users = await readUsers();
    const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      await logActivity(event, 'unknown', email, 'register', 'failed', 'Email already registered');
      return json({ error: 'Email address is already registered' }, { status: 409 });
    }

    const verificationCode = generateOtp();
    const verificationCodeExpires = Date.now() + 15 * 60 * 1000;

    const newUser: UserWithPassword = {
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      name: name.trim(),
      email: email.toLowerCase(),
      role: 'user',
      isVerified: false,
      createdAt: new Date().toISOString(),
      passwordHash: bcrypt.hashSync(password, 10),
      verificationCode,
      verificationCodeExpires
    };

    users.push(newUser);
    await writeUsers(users);

    await logActivity(event, newUser.id, email, 'register', 'success', 'User registered successfully');
    sendEmail(buildVerificationEmail(email, name.trim(), verificationCode));

    return json(
      {
        message: 'Registration successful! Verification code sent to email.',
        smtpConfigured: hasSmtpConfig(),
        user: toSafeUser(newUser)
      },
      { status: 201 }
    );
  } catch (error: any) {
    return json({ error: error.message || 'Server error during registration' }, { status: 500 });
  }
};
