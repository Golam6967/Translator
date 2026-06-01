# Vercel Deployment Quick Reference

## 🚀 Quick Start (5 minutes)

```bash
# 1. Verify build works
npm run build && npm run start

# 2. Test at http://localhost:3000

# 3. Push to GitHub
git add .
git commit -m "Ready for Vercel"
git push origin main

# 4. Go to vercel.com → Import from GitHub

# 5. Add environment variables (see below)

# 6. Click Deploy!
```

## 📝 Environment Variables to Add

Copy-paste these into Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_SDK_KEY=
DATABASE_URL=
GROQ_API_KEY=
NEXT_PUBLIC_API_URL=/api
```

**Get values from**: `.env` file or Firebase Console

## 🔐 Security Checklist

- [ ] No API keys in code (use `.env`)
- [ ] No sensitive data in GitHub
- [ ] Environment variables set in Vercel
- [ ] Firebase credentials in `FIREBASE_ADMIN_SDK_KEY` only
- [ ] Database URL secure and non-public

## 📊 Project Structure for Vercel

```
✅ Next.js App (Root) → Deploys to Vercel
├── /app (Next.js pages + API routes)
├── /components (React components)
├── /lib (Utilities)
└── /public (Static files)

⚠️ Backend Folder → Deploy separately OR migrate to /app/api
⚠️ Frontend Folder → Consolidate into Next.js
```

## 🛠️ Common Fixes

| Problem             | Fix                                   |
| ------------------- | ------------------------------------- |
| Build fails         | `npm run build` locally, check errors |
| Missing env vars    | Add to Vercel dashboard               |
| API returns 500     | Check Function Logs in Vercel         |
| Can't connect to DB | Verify `DATABASE_URL` format          |

## 📚 Key Files Created

- **`vercel.json`** - Deployment config
- **`VERCEL_DEPLOYMENT.md`** - Full guide
- **`VERCEL_CHECKLIST.md`** - Pre-flight checklist
- **`API_ROUTES_MIGRATION.md`** - Backend migration
- **`DEPLOYMENT_SUMMARY.md`** - Overview

## 🎯 After Deployment

1. ✅ Test at deployed URL
2. ✅ Check browser console for errors
3. ✅ Monitor Vercel Analytics dashboard
4. ✅ Set up custom domain (optional)
5. ✅ Enable auto-deployment on Git push

## 📞 Useful Links

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Check build logs: Vercel → Deployments → Your build

## ⏱️ Typical Timeline

- Setup: 5 min
- Environment vars: 5 min
- Deploy: 5 min
- Test: 10 min
- **Total: ~25 minutes**

---

📌 **Need detailed help?** See `VERCEL_DEPLOYMENT.md`
