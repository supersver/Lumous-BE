import type { Request } from 'express';

/** Identity extracted from a verified Firebase ID token. */
export type FirebaseAuthUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
};

/** Express request guaranteed to have passed `authenticateFirebase`. */
export type AuthenticatedRequest = Request & {
  user: FirebaseAuthUser;
};

export type PublicUser = {
  id: string;
  firebaseUid: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};
