# API Routes Migration Guide - Vercel Deployment

This guide helps migrate the Express backend to Next.js API routes for seamless Vercel deployment.

## Overview

Your project currently has:

- **Backend**: Express server in `/backend` (port 5000)
- **Frontend**: Vite React app in `/frontend`
- **Main App**: Next.js app at root

For Vercel deployment, consolidate backend routes into Next.js API routes.

## Step 1: Create Next.js API Routes Structure

Create the following directory structure:

```
app/
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── signup/route.ts
│   │   ├── logout/route.ts
│   │   └── verify/route.ts
│   ├── translate/
│   │   ├── route.ts
│   │   ├── generate-audio/route.ts
│   │   └── history/route.ts
│   ├── notes/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   └── delete/route.ts
│   ├── saved/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   └── delete/route.ts
│   ├── history/
│   │   └── route.ts
│   ├── users/
│   │   └── route.ts
│   └── health/route.ts
```

## Step 2: Example API Route Conversions

### Example 1: Health Check

**Express** (`backend/src/app.ts`):

```typescript
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

**Next.js API Route** (`app/api/health/route.ts`):

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
```

### Example 2: Translate Endpoint

**Express** (`backend/src/routes/translate.ts`):

```typescript
router.post("/", authenticateToken, async (req, res) => {
  // Handle translation
});
```

**Next.js API Route** (`app/api/translate/route.ts`):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticateToken } from "@/lib/middleware/auth";

export async function POST(request: NextRequest) {
  try {
    // Apply middleware
    const auth = await authenticateToken(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Handle translation logic

    return NextResponse.json({ translations: {} });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### Example 3: Dynamic Routes

**Express**:

```typescript
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  // Delete logic
});
```

**Next.js API Route** (`app/api/saved/[id]/route.ts`):

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  // Delete logic

  return NextResponse.json({ success: true });
}
```

## Step 3: Create Auth Middleware for Next.js

**File**: `lib/middleware/auth.ts`

```typescript
import { NextRequest } from "next/server";
import * as admin from "firebase-admin";

export async function authenticateToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Apply to protected routes
  if (request.nextUrl.pathname.startsWith("/api/protected/")) {
    const user = await authenticateToken(request);
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  return null;
}
```

## Step 4: Update Environment Variables

**In Vercel Dashboard**, add these variables:

```
# Existing
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# New for Backend
FIREBASE_ADMIN_SDK_KEY
DATABASE_URL
GROQ_API_KEY

# API URL
NEXT_PUBLIC_API_URL=/api
```

## Step 5: Update Frontend API Configuration

### For Vite Frontend (`frontend/src/lib/api.ts`):

```typescript
import axios, { AxiosInstance } from "axios";

// Use relative paths for Next.js API routes
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.origin
    ? `${window.location.origin}/api`
    : "http://localhost:3000/api");

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Rest of configuration...
```

### For Main App (`lib/api.ts` - if applicable):

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
```

## Step 6: Handle CORS and Security

Add to `next.config.mjs`:

```javascript
const nextConfig = {
  // ... existing config
  headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type,Authorization",
          },
        ],
      },
    ];
  },
};
```

## Step 7: Initialize Firebase Admin SDK

**File**: `lib/firebase-admin.ts`

```typescript
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || "{}");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
```

## Step 8: Set Up Database Connection

**File**: `lib/db.ts`

```typescript
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;
```

## Step 9: Create Transitionware - Keep Both Active During Migration

While migrating, keep Express backend running and gradually migrate routes:

1. Deploy updated frontend with dual API support
2. Gradually migrate Express routes to Next.js API routes
3. Update frontend to use `/api` endpoints
4. Once all routes migrated, remove Express backend dependency
5. Simplify to single Next.js app for Vercel

## Step 10: Test Locally

```bash
# Terminal 1: Run Next.js dev server
npm run dev

# Terminal 2: Test API endpoints
curl http://localhost:3000/api/health

# Browser: Test application at
http://localhost:3000
```

## Step 11: Deploy to Vercel

```bash
# Commit all changes
git add .
git commit -m "Migrate backend to Next.js API routes for Vercel"
git push origin main

# Vercel will auto-deploy OR manually deploy
vercel
```

## Troubleshooting

### APIs Not Working

- Check `NEXT_PUBLIC_API_URL` in Vercel dashboard
- Verify Prisma client is generated: `npx prisma generate`
- Check API route logs: Vercel Dashboard → Deployments → Function Logs

### CORS Errors

- Add origin to `NEXT_PUBLIC_ALLOWED_ORIGIN` in Vercel
- Update `next.config.mjs` CORS headers
- Use relative paths in frontend API calls

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Run migrations: `npx prisma migrate deploy`
- Check network access in database provider

### Firebase Errors

- Ensure `FIREBASE_ADMIN_SDK_KEY` is valid JSON
- Verify service account has correct permissions
- Test locally with `.env` file first

## Files to Create

Create these files in your Next.js app (`/app/api`):

- `health/route.ts` - Health check endpoint
- `auth/login/route.ts` - Authentication
- `translate/route.ts` - Translation service
- `translate/generate-audio/route.ts` - TTS service
- `notes/route.ts` - Notes management
- `saved/route.ts` - Saved translations
- `history/route.ts` - Translation history
- `users/route.ts` - User management

## Configuration Files to Update

- `.env.example` - Add new variables
- `vercel.json` - Already configured
- `next.config.mjs` - Already configured
- `package.json` - Already configured
- `tsconfig.json` - Already configured

## Backend Dependency Removal

Once all routes are migrated and tested:

1. Remove Express from `package.json`
2. Delete `/backend` folder
3. Delete `/frontend` folder (if consolidated into Next.js)
4. Simplify deployment to single Next.js app
5. Update documentation

## Next Steps

After migration:

1. Monitor Vercel deployments
2. Set up error tracking (Sentry, etc.)
3. Configure custom domain
4. Set up automated testing
5. Plan database backup strategy

---

For detailed Next.js API route documentation, see: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
