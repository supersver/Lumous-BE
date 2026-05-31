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
# Fill DATABASE_URL (pooler :6543) and DIRECT_URL (db.<ref>.supabase.co :5432)
# from Supabase > Database > Connect
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

### Supabase + Prisma URLs

| Variable | Use | Host |
| --- | --- | --- |
| `DATABASE_URL` | App runtime (Prisma Client) | `*.pooler.supabase.com:6543` with `?pgbouncer=true` |
| `DIRECT_URL` | Migrations (`prisma migrate`) | `db.<project-ref>.supabase.co:5432` with user `postgres` |

Copy both strings from the Supabase dashboard. URL-encode special characters in the database password. Do not wrap the password in brackets.

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
- `GET /auth/me` - current PostgreSQL user, synced from a verified Firebase ID token
- `GET /chats` - protected route example using `req.user`
- `GET /usage` - protected route example using `req.user`
- `GET /api-keys` - protected route example using `req.user`

## Authentication Flow

Firebase is the only authentication provider. The backend does not issue custom JWTs.

1. Frontend signs in with Firebase.
2. Frontend calls `getIdToken()`.
3. Frontend sends `Authorization: Bearer <Firebase ID token>`.
4. Backend verifies the token with Firebase Admin SDK.
5. Backend finds or creates the PostgreSQL `users` row by `firebaseUid`.
6. Backend attaches the PostgreSQL application user to `req.user`.
