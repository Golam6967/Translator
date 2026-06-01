# Al-Maktaba - Islamic Translation Companion

A full-stack application for translating Islamic texts and scriptures across multiple languages. Built with React, Express.js, Supabase, and Firebase.

## Project Structure

```
/frontend - React + Vite frontend application
/backend - Express.js + Node.js backend API
```

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm/pnpm
- Firebase Project (for authentication)
- Supabase Project (for database)
- Groq API Key (for LLM translations)

### Environment Variables

#### Backend (`/backend/.env`)

```
DATABASE_URL=postgresql://user:password@host:5432/almaktaba
GROQ_API_KEY=gsk_your_key_here
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-firebase-project
PORT=5000
NODE_ENV=development
```

#### Frontend (`/frontend/.env.local`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=http://localhost:5000
```

### Backend Setup

```bash
cd backend

# Install dependencies
npm install --legacy-peer-deps

# Setup Prisma
npx prisma migrate dev --name init

# Run development server
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Run development server
npm run dev
```

The frontend will run on `http://localhost:3000`

## Features

### Core Features
- **Text Translation**: Translate text between 6 languages using LangChain + Groq/Gemini
- **User Authentication**: Firebase email/password authentication
- **Notes**: Create, edit, and manage rich text notes
- **Saved Translations**: Save and organize translated content
- **Activity History**: Track all user actions
- **Settings**: Customize language, theme, and preferences

### UI Features
- Light/Dark theme support
- English and Bengali UI language
- Responsive design for desktop, tablet, mobile
- RTL support for Arabic/Persian/Urdu content
- Islamic geometric design patterns
- Text-to-speech for translations

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `GET /api/auth/verify` - Verify token

### Translation
- `POST /api/translate` - Translate text

### Notes
- `POST /api/notes` - Create note
- `GET /api/notes` - List user's notes
- `GET /api/notes/:id` - Get single note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Saved Translations
- `POST /api/saved` - Save translation
- `GET /api/saved` - List saved translations
- `GET /api/saved/:id` - Get single saved translation
- `DELETE /api/saved/:id` - Delete saved translation

### History
- `GET /api/history` - List activity history
- `DELETE /api/history/:id` - Delete history item
- `DELETE /api/history/clear/all` - Clear all history

### User Profile
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## Database Schema

### Users Table
- `id` (UUID)
- `email` (unique)
- `displayName`
- `firebaseUid` (unique)
- `language` (en/bn)
- `theme` (light/dark)
- `defaultSourceLang`
- `fontSize` (small/medium/large)

### SavedTranslation Table
- `id` (UUID)
- `userId` (FK)
- `originalText`
- `sourceLang`
- `translations` (JSON)
- `tags` (array)
- `createdAt`

### Note Table
- `id` (UUID)
- `userId` (FK)
- `title`
- `content`
- `tags` (array)
- `language`
- `createdAt`

### History Table
- `id` (UUID)
- `userId` (FK)
- `type` (enum)
- `data`
- `metadata` (JSON)
- `createdAt`

## Technology Stack

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Firebase Authentication
- Axios
- Zustand (state management)

### Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL (Supabase)
- Firebase Admin SDK
- LangChain
- Groq SDK

## Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## Contributing

Contributions welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue on the GitHub repository.
