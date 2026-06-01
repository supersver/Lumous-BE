import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '@config/env';

const algorithm = 'aes-256-gcm';
const version = 'v1';
const ivLengthBytes = 12;

const getEncryptionKey = (): Buffer =>
  createHash('sha256').update(env.API_KEY_ENCRYPTION_SECRET, 'utf8').digest();

export const encryptSecret = (plainText: string): string => {
  const iv = randomBytes(ivLengthBytes);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    version,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

export const decryptSecret = (encryptedValue: string): string => {
  const [storedVersion, iv, authTag, ciphertext] = encryptedValue.split(':');

  if (storedVersion !== version || !iv || !authTag || !ciphertext) {
    throw new Error('Invalid encrypted secret format.');
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
