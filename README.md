# PREMAL KAIZEN

Premium streetwear e-commerce platform. "Wear Your Vibe. Own Your Story."

## Project Structure

This is a monorepo containing three independently deployable applications - no code is shared between them:

```
premal-kaizen/
├── apps/
│   ├── storefront/     # Customer-facing e-commerce website (Next.js)
│   ├── admin/          # Staff management interface (Next.js)
│   └── api/            # Backend API (NestJS)
└── docs/               # Project documentation
```

## Quick Start

### Prerequisites
- Node.js 24.21.0 (see `.nvmrc`)
- pnpm 12+

### Installation

```bash
# Install dependencies (monorepo)
pnpm install

# Run all apps in development mode
pnpm dev

# Build all apps
pnpm build

# Lint and format all code
pnpm lint
pnpm format
```

### Development Servers

After running `pnpm dev`:

- **Storefront**: http://localhost:3000
- **Admin Panel**: http://localhost:3001
- **Backend API**: http://localhost:3002

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript 5
- **Backend**: NestJS 10, Node.js
- **Database**: PostgreSQL 16, Prisma ORM 8
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest, Playwright
- **Package Manager**: pnpm

## Documentation

- [`docs/development-roadmap.md`](./docs/development-roadmap.md) — 10-phase development plan
- [`docs/design-system.md`](./docs/design-system.md) — Brand colors, typography, spacing
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — Development guidelines

## Design System

PREMAL KAIZEN uses a premium, minimal aesthetic inspired by Japanese Kaizen philosophy (continuous improvement).

**Color Palette**:
- Black: `#000000` (primary, depth)
- Cream: `#F5F1ED` (secondary backgrounds, cards)
- Beige: `#D4C5B9` (accents, prices)

**Typography**: Modern sans-serif headlines, clean body text

See [`docs/design-system.md`](./docs/design-system.md) for complete design tokens.

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Lint and format: `pnpm lint && pnpm format`
4. Commit with clear messages: `git commit -m "feat: add feature"`
5. Push and create a pull request

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Run ESLint on all code |
| `pnpm type-check` | Run TypeScript compiler on all packages |
| `pnpm test` | Run all tests |
| `pnpm format` | Format code with Prettier |

## Project Phases

**Phase 1** (Current): Project Foundation & Design System ✅
**Phase 2**: Homepage & Navigation
**Phase 3**: Product Catalog
**Phase 4**: Product Details
**Phase 5**: Cart & Wishlist
**Phase 6**: Customer Accounts
**Phase 7**: Checkout
**Phase 8**: Backend API
**Phase 9**: Admin Panel
**Phase 10**: Testing & Deployment

See [`docs/development-roadmap.md`](./docs/development-roadmap.md) for details.

## License

© 2026 PREMAL KAIZEN. All rights reserved.
