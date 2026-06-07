# Lumous-BE

Production-ready Node.js backend scaffold for the Lumous AI chat application.

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

| Variable       | Use                           | Host                                                     |
| -------------- | ----------------------------- | -------------------------------------------------------- |
| `DATABASE_URL` | App runtime (Prisma Client)   | `*.pooler.supabase.com:6543` with `?pgbouncer=true`      |
| `DIRECT_URL`   | Migrations (`prisma migrate`) | `db.<project-ref>.supabase.co:5432` with user `postgres` |

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
- `POST /api-keys` - verify, encrypt, and store an OpenRouter API key
- `GET /api-keys` - list saved provider keys with masked values
- `DELETE /api-keys/:id` - delete a saved API key owned by the authenticated user
- `GET /models` - list OpenRouter models using the authenticated user's saved API key
- `POST /chats/:chatId/messages` - send a user message and store the OpenRouter assistant response

## Authentication Flow

Firebase is the only authentication provider. The backend does not issue custom JWTs.

1. Frontend signs in with Firebase.
2. Frontend calls `getIdToken()`.
3. Frontend sends `Authorization: Bearer <Firebase ID token>`.
4. Backend verifies the token with Firebase Admin SDK.
5. Backend finds or creates the PostgreSQL `users` row by `firebaseUid`.
6. Backend attaches the PostgreSQL application user to `req.user`.

## API Key Management

Set `API_KEY_ENCRYPTION_SECRET` in `.env` before starting the server. Use a stable random secret with at least 32 characters; changing it later prevents decrypting previously saved keys.

All API key routes require the Firebase ID token header:

```http
Authorization: Bearer <Firebase ID token>
```

### Create API Key

Request:

```bash
curl -X POST http://localhost:4000/api-keys \
  -H "Authorization: Bearer <Firebase ID token>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openrouter","apiKey":"sk-or-v1-your-openrouter-key"}'
```

Response:

```json
{
  "apiKey": {
    "id": "9c67b76f-4f4a-4fd4-9f80-f25cf3b176d8",
    "provider": "openrouter",
    "maskedKey": "sk-or-v1-****abcd",
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-01T10:00:00.000Z"
  }
}
```

### List API Keys

Request:

```bash
curl http://localhost:4000/api-keys \
  -H "Authorization: Bearer <Firebase ID token>"
```

Response:

```json
{
  "apiKeys": [
    {
      "id": "9c67b76f-4f4a-4fd4-9f80-f25cf3b176d8",
      "provider": "openrouter",
      "maskedKey": "sk-or-v1-****abcd",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

### Delete API Key

Request:

```bash
curl -X DELETE http://localhost:4000/api-keys/9c67b76f-4f4a-4fd4-9f80-f25cf3b176d8 \
  -H "Authorization: Bearer <Firebase ID token>"
```

Response: `204 No Content`

## OpenRouter Models

`GET /models` requires an active saved OpenRouter API key for the authenticated user. The backend decrypts the saved key, calls OpenRouter, simplifies the model response, and caches results in memory for 10 minutes.

Request:

```bash
curl http://localhost:4000/models \
  -H "Authorization: Bearer <Firebase ID token>"
```

Response:

```json
[
  {
    "id": "openai/gpt-4o",
    "name": "GPT-4o",
    "contextLength": 128000,
    "pricing": {
      "prompt": "0.0000025",
      "completion": "0.00001"
    }
  }
]
```

## Chat Completions

`POST /chats/:chatId/messages` requires the chat to belong to the authenticated user and requires an active saved OpenRouter API key. The backend stores the user message, loads conversation history, calls OpenRouter Chat Completions, stores the assistant response, and writes a usage log.

Request:

```bash
curl -X POST http://localhost:4000/chats/84d5a5d9-0f9e-46fc-9937-18f2b0fe0a24/messages \
  -H "Authorization: Bearer <Firebase ID token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Explain React Server Components","model":"openai/gpt-4o"}'
```

Response:

```json
{
  "message": {
    "id": "7e1fd14a-0100-45f2-a59c-90fd938cf102",
    "chatId": "84d5a5d9-0f9e-46fc-9937-18f2b0fe0a24",
    "role": "assistant",
    "content": "React Server Components let React render parts of the tree on the server...",
    "promptTokens": 128,
    "completionTokens": 96,
    "totalTokens": 224,
    "createdAt": "2026-06-03T10:00:00.000Z"
  },
  "usage": {
    "promptTokens": 128,
    "completionTokens": 96,
    "totalTokens": 224,
    "estimatedCost": "0.00042",
    "latencyMs": 1432
  }
}
```
