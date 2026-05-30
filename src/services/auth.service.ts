import type { User } from '@prisma/client';
import { prisma } from '@lib/prisma';
import type { FirebaseAuthUser, PublicUser } from '@/types/auth';

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  firebaseUid: user.firebaseUid,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const authService = {
  async getOrCreateUser(authUser: FirebaseAuthUser): Promise<PublicUser> {
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid: authUser.uid },
    });

    if (existingUser) {
      return toPublicUser(existingUser);
    }

    const createdUser = await prisma.user.create({
      data: {
        firebaseUid: authUser.uid,
        email: authUser.email,
        name: authUser.name ?? null,
        avatarUrl: authUser.picture ?? null,
      },
    });

    return toPublicUser(createdUser);
  },
};
