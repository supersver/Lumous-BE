# ModelPilot-BE

Production-ready Node.js backend scaffold for the ModelPilot AI chat application.

## Stack

- TypeScript
- Express
- PostgreSQL on Supabase
- Prisma ORM
- Firebase Admin SDK
- dotenv
- ESLint and Prettier

## Getting Started

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

The server starts on `http://localhost:4000` by default.

## Scripts

- `npm run dev` - start the development server with hot reload
- `npm run build` - compile TypeScript into `dist`
- `npm start` - run the compiled server
- `npm run lint` - run ESLint
- `npm run format` - format files with Prettier
- `npm run prisma:migrate:dev` - create and apply a local Prisma migration
- `npm run prisma:migrate:deploy` - apply migrations in production

## Endpoints

- `GET /health` - health check
