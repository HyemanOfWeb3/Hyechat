# HyeChat

HyeChat is a full-stack chat and community application built with React + Vite on the frontend and Express + MongoDB on the backend. It includes chat, stories, communities, notifications, calls, translations, and Stream-based realtime features.

## Stack overview

- Frontend: React 19, Vite 8, Tailwind CSS, DaisyUI, React Router, TanStack Query
- Backend: Node.js 22 LTS, Express 4, MongoDB + Mongoose
- Realtime: Stream Chat + Stream Video + Ably
- Email: Nodemailer
- Translation: Google Cloud Translate + Speech APIs

## Prerequisites

- Node.js 22.20.0 or newer in the 22.x line
- npm 10.9.0 or newer
- MongoDB connection string
- Stream API key and secret
- Ably API key
- Google Cloud credentials or service account JSON for translation/speech features
- SMTP email credentials for auth and notification flows

## Local setup

1. Use the repo Node version:
   - `nvm use` (if using nvm)
   - or install Node 22.20.0+
2. Install frontend deps:
   - `cd frontend && npm install`
3. Install backend deps:
   - `cd ../backend && npm install`
4. Copy the example env files and fill in values:
   - `cp frontend/.env.example frontend/.env`
   - `cp backend/.env.example backend/.env`
5. Start the backend:
   - `cd backend && npm run dev`
6. Start the frontend:
   - `cd frontend && npm run dev`

## Production build

```bash
cd frontend && npm run build
```

## Common scripts

Root scripts:

- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run build`

Backend:

- `npm run dev`
- `npm start`

Frontend:

- `npm run dev`
- `npm run build`
- `npm run lint`

## Environment variables

### Backend

- `NODE_ENV`
- `PORT`
- `CLIENT_URL`
- `MONGO_URI`
- `STREAM_API_KEY`
- `STREAM_API_SECRET`
- `JWT_SECRET_KEY`
- `EMAIL`
- `EMAIL_PASSWORD`
- `ABLY_API_KEY`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `TRANSLATION_MAX_AUDIO_SECONDS`

### Frontend

- `VITE_API_URL`
- `VITE_STREAM_API_KEY`
- `VITE_RECORDING_DESTINATION`

## Deployment notes

The project is configured for Vercel-style hosting with a frontend build output and API routing in [vercel.json](vercel.json). The backend is also served through the Vercel API layer in [api/index.js](api/index.js) while the main Express app is in [backend/src/app.js](backend/src/app.js).

## Security guidance

- Keep secrets in environment variables only.
- Do not commit private service-account JSON or `.env` files.
- Prefer pinned runtime versions in CI and deployment.
- Keep cookie security aligned with the deployed domain and same-site policy.

## Current modernization status

This repo targets Node.js 22 LTS, uses patched security versions for the direct dependency set, and keeps the existing architecture rather than replacing the app stack wholesale.
