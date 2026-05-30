import { getFirebaseAuth } from '@lib/firebase';
import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';

const bearerPrefix = 'Bearer ';

const getStringClaim = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export const authenticateFirebase = asyncHandler(async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith(bearerPrefix)) {
    throw new AppError('Missing or invalid Authorization header.', 401, 'AUTH_HEADER_INVALID');
  }

  const token = authorization.slice(bearerPrefix.length).trim();

  if (!token) {
    throw new AppError('Missing Firebase ID token.', 401, 'AUTH_TOKEN_MISSING');
  }

  const decodedToken = await getFirebaseAuth().verifyIdToken(token);
  const decodedClaims = decodedToken as unknown as Record<string, unknown>;
  const name = getStringClaim(decodedClaims.name);
  const picture = getStringClaim(decodedClaims.picture);

  req.user = {
    uid: decodedToken.uid,
    claims: decodedToken,
    ...(decodedToken.email ? { email: decodedToken.email } : {}),
    ...(typeof decodedToken.email_verified === 'boolean'
      ? { emailVerified: decodedToken.email_verified }
      : {}),
    ...(name ? { name } : {}),
    ...(picture ? { picture } : {}),
  };

  next();
});
