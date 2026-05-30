import type { FirebaseAuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticateFirebase` after a valid Bearer token is verified. */
      user?: FirebaseAuthUser;
    }
  }
}

export {};
