import type { User } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import type { AppUser, VerifiedFirebaseUser } from '@/types/auth';

const toAppUser = (user: User): AppUser => ({
  id: user.id,
  firebaseUid: user.firebaseUid,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const isUniqueConstraintError = (error: unknown): error is { code: 'P2002' } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'P2002';

export const authService = {
  async getOrCreateUserFromFirebase(authUser: VerifiedFirebaseUser): Promise<AppUser> {
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid: authUser.uid },
    });

    if (existingUser) {
      return toAppUser(existingUser);
    }

    try {
      const createdUser = await prisma.user.create({
        data: {
          firebaseUid: authUser.uid,
          email: authUser.email,
          name: authUser.name ?? null,
          avatarUrl: authUser.picture ?? null,
        },
      });

      return toAppUser(createdUser);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const userCreatedByConcurrentRequest = await prisma.user.findUnique({
        where: { firebaseUid: authUser.uid },
      });

      if (userCreatedByConcurrentRequest) {
        return toAppUser(userCreatedByConcurrentRequest);
      }

      throw new AppError(
        'A user already exists with this email address but a different Firebase UID.',
        409,
        'AUTH_USER_CONFLICT',
      );
    }
  },

  toAppUser(user: User): AppUser {
    return toAppUser(user);
  },
};
