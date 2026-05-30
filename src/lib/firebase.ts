import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from '@config/env';

let firebaseApp: App | undefined;

const getExplicitFirebaseCredentials = (): ServiceAccount | undefined => {
  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID } = env;

  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !FIREBASE_PROJECT_ID) {
    return undefined;
  }

  return {
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
};

export const getFirebaseApp = (): App => {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  const explicitCredentials = getExplicitFirebaseCredentials();

  firebaseApp = initializeApp({
    credential: explicitCredentials ? cert(explicitCredentials) : applicationDefault(),
    ...(env.FIREBASE_PROJECT_ID ? { projectId: env.FIREBASE_PROJECT_ID } : {}),
  });

  return firebaseApp;
};

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp());
