import cors, { type CorsOptions } from 'cors';
import express from 'express';
import { env } from '@config/env';
import { errorHandler, notFoundHandler } from '@middlewares/error.middleware';
import { requestLogger } from '@middlewares/request-logger.middleware';
import routes from '@routes/index';

const corsOptions: CorsOptions = {
  origin: env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS,
  credentials: env.CORS_CREDENTIALS,
};

export const createApp = (): express.Express => {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors(corsOptions));
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));
  app.use(requestLogger);

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
