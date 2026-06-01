# Vercel Deployment Checklist

Before deploying to Vercel, ensure the following:

## ✅ Pre-Deployment Checklist

### 1. Code Quality

- [ ] Run `npm run lint` and fix any errors
- [ ] Test locally with `npm run build` and `npm run start`
- [ ] Remove any development-only code
- [ ] Verify no console.log statements in production code
- [ ] Test all critical user flows

### 2. Environment Variables

- [ ] Copy all variables from `.env` to `.env.example` (without values)
- [ ] Document each environment variable's purpose
- [ ] Add all required environment variables to Vercel dashboard
- [ ] Verify Firebase credentials are correct
- [ ] Test API connections in production environment

### 3. Database

- [ ] Run `npx prisma migrate deploy` in production
- [ ] Verify database URL is correct for production database
- [ ] Backup production database before migration
- [ ] Test database queries with production data

### 4. Files & Configuration

- [ ] Verify `vercel.json` is properly configured
- [ ] Check `next.config.mjs` for production settings
- [ ] Ensure `tsconfig.json` is correct
- [ ] Remove any hardcoded local paths
- [ ] Update API endpoints from localhost to production URL

### 5. Dependencies

- [ ] Run `npm install` to ensure clean install
- [ ] Check for deprecated packages with `npm audit`
- [ ] Fix security vulnerabilities if any
- [ ] Test build with `npm run build`

### 6. Images & Assets

- [ ] Verify all images are accessible
- [ ] Check for broken image links
- [ ] Optimize large images
- [ ] Test favicon and meta images

### 7. Authentication & Security

- [ ] Verify Firebase authentication configuration
- [ ] Test login/signup flows
- [ ] Ensure secure headers are set (configured in next.config.mjs)
- [ ] Test CORS configuration
- [ ] Verify API keys are not exposed in frontend code

### 8. Build & Deploy

- [ ] Push all changes to GitHub
- [ ] Create Vercel project connected to GitHub repository
- [ ] Add all environment variables in Vercel dashboard
- [ ] Trigger initial deployment
- [ ] Monitor build logs for any errors
- [ ] Test deployed application thoroughly

### 9. Post-Deployment

- [ ] Visit deployed URL and verify functionality
- [ ] Test all critical user flows
- [ ] Check browser console for errors
- [ ] Monitor Vercel Analytics
- [ ] Set up error tracking/monitoring
- [ ] Configure domain (if using custom domain)
- [ ] Enable auto-deploy on Git push
- [ ] Set up automatic deployments for staging (if needed)

### 10. Maintenance

- [ ] Monitor Vercel dashboard for issues
- [ ] Set up alerting for deployment failures
- [ ] Document deployment procedures
- [ ] Plan for database backups
- [ ] Regular security audits
- [ ] Monitor API performance

## 🚀 Quick Deploy Command

```bash
# Verify build works locally
npm run build
npm run start

# Push to GitHub
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main

# Then follow Vercel dashboard instructions or use CLI:
npm i -g vercel
vercel
```

## 📋 Environment Variables Template

Copy these to Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_ADMIN_SDK_KEY
DATABASE_URL
GROQ_API_KEY
NEXT_PUBLIC_API_URL
```

## 🆘 If Deployment Fails

1. **Check Build Logs**: Go to Vercel Dashboard → Deployments → Click failed build → View logs
2. **Common Issues**:
   - Missing environment variables → Add to Vercel dashboard
   - Database connection → Verify DATABASE_URL
   - Build errors → Run `npm run build` locally
   - TypeScript errors → Check tsconfig.json
   - Missing dependencies → Run `npm install`

3. **Rollback**: Go to Deployments → Promote previous successful build

## 📞 Need Help?

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Check deployment logs in Vercel Dashboard
- Enable "Debug Logs" in Vercel Project Settings
