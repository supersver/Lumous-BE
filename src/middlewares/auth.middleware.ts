import { FirebaseAuthError, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAuth } from '@lib/firebase';
import { authService } from '@services/auth.service';
import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import type { VerifiedFirebaseUser } from '@/types/auth';

const bearerPrefix = 'Bearer ';

const getStringClaim = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const toVerifiedFirebaseUser = (decodedToken: DecodedIdToken): VerifiedFirebaseUser => {
  const email = getStringClaim(decodedToken.email);

  if (!email) {
    throw new AppError('Firebase token is missing an email address.', 401, 'AUTH_EMAIL_MISSING');
  }

  const user: VerifiedFirebaseUser = {
    uid: decodedToken.uid,
    email,
    claims: decodedToken,
  };

  const claims = decodedToken as unknown as Record<string, unknown>;
  const name = getStringClaim(claims.name);
  const picture = getStringClaim(claims.picture);

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

const getFirebaseAuthErrorMessage = (code: string): string => {
  if (code === 'auth/id-token-expired') {
    return 'Firebase ID token has expired. Request a fresh ID token from the client.';
  }

  if (code === 'auth/argument-error') {
    return 'Invalid Firebase ID token format. Send the raw Firebase ID token in Authorization: Bearer <token>.';
  }

  return 'Invalid Firebase ID token.';
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
    const firebaseUser = toVerifiedFirebaseUser(decodedToken);

    req.firebaseAuth = firebaseUser;
    req.user = await authService.getOrCreateUserFromFirebase(firebaseUser);

    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof FirebaseAuthError) {
      throw new AppError(getFirebaseAuthErrorMessage(error.code), 401, 'AUTH_TOKEN_INVALID', {
        firebaseCode: error.code,
        firebaseMessage: error.message,
      });
    }

    throw error;
  }
});

export const requireAuth = authenticateFirebase;
