import type { DecodedIdToken } from 'firebase-admin/auth';

export type FirebaseAuthUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  claims: DecodedIdToken;
};
