import { logActivity } from '$lib/server/activity';
import { passwordRegex } from '$lib/server/auth';
import { readUsers, seedDatabase, writeUsers } from '$lib/server/db';
import { json, type RequestHandler } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async (event) => {
  try {
    await seedDatabase();
    const { email, code, newPassword } = await event.request.json();

    if (!email || !code || !newPassword) return json({ error: 'All fields are required' }, { status: 400 });

    if (!passwordRegex.test(newPassword)) {
      return json(
        { error: 'Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character.' },
        { status: 400 }
      );
    }

    const users = await readUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];

    if (!user.passwordResetCode || user.passwordResetCode !== code) {
      await logActivity(event, user.id, user.email, 'password_reset_success', 'failed', 'Invalid reset code');
      return json({ error: 'Invalid password reset code' }, { status: 400 });
    }

    if (user.passwordResetCodeExpires && Date.now() > user.passwordResetCodeExpires) {
      await logActivity(event, user.id, user.email, 'password_reset_success', 'failed', 'Expired reset code');
      return json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 });
    }

    if (bcrypt.compareSync(newPassword, user.passwordHash)) {
      return json({ error: 'New password cannot be the same as your current password' }, { status: 400 });
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    user.passwordResetCode = null;
    user.passwordResetCodeExpires = null;
    if (!user.isVerified) user.isVerified = true;

    users[userIndex] = user;
    await writeUsers(users);

    await logActivity(event, user.id, user.email, 'password_reset_success', 'success', 'Password reset successfully');

    return json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch {
    return json({ error: 'Server error resetting password' }, { status: 500 });
  }
};
