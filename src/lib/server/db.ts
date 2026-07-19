import { env } from '$env/dynamic/private';
import bcrypt from 'bcryptjs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { ActivityLog, SimulatedEmail, User, UserWithPassword } from '../../types';

const COLLECTIONS = {
	users: 'users',
	logs: 'logs',
	emails: 'emails'
} as const;

function getFirebaseApp() {
	const existing = getApps()[0];
	if (existing) return existing;

	const projectId = env.FIREBASE_PROJECT_ID;
	const clientEmail = env.FIREBASE_CLIENT_EMAIL;
	const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

	if (projectId && clientEmail && privateKey) {
		return initializeApp({
			credential: cert({ projectId, clientEmail, privateKey })
		});
	}

	// Supports local environments configured with Application Default Credentials.
	return initializeApp();
}

const firestore = getFirestore(getFirebaseApp());

async function readCollection<T extends { id: string }>(collectionName: string): Promise<T[]> {
	const snapshot = await firestore.collection(collectionName).get();

	return snapshot.docs.map((document) => ({
		id: document.id,
		...document.data()
	})) as T[];
}

async function replaceCollection<T extends { id: string }>(
	collectionName: string,
	items: T[]
): Promise<void> {
	const collection = firestore.collection(collectionName);
	const current = await collection.get();
	const incomingIds = new Set(items.map((item) => item.id));
	const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

	for (const document of current.docs) {
		if (!incomingIds.has(document.id)) {
			operations.push((batch) => batch.delete(document.ref));
		}
	}

	for (const item of items) {
		const { id, ...data } = item;
		operations.push((batch) => batch.set(collection.doc(id), data, { merge: false }));
	}

	// Firestore batches support at most 500 writes. Keep headroom for safety.
	for (let index = 0; index < operations.length; index += 450) {
		const batch = firestore.batch();
		for (const operation of operations.slice(index, index + 450)) operation(batch);
		await batch.commit();
	}
}

export async function readUsers(): Promise<UserWithPassword[]> {
	return readCollection<UserWithPassword>(COLLECTIONS.users);
}

export async function writeUsers(users: UserWithPassword[]): Promise<void> {
	await replaceCollection(COLLECTIONS.users, users);
}

export async function readLogs(): Promise<ActivityLog[]> {
	const logs = await readCollection<ActivityLog>(COLLECTIONS.logs);
	return logs.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function writeLogs(logs: ActivityLog[]): Promise<void> {
	await replaceCollection(COLLECTIONS.logs, logs);
}

export async function readEmails(): Promise<SimulatedEmail[]> {
	const emails = await readCollection<SimulatedEmail>(COLLECTIONS.emails);
	return emails.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function writeEmails(emails: SimulatedEmail[]): Promise<void> {
	await replaceCollection(COLLECTIONS.emails, emails);
}

export function toSafeUser(user: UserWithPassword): User {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		isVerified: user.isVerified,
		createdAt: user.createdAt,
		twoFactorEnabled: Boolean(user.twoFactorEnabled)
	};
}

export async function seedDatabase(): Promise<void> {
	const users = await readUsers();
	if (users.length > 0) return;

	const createdAt = new Date().toISOString();
	const [userPasswordHash, adminPasswordHash] = await Promise.all([
		bcrypt.hash('UserPass123!', 10),
		bcrypt.hash('AdminPass123!', 10)
	]);

	await writeUsers([
		{
			id: 'usr_demo_user',
			name: 'Alex Recruitment',
			email: 'user@gdgc.edu',
			role: 'user',
			isVerified: true,
			createdAt,
			passwordHash: userPasswordHash,
			twoFactorEnabled: false
		},
		{
			id: 'usr_demo_admin',
			name: 'GDGC Admin',
			email: 'admin@gdgc.edu',
			role: 'admin',
			isVerified: true,
			createdAt,
			passwordHash: adminPasswordHash,
			twoFactorEnabled: false
		}
	]);
}
