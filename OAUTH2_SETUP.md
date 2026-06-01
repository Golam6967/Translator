# OAuth2 Google Authentication Setup Guide

This project now uses OAuth2 for Google authentication with a backend verification flow.

## Backend Environment Variables

Create a `.env` file in the `backend` directory with the following:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/almaktaba"

# Firebase (if needed for other features)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Google OAuth2
GOOGLE_CLIENT_ID="your-client-id-from-google-console.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/callback"

# JWT
JWT_SECRET="your-secret-key-for-jwt-tokens"

# Frontend
FRONTEND_URL="http://localhost:5173"
```

## Frontend Environment Variables

Create a `.env` file in the `frontend` directory with the following:

```bash
VITE_API_BASE_URL="http://localhost:5000"
```

## Google Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Go to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:5000/api/auth/callback` (development)
   - `https://yourdomain.com/api/auth/callback` (production)
7. Copy the **Client ID** and **Client Secret**
8. Add them to your `.env` file

## How It Works

### Flow:

1. User clicks "Continue with Google" on login page
2. Frontend calls `GET /api/auth/google` to get the Google authorization URL
3. User is redirected to Google login (where they can select their account)
4. Google redirects back to `GET /api/auth/callback` with authorization code
5. Backend exchanges the code for tokens and creates/updates user in database
6. Backend generates a JWT token and redirects to frontend with token and userId
7. Frontend stores token in localStorage and redirects to dashboard

### Key Endpoints:

- `GET /api/auth/google` - Get Google OAuth authorization URL
- `GET /api/auth/callback` - Handle Google OAuth callback (called by Google)
- `GET /api/auth/verify` - Verify JWT token (requires auth header)

## Database Migration

Run the following command to update the database schema:

```bash
npm run prisma:migrate
```

This adds `googleId` and `avatar` fields to the User model.

## Testing

1. Start backend: `npm run dev` in `/backend`
2. Start frontend: `npm run dev` in `/frontend`
3. Navigate to `http://localhost:5173/login`
4. Click "Continue with Google"
5. Select your Google account
6. You should be redirected to the dashboard

## Troubleshooting

- **"Failed to get authorization URL"**: Check that `GOOGLE_CLIENT_ID` is set correctly
- **"Invalid client"**: Verify Client ID and Secret in Google Console
- **Redirect URI mismatch**: Ensure the redirect URI in Google Console matches `GOOGLE_REDIRECT_URI`
- **Token verification failed**: Check that `JWT_SECRET` is set and consistent
