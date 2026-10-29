# Local Development Setup Guide

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **pnpm**: 12.0.0 or higher (faster, monorepo-friendly package manager)
- **Git**: 2.30.0 or higher
- **Docker** (optional, for database)

## Step-by-Step Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/premalkaizen/website.git
cd website

# Install dependencies (pnpm is faster than npm)
pnpm install
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local for your local setup
nano .env.local  # or use your preferred editor
```

**Local .env.local defaults:**

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/premal_kaizen
JWT_SECRET=dev-secret-key-change-in-production
API_PORT=3002
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### 3. Database Setup (Optional for Phase 1)

Phase 1 doesn't require a database, but you can set one up for later phases.

**Option A: Docker (Recommended)**

```bash
# Start PostgreSQL container
docker run --name premal-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=premal_kaizen \
  -p 5432:5432 \
  -d postgres:16-alpine

# Verify container is running
docker ps | grep premal-postgres
```

**Option B: Local PostgreSQL**

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql-16
sudo systemctl start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### 4. Run Development Servers

```bash
# Run all three apps in parallel (recommended)
pnpm dev

# Or run individual apps in separate terminals:

# Terminal 1: Storefront (Port 3000)
cd apps/storefront && pnpm dev

# Terminal 2: Admin Panel (Port 3001)
cd apps/admin && pnpm dev

# Terminal 3: Backend API (Port 3002)
cd apps/api && pnpm dev
```

**Expected output:**
```
✅ Storefront ready on http://localhost:3000
✅ Admin Panel ready on http://localhost:3001
✅ API running on http://localhost:3002
```

### 5. Verify Setup

Open a browser and visit:
- **Storefront**: http://localhost:3000 (customer site)
- **Admin Panel**: http://localhost:3001 (staff dashboard)
- **API**: http://localhost:3002 (backend, should return 404 or API routes)

### 6. IDE Setup (VS Code Recommended)

**Install Extensions:**
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- REST Client (for testing API)

**Workspace Settings (.vscode/settings.json):**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Useful Commands

```bash
# Run all linters
pnpm lint

# Fix linting issues automatically
pnpm lint -- --fix

# Format code with Prettier
pnpm format

# Type-check all packages
pnpm type-check

# Build all apps
pnpm build

# Start production build (after building)
pnpm start

# Test (if test scripts are added)
pnpm test
```

## Development Tips

### 1. Monorepo Navigation

```bash
# Run command in specific app
cd apps/storefront && pnpm build

# Or use pnpm filter
pnpm --filter @premal/storefront build

# Run in all apps
pnpm -r run build
```

### 2. Hot Reload

Both Next.js apps (storefront and admin) support hot reload:
- Edit a file in `app/` or `components/`
- Browser automatically refreshes
- No need to restart server

### 3. Debugging

**For storefront/admin (Next.js):**
- Open Chrome DevTools (F12)
- Check Network tab for API calls
- Use `console.log()` in components

**For API (NestJS):**
- API logs appear in terminal
- Add debug logs: `console.log('Debug:', value)`

### 4. Database Inspection (When Set Up)

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d premal_kaizen

# Common commands
\dt          # List tables
\d table     # Describe table
SELECT * FROM users LIMIT 5;  # Query data
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process (macOS/Linux)
kill -9 <PID>

# Or use different port
PORT=3003 pnpm dev
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript/Build Errors

```bash
# Clear Next.js cache
rm -rf .next apps/*/dist

# Rebuild
pnpm build
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -c "SELECT version();"

# Or check via Docker
docker exec premal-postgres psql -U postgres -c "SELECT version();"
```

## IDE Shortcuts (VS Code)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+/` | Toggle Comment |
| `Alt+Shift+F` | Format Document |
| `Ctrl+Shift+T` | Reopen Closed Tab |
| `F2` | Rename Symbol |
| `Ctrl+F` | Find in File |
| `Ctrl+H` | Find and Replace |

## Next Steps

1. **Read Phase 1 Documentation**: Check `docs/design-system.md`
2. **Make Your First Change**: Edit `apps/storefront/app/page.tsx`
3. **Follow Contribution Guide**: See `docs/CONTRIBUTING.md`
4. **Create a Feature Branch**: `git checkout -b feature/your-feature`

## Getting Help

- Check error messages in terminal and browser console
- Review related documentation in `docs/`
- Check GitHub Issues for known problems
- Ask questions in team chat

---

**Congratulations! You now have a local development environment set up.** 🎉

Ready to start development? Check out the Phase 1 tasks in `docs/development-roadmap.md`.
