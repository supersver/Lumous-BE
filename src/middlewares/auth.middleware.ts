import { FirebaseAuthError } from 'firebase-admin/auth';
import { getFirebaseAuth } from '@lib/firebase';
import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import type { FirebaseAuthUser } from '@/types/auth';

const bearerPrefix = 'Bearer ';

const getStringClaim = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const toFirebaseAuthUser = (decodedToken: {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}): FirebaseAuthUser => {
  const email = getStringClaim(decodedToken.email);

  if (!email) {
    throw new AppError(
      'Firebase token is missing a verified email address.',
      401,
      'AUTH_EMAIL_MISSING',
    );
  }

  const user: FirebaseAuthUser = {
    uid: decodedToken.uid,
    email,
  };

  const name = getStringClaim(decodedToken.name);
  const picture = getStringClaim(decodedToken.picture);

  if (name) {
    user.name = name;
  }

  if (picture) {
    user.picture = picture;
  }

  if (typeof decodedToken.email_verified === 'boolean') {
    user.emailVerified = decodedToken.email_verified;
  }

  return user;
};

export const authenticateFirebase = asyncHandler(async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith(bearerPrefix)) {
    throw new AppError('Missing or invalid Authorization header.', 401, 'AUTH_HEADER_INVALID');
  }

  const token = authorization.slice(bearerPrefix.length).trim();

  if (!token) {
    throw new AppError('Missing Firebase ID token.', 401, 'AUTH_TOKEN_MISSING');
  }

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    req.user = toFirebaseAuthUser(decodedToken);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof FirebaseAuthError) {
      throw new AppError('Invalid or expired Firebase ID token.', 401, 'AUTH_TOKEN_INVALID');
    }

    throw error;
  }
});
