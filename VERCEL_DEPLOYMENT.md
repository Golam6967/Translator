# Vercel Deployment Guide

This project is configured for deployment on Vercel. Follow these steps to deploy:

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your project to GitHub (Vercel integrates with GitHub)

## Deployment Steps

### 1. Connect Your Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Select your GitHub repository containing this project
4. Click "Import"

### 2. Configure Environment Variables

In the Vercel dashboard, add the following environment variables:

#### Firebase Configuration (Public)

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

#### Firebase Admin SDK (Private)

```
FIREBASE_ADMIN_SDK_KEY=<paste your full JSON key>
```

#### Database

```
DATABASE_URL=<your database connection string>
```

#### LLM APIs

```
GROQ_API_KEY=<your Groq API key>
```

You can also copy these from your local `.env` file:

```bash
cat .env | grep -v "^#" | grep -v "^$"
```

### 3. Deploy

#### Option A: Automatic Deploy (Recommended)

- Push changes to your main branch on GitHub
- Vercel automatically triggers a build and deployment

#### Option B: Manual Deploy

1. In Vercel Dashboard, go to your project
2. Click "Deployments"
3. Click "Create Deployment" or redeploy existing build

### 4. Verify Deployment

1. Visit your project's URL in Vercel dashboard (e.g., `https://your-project.vercel.app`)
2. Check the "Deployments" tab for build logs
3. Ensure all environment variables are loaded correctly
4. Test the application functionality

## Important Notes

### Backend Routes

The Express backend routes in `/backend` can be integrated into Next.js API routes for seamless serverless deployment. Consider migrating routes from:

- `backend/routes/` → `app/api/` (Next.js API routes)

### Database Migrations

If using Prisma, run migrations before deployment:

```bash
npx prisma migrate deploy
```

### Build Optimization

- TypeScript build errors are currently ignored (set in `next.config.mjs`)
- Images are unoptimized for compatibility
- Consider enabling full TypeScript checking and image optimization in production

### Serverless Functions

- All API calls should be under 12 seconds (Vercel limit)
- Long-running tasks should be moved to background jobs or separate services
- Keep deployment bundle size under limits

## Troubleshooting

### Build Failures

1. Check Vercel Build Logs in the dashboard
2. Verify all environment variables are set
3. Ensure `package.json` has correct dependencies
4. Run `npm run build` locally to reproduce errors

### Runtime Errors

1. Check Function Logs in Vercel dashboard
2. Look for missing environment variables
3. Verify Firebase credentials
4. Check database connectivity

### Performance Issues

1. Enable Edge Caching in Vercel settings
2. Optimize images and bundle size
3. Use ISR (Incremental Static Regeneration) for static pages
4. Monitor with Vercel Analytics (already included)

## Backend Deployment (Optional)

For separate backend deployment:

### Option 1: Deploy to Vercel (Recommended)

Create a separate Vercel project for the backend:

```bash
cd backend
npx vercel
```

### Option 2: Deploy to Other Services

- AWS Lambda
- Google Cloud Run
- Heroku
- Railway
- Render

Update `NEXT_PUBLIC_API_URL` environment variable to point to your backend.

## Monitoring & Analytics

- Vercel Analytics is already integrated (`@vercel/analytics/next`)
- Monitor performance in Vercel Dashboard
- Set up error tracking for production issues
- Enable Vercel Edge Config for feature flags

## Rollback

To rollback to a previous deployment:

1. Go to "Deployments" tab
2. Find the deployment you want to rollback to
3. Click the three dots → "Promote to Production"

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)

---

**Need help?** Check Vercel's support documentation or deploy with the Vercel CLI:

```bash
npm i -g vercel
vercel
```
