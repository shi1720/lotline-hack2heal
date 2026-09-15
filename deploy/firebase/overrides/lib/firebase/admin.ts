import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function firebaseApp() {
  if (process.env.K_SERVICE && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error('Emulator authentication is forbidden on Cloud Run.');
  }
  return getApps()[0] ?? initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    credential: applicationDefault(),
  });
}
export const firebaseAuth = () => getAuth(firebaseApp());
export const firestore = () => getFirestore(firebaseApp(), process.env.FIRESTORE_DATABASE_ID || 'lotline');
