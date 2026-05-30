import type { FirebaseAuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: FirebaseAuthUser;
    }
  }
}

export {};
