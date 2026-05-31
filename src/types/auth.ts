import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';

/** Identity extracted from a verified Firebase ID token. Firebase remains the auth source of truth. */
export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  claims: DecodedIdToken;
};

/** Application user persisted in PostgreSQL and exposed to route handlers. */
export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUser = AppUser;

/** Express request guaranteed to have passed `requireAuth` / `authenticateFirebase`. */
export type AuthenticatedRequest = Request & {
  user: AppUser;
  firebaseAuth: VerifiedFirebaseUser;
};
