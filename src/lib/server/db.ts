import {
	FIREBASE_CLIENT_EMAIL,
	FIREBASE_PRIVATE_KEY,
	FIREBASE_PROJECT_ID
} from '$env/static/private';
import bcrypt from 'bcryptjs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { ActivityLog, SimulatedEmail, User, UserWithPassword } from '$lib/types';

const firebaseProjectId = FIREBASE_PROJECT_ID;
const firebaseClientEmail = FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
	throw new Error(
		'Missing Firebase Admin env variables. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.'
	);
}

if (!getApps().length) {
	initializeApp({
		credential: cert({
			projectId: firebaseProjectId,
			clientEmail: firebaseClientEmail,
			privateKey: firebasePrivateKey
		})
	});
}

const db = getFirestore();

const usersCollection = db.collection('users');
const logsCollection = db.collection('activityLogs');
const emailsCollection = db.collection('simulatedEmails');

export async function readUsers(): Promise<UserWithPassword[]> {
	const snapshot = await usersCollection.orderBy('createdAt', 'asc').get();

	return snapshot.docs.map((doc) => doc.data() as UserWithPassword);
}

export async function writeUsers(users: UserWithPassword[]) {
	const snapshot = await usersCollection.get();
	const batch = db.batch();

	for (const doc of snapshot.docs) {
		batch.delete(doc.ref);
	}

	for (const user of users) {
		batch.set(usersCollection.doc(user.id), user);
	}

	await batch.commit();
}

export async function readLogs(): Promise<ActivityLog[]> {
	const snapshot = await logsCollection.orderBy('timestamp', 'desc').get();

	return snapshot.docs.map((doc) => doc.data() as ActivityLog);
}

export async function writeLogs(logs: ActivityLog[]) {
	const snapshot = await logsCollection.get();
	const batch = db.batch();

	for (const doc of snapshot.docs) {
		batch.delete(doc.ref);
	}

	for (const log of logs) {
		batch.set(logsCollection.doc(log.id), log);
	}

	await batch.commit();
}

export async function readEmails(): Promise<SimulatedEmail[]> {
	const snapshot = await emailsCollection.orderBy('timestamp', 'desc').get();

	return snapshot.docs.map((doc) => doc.data() as SimulatedEmail);
}

export async function writeEmails(emails: SimulatedEmail[]) {
	const snapshot = await emailsCollection.get();
	const batch = db.batch();

	for (const doc of snapshot.docs) {
		batch.delete(doc.ref);
	}

	for (const email of emails) {
		batch.set(emailsCollection.doc(email.id), email);
	}

	await batch.commit();
}

export function toSafeUser(user: UserWithPassword): User {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		isVerified: user.isVerified,
		createdAt: user.createdAt,
		twoFactorEnabled: !!user.twoFactorEnabled
	};
}

export async function seedDatabase() {
	const users = await readUsers();

	if (users.length > 0) return;

	const demoUser: UserWithPassword = {
		id: 'usr_demo_user',
		name: 'Alex Recruitment',
		email: 'user@gdgc.edu',
		role: 'user',
		isVerified: true,
		createdAt: new Date().toISOString(),
		passwordHash: bcrypt.hashSync('UserPass123!', 10)
	};

	const demoAdmin: UserWithPassword = {
		id: 'usr_demo_admin',
		name: 'GDGC Admin',
		email: 'admin@gdgc.edu',
		role: 'admin',
		isVerified: true,
		createdAt: new Date().toISOString(),
		passwordHash: bcrypt.hashSync('AdminPass123!', 10)
	};

	await writeUsers([demoUser, demoAdmin]);
}