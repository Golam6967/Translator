# OAuth2 Google Authentication Implementation Summary

## Overview

The authentication system has been completely redesigned to use **OAuth2 with a backend verification flow** instead of just frontend Firebase authentication. This allows users to properly select their Google account during login.

## Key Changes

### Backend Changes

#### 1. **New OAuth Routes** (`backend/src/routes/auth.ts`)

- `GET /api/auth/google` - Generates Google OAuth authorization URL
- `GET /api/auth/callback` - Handles Google OAuth callback from Google
- Updated auth middleware to support both JWT and Firebase tokens

#### 2. **Updated Middleware** (`backend/src/middleware/auth.ts`)

- Now supports both JWT tokens and Firebase tokens
- Tries JWT verification first (for OAuth2 flow), falls back to Firebase
- Maintains backward compatibility

#### 3. **Database Schema** (`backend/prisma/schema.prisma`)

- Made `firebaseUid` optional (was required)
- Added `googleId` field for Google OAuth users
- Added `avatar` field to store Google profile pictures

#### 4. **Dependencies**

- Added `google-auth-library` v9.0.0 for OAuth2 client
- Added `jsonwebtoken` v9.0.0 for JWT token generation

### Frontend Changes

#### 1. **Simplified AuthContext** (`frontend/src/contexts/AuthContext.tsx`)

- Removed Firebase-dependent methods (register, login with email/password)
- Replaced with OAuth2-based `loginWithGoogle()` function
- Uses localStorage for token persistence
- Simpler API surface

#### 2. **Updated LoginPage** (`frontend/src/pages/LoginPage.tsx`)

- Removed email/password form
- Single "Continue with Google" button
- Simplified UI focused on OAuth flow

#### 3. **New Auth Callback Page** (`frontend/src/pages/AuthCallbackPage.tsx`)

- Handles redirect from Google OAuth callback
- Extracts token and userId from URL parameters
- Stores auth data in localStorage
- Redirects to dashboard on success

#### 4. **Updated Routing** (`frontend/src/App.tsx`)

- Added `/auth-callback` route for OAuth redirect

#### 5. **Updated ProtectedRoute** (`frontend/src/components/ProtectedRoute.tsx`)

- Changed from checking Firebase user object to checking JWT token
- More compatible with token-based auth

#### 6. **Cleaned Firebase Config** (`frontend/src/lib/firebase.ts`)

- Removed Google OAuth provider code
- Keeps Firebase initialization for other uses

## Authentication Flow

```
1. User clicks "Continue with Google"
   ↓
2. Frontend calls GET /api/auth/google
   ↓
3. Backend returns Google authorization URL
   ↓
4. Frontend redirects user to Google login
   ↓
5. User selects/logs into their Google account
   ↓
6. Google redirects to GET /api/auth/callback with code
   ↓
7. Backend exchanges code for tokens
   ↓
8. Backend creates/updates user in database
   ↓
9. Backend generates JWT token
   ↓
10. Backend redirects to /auth-callback with token & userId
   ↓
11. Frontend stores token in localStorage
   ↓
12. Frontend redirects to /dashboard
```

## Environment Variables Needed

### Backend (.env)

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/callback
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```
VITE_API_BASE_URL=http://localhost:5000
```

## Installation Steps

1. **Install dependencies**:

   ```bash
   cd backend
   npm install
   ```

2. **Update database schema**:

   ```bash
   npm run prisma:migrate
   ```

3. **Set up Google OAuth credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth2 credentials
   - Add redirect URI: `http://localhost:5000/api/auth/callback`

4. **Configure environment variables** as shown above

5. **Start the servers**:

   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

## File Changes Summary

| File                                         | Changes                                 |
| -------------------------------------------- | --------------------------------------- |
| `backend/src/routes/auth.ts`                 | Complete rewrite for OAuth2             |
| `backend/src/middleware/auth.ts`             | Added JWT verification support          |
| `backend/prisma/schema.prisma`               | Added googleId and avatar fields        |
| `backend/package.json`                       | Added google-auth-library, jsonwebtoken |
| `frontend/src/contexts/AuthContext.tsx`      | Simplified for OAuth2 flow              |
| `frontend/src/pages/LoginPage.tsx`           | Removed email/password, OAuth only      |
| `frontend/src/pages/AuthCallbackPage.tsx`    | New file for OAuth callback             |
| `frontend/src/App.tsx`                       | Added auth-callback route               |
| `frontend/src/components/ProtectedRoute.tsx` | Updated to check JWT token              |
| `frontend/src/lib/firebase.ts`               | Removed Google OAuth provider           |

## Benefits of This Approach

✅ **Proper Account Selection**: Users can select their Google account during login
✅ **Secure Backend Verification**: Token exchange happens on backend, not frontend
✅ **Better Privacy**: Google redirect URI only visible to backend
✅ **Session Persistence**: JWT tokens stored in localStorage
✅ **Scalable**: Can add additional OAuth providers (GitHub, Microsoft, etc.)
✅ **Reduced Frontend Complexity**: No Firebase auth logic needed

## Troubleshooting

- **Authorization failed**: Check Google OAuth credentials
- **Redirect URI mismatch**: Ensure callback URL matches Google Console settings
- **Token not persisting**: Check localStorage in browser DevTools
- **Database migration fails**: Ensure PostgreSQL is running and DATABASE_URL is set
