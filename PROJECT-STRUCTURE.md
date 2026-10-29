# PREMAL KAIZEN — Project Structure Guide

**Last Updated**: 2026-10-29  
**Architecture**: Modular Monolith with Service-Oriented Design

---

## Directory Layout

```
C:\Users\sa945\Desktop\Shopping Website\
│
├── apps/                           # Independently deployable applications
│   │
│   ├── storefront/                 # Customer-facing e-commerce application
│   │   ├── app/                    # Next.js App Router pages
│   │   │   ├── page.tsx            # Homepage (Phase 2)
│   │   │   ├── shop/               # Shop page (Phase 3)
│   │   │   ├── cart/               # Shopping cart (Phase 5)
│   │   │   ├── wishlist/           # Wishlist (Phase 5)
│   │   │   ├── layout.tsx          # Root layout with providers
│   │   │   └── globals.css         # Global styles and CSS reset
│   │   │
│   │   ├── components/             # React components
│   │   │   ├── Header.tsx          # Navigation header
│   │   │   ├── Footer.tsx          # Footer
│   │   │   ├── HeroSection.tsx     # Homepage hero
│   │   │   ├── ProductCard.tsx     # Reusable product card
│   │   │   ├── ProductGrid.tsx     # Product grid (Phase 3)
│   │   │   ├── FilterSidebar.tsx   # Shop filters (Phase 3)
│   │   │   └── SortDropdown.tsx    # Sort controls (Phase 3)
│   │   │
│   │   ├── lib/                    # Business logic and utilities
│   │   │   ├── products.ts         # Product data and filters (Phase 3)
│   │   │   ├── cart-context.tsx    # Cart state management (Phase 5)
│   │   │   ├── wishlist-context.tsx# Wishlist state management (Phase 5)
│   │   │   └── pricing.ts          # Pricing utilities (Phase 5)
│   │   │
│   │   ├── public/                 # Static assets
│   │   │   └── .gitkeep
│   │   │
│   │   ├── package.json            # Storefront dependencies
│   │   ├── tsconfig.json           # TypeScript config
│   │   ├── next.config.ts          # Next.js config
│   │   └── .eslintrc.json          # ESLint config
│   │
│   ├── admin/                      # Admin dashboard application
│   │   ├── app/                    # Next.js App Router pages
│   │   │   ├── page.tsx            # Dashboard home
│   │   │   ├── admin/              # Admin routes
│   │   │   │   ├── products/       # Products management
│   │   │   │   ├── categories/     # Categories management
│   │   │   │   ├── inventory/      # Inventory overview
│   │   │   │   ├── orders/         # Orders management
│   │   │   │   ├── customers/      # Customers management
│   │   │   │   ├── analytics/      # Analytics dashboard
│   │   │   │   └── settings/       # Store settings
│   │   │   ├── layout.tsx          # Root layout with AdminLayout
│   │   │   └── globals.css         # Global styles
│   │   │
│   │   ├── components/             # Admin components
│   │   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   │   ├── Header.tsx          # Page header
│   │   │   └── AdminLayout.tsx     # Admin layout wrapper
│   │   │
│   │   ├── package.json            # Admin dependencies
│   │   ├── tsconfig.json           # TypeScript config
│   │   ├── next.config.ts          # Next.js config
│   │   └── .eslintrc.json          # ESLint config
│   │
│   └── api/                        # NestJS backend API
│       ├── src/                    # TypeScript source
│       │   ├── main.ts             # Application entry point
│       │   ├── app.module.ts       # Root module (imports all services)
│       │   │
│       │   ├── products/           # ProductService module
│       │   │   ├── products.service.ts
│       │   │   ├── products.controller.ts
│       │   │   └── products.module.ts
│       │   │
│       │   ├── cart/               # CartService module
│       │   │   ├── cart.service.ts
│       │   │   └── cart.module.ts
│       │   │
│       │   └── wishlist/           # WishlistService module
│       │       ├── wishlist.service.ts
│       │       └── wishlist.module.ts
│       │
│       ├── package.json            # API dependencies
│       ├── tsconfig.json           # TypeScript config
│       ├── nest-cli.json           # NestJS CLI config
│       └── .eslintrc.json          # ESLint config
│
├── packages/                       # Shared code
│   │
│   ├── types/                      # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── index.ts            # Main exports
│   │   │   ├── api.ts              # API response types
│   │   │   ├── models.ts           # Domain models
│   │   │   └── schemas.ts          # Zod validation schemas
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                         # Shared React components
│       ├── src/
│       │   ├── index.ts            # Main exports
│       │   └── components/
│       │       └── Button.tsx      # Reusable button component
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                           # Project documentation
│   ├── development-roadmap.md      # 10-phase implementation plan
│   ├── design-system.md            # Brand, colors, typography
│   ├── ARCHITECTURE.md             # Microservices architecture
│   ├── PHASE-1-COMPLETION.md       # Phase 1 report
│   ├── PHASE-2-COMPLETION.md       # Phase 2 report
│   ├── PHASE-3-COMPLETION.md       # Phase 3 report
│   ├── PHASE-5-COMPLETION.md       # Phase 5 report
│   ├── cart-wishlist-validation.md # Phase 5 validation
│   ├── MICROSERVICES-ADMIN-PHASE-COMPLETION.md
│   ├── setup-local-dev.md          # Local development guide
│   └── CONTRIBUTING.md             # Development workflow
│
├── UI/                             # Design references (user-supplied)
│   ├── Logo.jpeg                   # Brand logo reference
│   ├── WhatsApp Image ...*.jpeg    # UI/UX reference screenshots
│   └── [other references]
│
├── .github/                        # GitHub configuration
│   └── workflows/                  # CI/CD workflows (planned)
│       ├── ci.yml                  # Linting and type checking
│       ├── test.yml                # Test suite
│       └── deploy.yml              # Deployment pipeline
│
├── .claude/                        # Claude Code configuration
│   └── skills/                     # Installed skills
│       └── microservices-architect/
│
├── package.json                    # Monorepo root
├── pnpm-workspace.yaml             # pnpm workspace configuration
├── tsconfig.json                   # Root TypeScript config
├── tailwind.config.ts              # Tailwind CSS design tokens
├── .eslintrc.json                  # Root ESLint config
├── .prettierrc                      # Code formatting config
├── .gitignore                       # Git ignore rules
├── .env.example                    # Environment variables template
├── README.md                        # Project overview
└── PROJECT-STRUCTURE.md            # This file
```

---

## Application Details

### Storefront (`apps/storefront`)

**Purpose**: Customer-facing e-commerce platform  
**Technology**: Next.js 15, React 19, Tailwind CSS 4  
**Port**: 3000  
**Phases**:
- Phase 2: Homepage, navigation, footer
- Phase 3: Shop, filters, sorting
- Phase 4: Product details (NOT COMPLETED)
- Phase 5: Cart, wishlist (localStorage-based)

**Key Features**:
- Product browsing and search
- Shopping cart with quantities
- Wishlist functionality
- Responsive design (mobile-first)
- WCAG AA accessibility

### Admin (`apps/admin`)

**Purpose**: Staff dashboard for store management  
**Technology**: Next.js 15, React 19, Tailwind CSS 4  
**Port**: 3001  
**Status**: NEW - UI complete, ready for backend integration  
**Sections**:
- Dashboard with KPIs and recent orders
- Products management
- Categories management
- Inventory tracking
- Orders management
- Customers management
- Analytics and reporting
- Store settings

**Design**: Professional, clean, responsive sidebar navigation

### API (`apps/api`)

**Purpose**: Backend REST API for business operations  
**Technology**: NestJS 10, TypeScript 5.3  
**Port**: 3002  
**Status**: Service structure scaffolded, ready for database integration  
**Services**:
- **ProductService** (implemented contracts)
  - Product CRUD operations
  - Search and filtering
  - Category management
- **CartService** (scaffolded for Phase 6)
  - Cart operations
  - Pricing calculations
  - Cart persistence
- **WishlistService** (scaffolded for Phase 6)
  - Wishlist management
  - Add/remove items

**Planned Services** (Phase 6+):
- OrderService: Order processing and fulfillment
- CustomerService: User accounts and authentication
- PaymentService: Payment processing
- NotificationService: Email/SMS communications
- AdminService: Admin-specific operations

---

## Shared Packages

### `packages/types`

**Purpose**: Shared TypeScript types and Zod schemas  
**Used By**: Storefront, Admin, API  
**Contents**:
- API response types
- Domain models (Product, Order, Customer, etc.)
- Zod validation schemas
- Type definitions

### `packages/ui`

**Purpose**: Shared React components  
**Used By**: Storefront, Admin  
**Contents**:
- Button component (with variants and sizes)
- Input component (planned)
- Form components (planned)
- Layout components (planned)

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js | 15.0.0 |
| **Frontend** | React | 19.0.0 |
| **Styling** | Tailwind CSS | 4.0.0 |
| **Backend** | NestJS | 10.0.0 |
| **Backend** | Node.js | 18+ |
| **Database** | PostgreSQL | 16+ (planned) |
| **ORM** | Prisma | 5+ (planned) |
| **Validation** | Zod | 3.22.4 |
| **Testing** | Vitest | (planned) |
| **Testing** | Playwright | (planned) |
| **Package Manager** | pnpm | 12.4.2 |
| **Language** | TypeScript | 5.3.3 |
| **Linting** | ESLint | 8.56.0 |
| **Formatting** | Prettier | 3.2.4 |

---

## Running the Project

### Prerequisites

```bash
# Install pnpm (if not already installed)
npm install -g pnpm

# Node.js 18+ (use nvm or fnm for version management)
node --version
```

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd shopping-website

# Install dependencies (monorepo root)
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start all apps in parallel (3 terminals or use pnpm dev)
pnpm dev

# Or start individually:
# Terminal 1 - Storefront
cd apps/storefront && pnpm dev

# Terminal 2 - Admin
cd apps/admin && pnpm dev

# Terminal 3 - API
cd apps/api && pnpm dev
```

### Development URLs

- **Storefront**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3001
- **Backend API**: http://localhost:3002

### Common Commands

```bash
# Type checking across all apps
pnpm type-check

# Linting across all apps
pnpm lint

# Build all apps for production
pnpm build

# Start production builds
# Terminal 1:
cd apps/storefront && pnpm start
# Terminal 2:
cd apps/admin && pnpm start
# Terminal 3:
cd apps/api && pnpm start

# Format code with Prettier
pnpm format
```

---

## Service Architecture

### API Endpoints (Current & Planned)

**Products Service**:
```
GET    /api/products              - List products
GET    /api/products/:id          - Get product details
POST   /api/products              - Create product (admin)
PUT    /api/products/:id          - Update product (admin)
DELETE /api/products/:id          - Delete product (admin)
```

**Cart Service** (Phase 6+):
```
GET    /api/cart                  - Get current cart
POST   /api/cart/items            - Add item to cart
PUT    /api/cart/items/:id        - Update item quantity
DELETE /api/cart/items/:id        - Remove item from cart
POST   /api/cart/clear            - Clear entire cart
```

**Wishlist Service** (Phase 6+):
```
GET    /api/wishlist              - Get user's wishlist
POST   /api/wishlist              - Add to wishlist
DELETE /api/wishlist/:id          - Remove from wishlist
```

---

## Development Workflow

1. **Create a feature branch** based on the phase
   ```bash
   git checkout -b feature/phase-6-checkout
   ```

2. **Make changes** in the appropriate app/package

3. **Run tests and checks**
   ```bash
   pnpm type-check
   pnpm lint
   pnpm test (when available)
   ```

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat(storefront): add product detail page"
   ```

5. **Create pull request** for review

See `docs/CONTRIBUTING.md` for detailed workflow.

---

## Deployment Architecture

### Development
```
Storefront (localhost:3000)
Admin      (localhost:3001)
API        (localhost:3002)
```

### Production (Phase 6+)
```
Storefront  → Vercel (Next.js)
Admin       → Vercel (Next.js)
API         → Self-hosted or Managed Container (NestJS)
Database    → PostgreSQL (managed or self-hosted)
```

---

## Useful Documentation

| Document | Purpose |
|----------|---------|
| `development-roadmap.md` | 10-phase implementation plan with scope, deliverables, acceptance criteria |
| `design-system.md` | PREMAL KAIZEN brand, colors, typography, spacing |
| `ARCHITECTURE.md` | Detailed microservices architecture, service boundaries, communication |
| `setup-local-dev.md` | Step-by-step local development setup |
| `CONTRIBUTING.md` | Development workflow, branch naming, commit conventions |
| Phase completion reports | What was built in each phase, validation results |

---

## Next Steps

### Immediate (Before Phase 6)
- [ ] Set up PostgreSQL database
- [ ] Implement Prisma ORM schema
- [ ] Integrate database with API services
- [ ] Implement authentication (CustomerService)

### Phase 6 (Checkout & Payments)
- [ ] Implement OrderService
- [ ] Add payment gateway integration
- [ ] Migrate cart/wishlist to server-backed
- [ ] Wire admin panel to API

### Phase 7+ (Scale & Features)
- [ ] Event-driven architecture (Kafka/RabbitMQ)
- [ ] Caching layer (Redis)
- [ ] Email notifications
- [ ] Advanced analytics

---

**Last Updated**: 2026-10-29  
**Maintained By**: Claude Code  
**Status**: Active Development

