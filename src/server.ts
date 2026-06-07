import { createServer } from 'node:http';
import { createApp } from '@/app';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  console.info(`Lumous-BE listening on port ${env.PORT} in ${env.NODE_ENV} mode.`);
});

const shutdown = (signal: string): void => {
  console.info(`${signal} received. Shutting down gracefully.`);

  server.close((error) => {
    void (async () => {
      if (error) {
        console.error('Error while closing HTTP server.', error);
      }

      await prisma.$disconnect();
      process.exit(error ? 1 : 0);
    })();
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection.', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception.', error);
  process.exit(1);
});
