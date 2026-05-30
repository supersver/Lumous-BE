import dotenv from 'dotenv';

dotenv.config();

const nodeEnvironments = ['development', 'test', 'production'] as const;

type NodeEnvironment = (typeof nodeEnvironments)[number];

const parseNodeEnv = (value: string | undefined): NodeEnvironment => {
  const environment = value ?? 'development';

  if (!nodeEnvironments.includes(environment as NodeEnvironment)) {
    throw new Error(`Invalid NODE_ENV "${environment}".`);
  }

  return environment as NodeEnvironment;
};

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 4000);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer.');
  }

  return port;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const requireEnv = (key: string, value: string | undefined): string => {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
};

export const env = {
  NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
  PORT: parsePort(process.env.PORT),
  CORS_ORIGINS: parseList(process.env.CORS_ORIGIN, ['http://localhost:3000']),
  CORS_CREDENTIALS: parseBoolean(process.env.CORS_CREDENTIALS, true),
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT ?? '1mb',
  DATABASE_URL: requireEnv('DATABASE_URL', process.env.DATABASE_URL),
  DIRECT_URL: requireEnv('DIRECT_URL', process.env.DIRECT_URL),
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
} as const;
