import type { AppUser, VerifiedFirebaseUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** PostgreSQL application user set after Firebase token verification and user sync. */
      user?: AppUser;
      /** Verified Firebase identity for auth-only metadata; do not return this as the app user. */
      firebaseAuth?: VerifiedFirebaseUser;
    }
  }
}

export {};
