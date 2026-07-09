import { json, type RequestHandler } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { passwordRegex, requireAuth } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { readUsers, writeUsers } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  try {
    const auth = requireAuth(event);
    if ('response' in auth) return auth.response;

    const { currentPassword, newPassword } = await event.request.json();

    if (!currentPassword || !newPassword) {
      return json({ error: 'Current and new passwords are required' }, { status: 400 });
    }

    if (!passwordRegex.test(newPassword)) {
      return json(
        { error: 'New password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character.' },
        { status: 400 }
      );
    }

    const users = readUsers();
    const userIndex = users.findIndex((user) => user.id === auth.user.id);

    if (userIndex === -1) return json({ error: 'User not found' }, { status: 404 });

    const user = users[userIndex];

    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      logActivity(event, user.id, user.email, 'password_change', 'failed', 'Incorrect current password during change request');
      return json({ error: 'Incorrect current password' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return json({ error: 'New password must be different from current password' }, { status: 400 });
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    users[userIndex] = user;
    writeUsers(users);

    logActivity(event, user.id, user.email, 'password_change', 'success', 'Password changed from Security Center');

    return json({ message: 'Password updated successfully!' });
  } catch {
    return json({ error: 'Server error updating password' }, { status: 500 });
  }
};
