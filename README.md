# RetroGamer

A full-featured retro game emulation platform built with React and Supabase integration, leveraging modern web technologies for optimal performance.

## 📚 Table of Contents

1. [Overview](#overview)
2. [Setup & Configuration](#setup--configuration)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [API Documentation](#api-documentation)
7. [Security](#security)
8. [Deployment](#deployment)
9. [Contributing](#contributing)
10. [License](#license)

## 🧠 Overview

RetroGamer is a modern web application that combines HTML5 rendering with Nostalgist emulation libraries to create an immersive retro gaming experience. The platform uses React 18 with Next.js 16+ for optimal server-side rendering and client-side interactivity, backed by Supabase for scalable database and authentication services.

### Current Status

- **Framework**: Next.js 16.1+ (App Router)
- **React Version**: 19.2.4+ (security patched)
- **Build Tool**: Vite 8.0.0
- **Database**: Supabase PostgreSQL
- **Emulation Engine**: Nostalgist 0.21.0

## ⚙️ Setup & Configuration

### Prerequisites

- Node.js 20.9+ (required for Next.js 16)
- npm 8.x or higher (or pnpm/yarn)
- Supabase account with project credentials

### Quick Start

1. **Clone Repository**
```bash
git clone https://github.com/your/repo.git
cd RetroGamer
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment Variables**
```bash
# Copy the example environment file
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (for admin operations)
```

4. **Initialize Database**
```bash
# Apply Supabase migrations
npx supabase db push
```

5. **Start Development Server**
```bash
npm run dev
```
The application will be available at `http://localhost:3000`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | Admin privileges (server-side only) |

*Required for admin features like user management and bulk game imports.

## 💎 Key Features

### Core Gaming Experience
- **Multi-Platform Emulation**: Support for Nintendo 64, Sega Genesis, PlayStation 1, and classic arcade systems via Nostalgist
- **Dynamic Asset Loading**: Progressive loading with Vite's optimized chunking and streaming indicators
- **Save State System**: Cloud-based save states synchronized with Supabase
- **Controller Support**: Gamepad API integration with customizable button mapping

### Social Features
- **User Authentication**: Supabase Auth with email/password and OAuth providers
- **Leaderboards**: Real-time score tracking and competitive rankings
- **Achievement System**: Unlockable achievements with dynamic notifications
- **Social Sharing**: Share game clips and screenshots to social platforms

### Developer Experience
- **Hot Module Replacement**: Instant component updates via Vite
- **TypeScript Support**: Full type safety across the codebase
- **ESLint Integration**: AirBnb style guide enforcement
- **Vitest Testing**: Component and integration tests with coverage reporting
- **Bundle Analysis**: Built-in `next experimental-analyze` for optimization

## 🧱 Technology Stack

### Frontend Core
- **Next.js 16.1.6** (or latest stable)
  - App Router with Server Components by default
  - Cache Components for selective caching (`'use cache'`)
  - Async request APIs (`await cookies()`, `await headers()`)
  - Proxy (`proxy.ts`) for request interception
- **React 19.2.4+** (security patched)
  - `useEffectEvent` for stable callbacks with fresh values
  - `<Activity>` component for state preservation
  - View Transitions API support
- **TypeScript 5.1+** with strict mode

### UI & Styling
- **Tailwind CSS 4.x** (or 3.x if not upgraded)
  - Utility-first CSS framework
  - Custom configuration for game-themed color palette
  - Dark mode default for immersive experience
- **CSS Modules** for component-scoped styles
- **Geist Font** (Vercel's design system font)
  - Geist Sans for interface text
  - Geist Mono for code blocks and metrics

### Backend & Data
- **Supabase Client v2.39.0**
  - PostgreSQL database
  - Real-time subscriptions for live updates
  - Row Level Security (RLS) policies
  - Storage for game assets and user uploads
- **Nostalgist v0.21.0**
  - Browser-based emulation engine
  - Support for multiple retro platforms
  - WebGL acceleration where available

### Build & Development
- **Vite 8.0.0** (primary build tool)
- **Vitest 4.1.0** (testing framework)
- **@vitejs/plugin-react** (React Fast Refresh)
- **ESBuild** (TypeScript compilation)

### Hosting & Deployment
- **Vercel** (recommended)
  - Zero-config deployment
  - Edge Network CDN
  - Automatic image optimization
  - Serverless Functions for API routes
- **Alternative**: Self-hosted with Docker or Node.js server

### Optional Integrations (Marketplace)
- **Neon Postgres** (if migrating from `@vercel/postgres`)
- **Upstash Redis** (if migrating from `@vercel/kv`)
- **Clerk** or **Auth0** for enhanced authentication
- **Stripe** for premium features or donations

## 📁 Project Structure

```
RetroGamer/
├── app/                          # Next.js App Router (if using Next.js)
│   ├── (auth)/                   # Auth route group (private routes)
│   │   ├── layout.tsx
│   │   └── dashboard/
│   ├── (public)/                 # Public route group
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Homepage
│   │   └── game/
│   ├── api/                      # Route Handlers (API endpoints)
│   │   ├── auth/
│   │   ├── games/
│   │   └── saves/
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Root page
│   └── template.tsx              # (optional) for re-mounting
├── src/                          # Source code (alternative structure)
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── games/                # Game-specific components
│   │   ├── layout/               # Layout components
│   │   └── common/               # Shared components
│   ├── lib/                      # Utilities and configurations
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser client
│   │   │   └── server.ts         # Server client (service role)
│   │   ├── db/                   # Database queries and types
│   │   ├── emulation/            # Emulator integration
│   │   └── utils/                # Helper functions
│   ├── styles/                   # Global styles and Tailwind
│   └── types/                    # TypeScript type definitions
├── public/                       # Static assets
│   ├── games/                    # Game ROMs (if self-hosted)
│   ├── icons/                    # Favicon and PWA icons
│   └── og/                       # Social sharing images
├── supabase/                     # Supabase-specific files
│   ├── migrations/               # Database migrations
│   ├── seed.sql                  # Sample data
│   └── config.toml               # Supabase config
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Example env template
├── next.config.ts               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration
├── package.json                 # Dependencies and scripts
├── pnpm-lock.yaml / package-lock.json
├── vercel.json                  # Vercel deployment config
└── README.md                    # This file
```

### File Naming Conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI (appears at URL path) |
| `layout.tsx` | Persistent UI wrapper (shared across routes) |
| `template.tsx` | Like layout but re-mounts on navigation |
| `loading.tsx` | Suspense fallback during data loading |
| `error.tsx` | Error boundary for the route segment |
| `not-found.tsx` | 404 UI for missing content |
| `route.ts` | API endpoint (Route Handler) |
| `opengraph-image.tsx` | Dynamic OG image generator |

## 📡 API Documentation

### Game Library Endpoints

All API routes are defined in `app/api/` as Route Handlers.

**GET /api/games**
```bash
curl http://localhost:3000/api/games?platform=n64&limit=20
```

Response:
```json
{
  "games": [
    {
      "id": "uuid",
      "title": "Super Mario 64",
      "platform": "n64",
      "release_date": "1996-09-29",
      "cover_art_url": "https://...",
      "file_size": 4194304,
      "region": "USA"
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 20
}
```

**Query Parameters**:
- `platform` (optional): Filter by platform (n64, snes, genesis, ps1)
- `limit` (default: 20, max: 100)
- `page` (default: 1)
- `search` (optional): Full-text search in game titles

**POST /api/game/details**
```bash
curl -X POST http://localhost:3000/api/game/details \
  -H "Content-Type: application/json" \
  -d '{"game_id": "12345", "platform": "n64"}'
```

Response:
```json
{
  "game_id": "12345",
  "title": "Super Mario 64",
  "platform": "n64",
  "bios_required": "n64-2.40",
  "controller_mapping": {
    "n64_controller": {
      "button_a": "A",
      "button_b": "B",
      "stick": "Nintendo 64 Joystick"
    }
  },
  "compatibility": "perfect",
  "save_type": "eeprom_4k"
}
```

### Authentication Endpoints

**POST /api/auth/register**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secure123", "username": "gamer123"}'
```

**POST /api/auth/login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secure123"}'
```

Response includes JWT token and user profile:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "gamer123",
    "created_at": "2025-03-19T14:00:00Z"
  }
}
```

### Emulation Endpoints

**GET /api/emulator/status**
```bash
curl http://localhost:3000/api/emulator/status
```

Response:
```json
{
  "status": "idle",
  "active_games": 0,
  "memory_usage": "0MB",
  "emulator_versions": {
    "n64": "2.40.0",
    "snes": "1.52.0",
    "genesis": "1.80.0"
  }
}
```

**POST /api/emulator/load**
```bash
curl -X POST http://localhost:3000/api/emulator/load \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_id": "12345", "platform": "n64"}'
```

### Save State Endpoints

**GET /api/saves**
```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:3000/api/saves
```

**POST /api/saves/upload**
```bash
curl -X POST http://localhost:3000/api/saves/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "save_file=@save_state.sav"
```

## 🔒 Security

### Critical Security Patches

**Next.js 16+ Applications — Multiple CVEs**

This project uses Next.js 16.x with React 19.2.4+, which includes patches for several critical vulnerabilities:

| CVE | Severity | Description | Patched Version |
|-----|----------|-------------|-----------------|
| CVE-2025-66478 / CVE-2025-55182 | Critical (10.0) | Remote code execution via RSC Flight deserialization | next@16.0.11+, react@19.2.4+ |
| CVE-2025-55184 | High (7.5) | Denial of service via crafted requests | next@16.1.5+ |
| CVE-2026-23864 | High (7.5) | Memory exhaustion DoS | next@16.1.5+, react@19.2.4+ |
| CVE-2025-29927 | Critical (9.1) | Middleware auth bypass | next@16.0.11+ |

**Action Required**: Ensure you are running at least:
```bash
npm install next@latest react@latest react-dom@latest
```

For full details, see the [Next.js Security Advisories](https://nextjs.org/security).

### Application Security

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row Level Security (RLS) policies in PostgreSQL
- **Input Validation**: Zod schemas for API input validation
- **Rate Limiting**: Built-in Next.js middleware rate limiting
- **CORS**: Configured per-route with strict origin policy
- **Secrets Management**: Never commit `.env.local`; use Vercel env vars in production

### Data Protection

- **Encryption at rest**: Supabase encrypts database storage
- **Encryption in transit**: HTTPS/TLS 1.3 enforced
- **Backup Strategy**: Daily automated Supabase backups
- **GDPR Compliance**: User data deletion endpoint available

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
```bash
git add .
git commit -m "feat: prepare for deployment"
git push origin main
```

2. **Import Project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project" → "Import Git Repository"
   - Select your repository

3. **Configure Environment Variables**
   - In Vercel Dashboard → Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Set for "Preview" and "Production" environments

4. **Deploy**
   - Automatic on push to main branch
   - Preview URLs for each PR
   - One-click production promotion

5. **Custom Domain (Optional)**
   - Dashboard → Domains → Add Domain
   - Configure DNS records as instructed
   - Automatic SSL certificate provisioning

### Self-Hosted (Docker)

Build and run with Docker:

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t retrogamer .
docker run -p 3000:3000 -e NEXT_PUBLIC_SUPABASE_URL=... retrogamer
```

### CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Type check
        run: npx tsc --noEmit
      - name: Lint
        run: npm run lint
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          scope: ${{ secrets.ORG_ID }}
```

## 🧪 Testing

### Running Tests

```bash
# Watch mode during development
npm test

# Single run
npm run test:run

# With coverage
npm run test:coverage

# UI component tests (Vitest + Testing Library)
npm run test:ui
```

### Test Structure

- **Unit Tests**: `src/__tests__/unit/` - Component and function tests
- **Integration Tests**: `src/__tests__/integration/` - API route and database tests
- **E2E Tests**: `src/__tests__/e2e/` - Playwright browser tests
- **Fixtures**: `src/__tests__/fixtures/` - Test data and mocks

### Testing Best Practices

- Use `@testing-library/react` for component testing
- Mock Supabase client with `mocks/supabase.ts`
- Test async Server Actions with `act()` wrapper
- Use `vi.mock()` for external dependencies
- Aim for 80%+ code coverage

## 🔧 Development Guidelines

### Component Development

**Server Components (default)**:
```tsx
// No 'use client' directive
export default async function GameList() {
  const games = await getGames() // Direct DB access
  return (
    <ul>
      {games.map(game => (
        <li key={game.id}>{game.title}</li>
      ))}
    </ul>
  )
}
```

**Client Components** (add interactivity):
```tsx
'use client'

import { useState } from 'react'

export function GameFilter({ onFilter }) {
  const [query, setQuery] = useState('')

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onFilter(query)}
    />
  )
}
```

### Server Actions (Mutations)

For form submissions and data modifications:

```tsx
// app/lib/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase/server'

export async function createGame(formData: FormData) {
  const supabase = await getServerSupabase()

  const title = formData.get('title') as string
  const platform = formData.get('platform') as string

  const { data, error } = await supabase
    .from('games')
    .insert({ title, platform })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/games') // Invalidate cache
  return { success: true, game: data }
}
```

### Data Fetching

**Parallel Fetching** (Server Components):
```tsx
const [games, users, stats] = await Promise.all([
  fetchGames(),
  fetchUsers(),
  fetchStats()
])
```

**Client-Side Fetching** (SWR/React Query):
```tsx
import useSWR from 'swr'

function GamesPage() {
  const { data: games, error } = useSWR('/api/games', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 30000 // Poll every 30s
  })

  if (error) return <div>Error loading games</div>
  if (!games) return <div>Loading...</div>

  return <GameList games={games} />
}
```

### Caching Strategy

Use Cache Components for expensive operations:

```tsx
'use cache'
import { cacheLife, cacheTag } from 'next/cache'

export async function GameLibrary() {
  'use cache'
  cacheLife('hours') // Cache for 1 hour
  cacheTag('games', 'library') // Tag for invalidation

  const games = await fetchAllGames() // Expensive DB query

  return <GameGrid games={games} />
}
```

Invalidate from Server Actions:
```tsx
'use server'
import { revalidateTag } from 'next/cache'

export async function updateGame(gameId: string, updates: GameUpdates) {
  await db.games.update().where(id).set(updates)
  revalidateTag('games', 'max') // Immediate refresh
}
```

## 📊 Performance Optimization

### Core Web Vitals Targets

| Metric | Target | Current |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | ~1.8s |
| FID (First Input Delay) | < 100ms | ~45ms |
| CLS (Cumulative Layout Shift) | < 0.1 | ~0.05 |
| INP (Interaction to Next Paint) | < 200ms | ~120ms |

### Image Optimization

Always use `next/image` for optimized images:

```tsx
import Image from 'next/image'

<Image
  src="/game-covers/super-mario-64.jpg"
  alt="Super Mario 64"
  width={400}
  height={300}
  priority // For LCP images
  placeholder="blur" // Low-quality placeholder
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Font Optimization

Use `next/font` to prevent layout shift:

```tsx
import { GeistSans, GeistMono } from 'next/font/google'

const geistSans = GeistSans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = GeistMono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export default function RootLayout({ children }) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### Bundle Analysis

Analyze bundle size distribution:

```bash
# Analyze and open in browser
npx next experimental-analyze --serve

# Analyze without serving
npx next experimental-analyze
```

Look for:
- Large dependencies (> 50KB gzipped)
- Unused exports from imports
- Client-side bloat from server components
- Multiple copies of React

### Code Splitting

Leverage automatic code splitting:
- Dynamic imports for heavy components: `const Heavy = dynamic(() => import('./Heavy'))`
- Route-based splitting (automatic with App Router)
- Library splitting in `next.config.ts`:

```ts
const nextConfig = {
  webpack: (config, { defaultLoaders }) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react-vendor',
          chunks: 'all',
        },
      },
    }
    return config
  },
}
```

## 🧹 Code Quality

### ESLint Configuration

```json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### TypeScript Strict Mode

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

## 📝 Contributing

We welcome community contributions! Please follow these guidelines.

### Getting Started

1. **Fork and Clone**
```bash
git clone https://github.com/your-username/RetroGamer.git
cd RetroGamer
git checkout -b feature/your-feature-name
```

2. **Install Dependencies**
```bash
npm ci
```

3. **Set Up Environment**
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. **Run Development Server**
```bash
npm run dev
```

### Development Workflow

1. **Create Feature Branch**
```bash
git checkout -b feature/emulator-improvements
```

2. **Make Changes**
   - Follow TypeScript strict mode
   - Add tests for new functionality
   - Update documentation if needed
   - Run `npm run lint` before committing

3. **Write Tests**
```bash
# New test file: src/__tests__/unit/your-component.test.tsx
import { render, screen } from '@testing-library/react'
import YourComponent from '../YourComponent'

describe('YourComponent', () => {
  it('renders correctly', () => {
    render(<YourComponent />)
    expect(screen.getByText('Expected')).toBeInTheDocument()
  })
})
```

4. **Run Tests**
```bash
npm test
npm run type-check
npm run lint
```

5. **Commit Changes**
```bash
git add .
git commit -m "feat: add N64 controller vibration support"
```

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code restructuring
- `test:` adding or updating tests
- `chore:` maintenance tasks

6. **Push and Open PR**
```bash
git push origin feature/emulator-improvements
```

Then open a Pull Request on GitHub.

### Pull Request Guidelines

- ✅ All tests pass (`npm test`)
- ✅ Type checking passes (`npx tsc --noEmit`)
- ✅ Linting passes (`npm run lint`)
- ✅ No console errors/warnings in browser
- ✅ CHANGELOG.md updated with user-facing changes
- ✅ Code reviewed by at least one maintainer

### Code Review Process

- Maintainers will review your PR within 48 hours
- Address review feedback and push additional commits
- Squash commits before merging (use `git rebase -i`)
- Maintainers will merge and deploy

### Reporting Issues

Found a bug? Have a feature request?

1. Check existing [Issues](https://github.com/your-repo/issues)
2. If new, create an issue with:
   - Clear title
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, browser, Node version)

## 📄 License

MIT License

Copyright (c) 2023 Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🆘 Getting Help

- **Documentation**: [Next.js Docs](https://nextjs.org/docs) | [Supabase Docs](https://supabase.com/docs)
- **Community**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Discord**: Join our [Discord server](https://discord.gg/your-invite)
- **Issues**: [Report a bug](https://github.com/your-repo/issues/new)

---

Made with ❤️ by the RetroGamer team