# PREMAL KAIZEN — Development Roadmap

**Project**: Premium streetwear e-commerce platform  
**Brand**: PREMAL KAIZEN — "Wear Your Vibe. Own Your Story."  
**Status**: Audit & Planning (Step 1 complete)  
**Start Date**: 2026-10-29  
**Architecture**: Modular monolith (Next.js storefront + separate admin + NestJS API + PostgreSQL)

---

## UI Design Mapping to Development Phases

| UI File | Page/Feature | Dev Phase | Priority |
|---------|-------------|-----------|----------|
| `Logo.jpeg` | Brand identity, logo usage | Phase 1, 2 | Critical |
| `WhatsApp Image 2026-10-29 at 12.46.56 PM.jpeg` | Homepage, hero section, featured products | Phase 2 | Phase 1 deliverable |
| `WhatsApp Image 2026-10-29 at 12.46.57 PM.jpeg` | Checkout flow: Information step, delivery address, payment method selection, order summary | Phase 7 | Phase 7 |
| `WhatsApp Image 2026-10-29 at 12.46. PM.jpeg` | Product detail page: PDP, gallery, size selection, pricing, reviews, add-to-cart, buy-now | Phase 4 | Phase 4 |
| `WhatsApp Image 2026-10-29 at 12.46.58 PM.jpeg` | Complete ecosystem: shop page + filters, cart page, wishlist page, order tracking page | Phases 3, 5, 6 | Multi-phase |
| `WhatsApp Image 2026-10-29 at 12.48.07 PM.jpeg` | Customer account dashboard: my orders, wishlist, addresses, profile | Phase 6 | Phase 6 |

**Total design pages**: 6 (+ Logo) covering 10 core user journeys

---

## Project Architecture

### Technology Stack
- **Storefront & Admin**: Next.js 15 (App Router), React 19, TypeScript 5
- **Backend API**: NestJS 10 (Node.js framework) with modular domain structure
- **Database**: PostgreSQL 16 with Prisma ORM 8
- **Styling**: Tailwind CSS 4, shadcn/ui or Radix primitives for components
- **Validation**: Zod for runtime schema validation
- **Testing**: Vitest (unit/integration), Playwright (e2e)
- **DevOps**: Docker, GitHub Actions, Git-based workflow
- **Deployment**: TBD (Vercel for Next.js apps, managed container host for API)

### Deployable Units (3 independent services)
1. **Storefront** (Next.js) — Customer-facing e-commerce site
2. **Admin Panel** (Next.js) — Staff-only management interface
3. **Backend API** (NestJS) — RESTful JSON API

### Database Ownership
- **Monolithic DB**: Single PostgreSQL instance shared by all backend modules
- **Module-level schema ownership**: Each domain module owns its tables (identity, catalog, inventory, cart, checkout, orders, payments, shipping, notifications, admin)
- **No service-to-service DB access**: All cross-module queries go through the API

### Shared Code
- `packages/types/` — TypeScript types and Zod schemas (used by storefront, admin, and API)
- `packages/ui/` — Shared React component library (used by storefront and admin)

---

## Phase-by-Phase Breakdown

### Phase 1 — Project Foundation

**Scope**: Establish project structure, tooling, design tokens, and baseline setup.

**Objectives**:
- Initialize monorepo structure (apps: storefront, admin, api; packages: types, ui)
- Set up TypeScript, ESLint, Prettier, pre-commit hooks
- Define Tailwind CSS design tokens (colors, spacing, typography) matching PREMAL KAIZEN brand
- Create global styles and CSS reset
- Set up Font loading (choose brand-appropriate fonts)
- Configure environment variables and build tooling
- Create .gitignore, README, CI/CD workflow skeleton
- Establish development workflow documentation

**Deliverables**:
- Monorepo with 3 apps + 2 packages
- TypeScript configuration for all packages
- Tailwind CSS config with PREMAL KAIZEN design tokens
- Global stylesheet and font setup
- .env.example, .env.local, and secrets management strategy
- ESLint + Prettier + Husky pre-commit hooks
- GitHub Actions workflow stubs (CI, lint, test)
- Development guide (how to run locally, branch naming, commit conventions)

**Files to Create/Modify**:
```
.
├── .github/
│   └── workflows/
│       ├── ci.yml (stub)
│       ├── lint.yml (stub)
│       └── deploy.yml (stub)
├── apps/
│   ├── storefront/
│   │   ├── app/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── next.config.ts
│   ├── admin/
│   │   └── (similar structure to storefront)
│   └── api/
│       ├── src/
│       ├── package.json
│       ├── tsconfig.json
│       └── nest-cli.json
├── packages/
│   ├── types/
│   │   ├── src/
│   │   │   ├── schemas/ (Zod schemas)
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   └── tsconfig.json
│   └── ui/
│       ├── src/
│       │   └── components/ (stubs)
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── development-roadmap.md (this file)
│   ├── architecture.md (stub)
│   ├── CONTRIBUTING.md (development guide)
│   └── setup-local-dev.md (local development guide)
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── tailwind.config.ts (root)
├── package.json (monorepo root with pnpm workspaces)
├── pnpm-workspace.yaml
└── README.md
```

**Acceptance Criteria**:
- [ ] Monorepo initializes and all packages build without errors
- [ ] TypeScript strict mode enabled; no implicit any
- [ ] ESLint passes on all files
- [ ] Tailwind CSS is configured with custom design tokens
- [ ] All three apps can run locally (storefront on :3000, admin on :3001, api on :3002)
- [ ] Design tokens match PREMAL KAIZEN brand (black, cream, beige, white, typography)
- [ ] README explains monorepo structure and running locally
- [ ] .gitignore excludes node_modules, .env, .DS_Store, build artifacts

**Tests Required**:
- Linting passes
- TypeScript compilation succeeds
- Storefront dev server starts and serves a 200 response
- Admin dev server starts
- API dev server starts
- Environment variables load correctly

**Dependencies**:
- None (foundation phase is independent)

**Known Risks**:
- Monorepo complexity if team is not familiar with pnpm workspaces (mitigation: clear onboarding docs)
- TypeScript version mismatch between packages (mitigation: lock versions in root package.json)

**Estimated Effort**: 1–2 days (setup, configuration, validation)

---

### Phase 2 — Global UI and Homepage

**Scope**: Build header, navigation, homepage hero, featured collections, footer, responsive behavior.

**Objectives**:
- Create header/navigation component (desktop + mobile menu)
- Build homepage hero section with background image and call-to-actions
- Create featured product collection sections
- Build footer with links, social icons, email signup
- Implement mobile navigation (hamburger menu, slide-out drawer)
- Ensure responsive design (mobile, tablet, desktop)
- Set up image optimization (Next.js Image component, WebP/AVIF)

**Reference UI**:
- `WhatsApp Image 2026-10-29 at 12.46.56 PM.jpeg` (homepage hero, nav, product grid, footer)

**Deliverables**:
- Header component with logo, nav links, search icon, account icon, cart icon
- Mobile hamburger menu with slide-out drawer
- Homepage layout with hero section, featured collections, CTAs
- Footer with company info, links, social media, email signup
- Responsive styles for mobile, tablet, desktop
- Asset: Logo placed and sized correctly on all pages
- Image loading strategies (Next.js Image, lazy loading)

**Files to Create**:
```
apps/storefront/
├── app/
│   ├── page.tsx (homepage)
│   ├── layout.tsx (root layout with header/footer)
│   └── globals.css (global styles)
├── components/
│   ├── header/
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   ├── MobileMenu.tsx
│   │   └── Logo.tsx
│   ├── homepage/
│   │   ├── HeroSection.tsx
│   │   ├── FeaturedCollections.tsx
│   │   └── PromoSection.tsx
│   ├── footer/
│   │   └── Footer.tsx
│   └── common/
│       ├── CartIcon.tsx
│       └── SearchBar.tsx
└── public/
    ├── logo.svg
    └── images/
        └── hero-bg.jpg
```

**Acceptance Criteria**:
- [ ] Header displays correctly on desktop and mobile
- [ ] Logo is visible and correctly sized
- [ ] Mobile hamburger menu works (open/close)
- [ ] Homepage hero section matches UI design
- [ ] Featured collections grid shows products (mock data for now)
- [ ] Footer is sticky or at bottom of page
- [ ] Navigation links are clickable (route to placeholders)
- [ ] Responsive design works on common breakpoints (mobile 375px, tablet 768px, desktop 1024px+)
- [ ] Images are optimized (Next.js Image component used)
- [ ] No layout shifts (CLS < 0.1)

**Tests Required**:
- Visual regression test (compare screenshots with reference UI)
- Responsive design test (mobile, tablet, desktop widths)
- Navigation functionality test
- Accessibility test (keyboard navigation, alt text)
- Lighthouse score (Accessibility > 90, Performance > 80)

**Dependencies**:
- Phase 1 (foundation must be complete)

**Known Risks**:
- Image loading/optimization issues (mitigation: use Next.js Image component and webp format)
- Mobile menu not accessible (mitigation: test keyboard nav and screen reader)

**Estimated Effort**: 3–4 days

---

### Phase 3 — Product Catalog

**Scope**: Build shop page, category navigation, product cards, filters, sorting, search, pagination.

**Objectives**:
- Create shop page layout with product grid
- Implement category navigation and filters (category, size, price, color)
- Build product card component (image, name, price, rating, wishlist icon)
- Implement sorting (featured, new, price low-high, price high-low)
- Add search functionality (integrated into header)
- Implement pagination
- Handle empty states and loading states

**Reference UI**:
- `WhatsApp Image 2026-10-29 at 12.46.58 PM.jpeg` (shop page with filters, product grid)

**Deliverables**:
- Shop page at `/shop`
- Filters component (category, size, price range, color)
- Sorting dropdown
- Product card component (reusable)
- Search results page
- Pagination controls
- Empty states and loading skeletons

**Files to Create**:
```
apps/storefront/
├── app/
│   ├── shop/
│   │   ├── page.tsx
│   │   ├── [category]/
│   │   │   └── page.tsx
│   │   └── search/
│   │       └── page.tsx
├── components/
│   ├── shop/
│   │   ├── ShopLayout.tsx
│   │   ├── Filters.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ProductCard.tsx
│   │   ├── SortDropdown.tsx
│   │   └── Pagination.tsx
│   └── common/
│       └── SearchBar.tsx (upgrade from Phase 2)
└── lib/
    └── product-filters.ts (filter logic)
```

**Acceptance Criteria**:
- [ ] Shop page displays product grid
- [ ] Filters work (selecting filters updates grid)
- [ ] Sorting updates product order
- [ ] Search box returns relevant results
- [ ] Product cards match UI design (image, name, price, rating)
- [ ] Pagination works
- [ ] Mobile layout is responsive (single column on mobile)
- [ ] Loading skeleton shows while data loads
- [ ] Empty state shows when no products match filters

**Tests Required**:
- Filter functionality (select filter, verify grid updates)
- Sorting functionality
- Search results accuracy
- Pagination navigation
- Mobile responsiveness
- Accessibility (keyboard navigation through filters and grid)

**API Integration** (placeholder for now):
- `/api/products` (GET, with query params: category, size, price, color, search, sort, page)
- `/api/categories` (GET)
- `/api/filters` (GET, returns available filter options)

**Dependencies**:
- Phase 1 (foundation)
- Phase 2 (header, footer)

**Estimated Effort**: 4–5 days

---

### Phase 4 — Product Detail

**Scope**: Build product detail page (PDP), gallery, size/variant selection, reviews, pricing, add-to-cart interaction.

**Objectives**:
- Create PDP layout with product gallery (main image + thumbnails)
- Implement image carousel/lightbox
- Build size selector with stock availability indicator
- Display pricing and product description
- Show ratings and reviews (mock data)
- Implement "Add to Cart" with quantity selector
- Implement "Buy Now" (redirects to checkout)
- Display shipping and return info
- Handle product variants (color, size, SKU)

**Reference UI**:
- `WhatsApp Image 2026-10-29 at 12.46. PM.jpeg` (PDP, gallery, size selection, reviews)

**Deliverables**:
- Product detail page at `/products/[product-id]`
- Product gallery component with thumbnail selection
- Size selector with stock availability
- Quantity selector
- Add to Cart and Buy Now buttons
- Product description and specs
- Ratings and reviews section
- Shipping and return policy section

**Files to Create**:
```
apps/storefront/
├── app/
│   └── products/
│       └── [id]/
│           └── page.tsx
├── components/
│   ├── product/
│   │   ├── ProductGallery.tsx
│   │   ├── ProductInfo.tsx
│   │   ├── SizeSelector.tsx
│   │   ├── QuantitySelector.tsx
│   │   ├── AddToCartButton.tsx
│   │   ├── ReviewsSection.tsx
│   │   ├── ShippingInfo.tsx
│   │   └── ProductDetails.tsx
│   └── common/
│       └── Rating.tsx
└── lib/
    └── product.ts (product utilities)
```

**Acceptance Criteria**:
- [ ] PDP displays product gallery with multiple images
- [ ] Gallery thumbnail selection works
- [ ] Size selector shows available sizes
- [ ] Size selector indicates out-of-stock states
- [ ] Pricing displays correctly
- [ ] Product description is readable
- [ ] Ratings and reviews display (with mock data)
- [ ] Add to Cart button works (adds to cart state/context)
- [ ] Buy Now button redirects to checkout
- [ ] Quantity selector works (increment/decrement)
- [ ] Mobile layout is responsive
- [ ] Images have proper alt text

**Tests Required**:
- Visual regression (compare with reference UI)
- Gallery navigation (thumbnail selection, image changes)
- Size selector functionality
- Quantity selector (min/max, increment/decrement)
- Add to Cart and Buy Now interactions
- Mobile responsiveness
- Accessibility (alt text, keyboard navigation)

**API Integration** (placeholder):
- `/api/products/[id]` (GET, returns product details, images, variants, reviews)
- `/api/products/[id]/reviews` (GET, returns reviews)

**Dependencies**:
- Phase 1 (foundation)
- Phase 2 (header, footer)
- Phase 3 (product card component reusable logic)

**Estimated Effort**: 4–5 days

---

### Phase 5 — Shopping Cart and Wishlist

**Scope**: Build cart page, wishlist page, item management, price calculations, empty states.

**Objectives**:
- Implement cart state management (Context API or Zustand)
- Create cart page with line items, quantities, remove/update functionality
- Calculate subtotal, shipping, taxes, total
- Implement wishlist toggle on product cards
- Create wishlist page with saved items
- Add to cart functionality from wishlist
- Handle empty cart and empty wishlist states
- Show estimated delivery dates

**Reference UI**:
- `WhatsApp Image 2026-10-29 at 12.46.58 PM.jpeg` (cart page, wishlist page)

**Deliverables**:
- Cart page at `/cart`
- Wishlist page at `/wishlist`
- Cart context/store with add, remove, update, clear actions
- Wishlist context/store
- Price calculation utilities (subtotal, shipping, tax, total)
- Cart summary component (can be reused on checkout)
- Empty cart state
- Empty wishlist state

**Files to Create**:
```
apps/storefront/
├── app/
│   ├── cart/
│   │   └── page.tsx
│   └── wishlist/
│       └── page.tsx
├── components/
│   ├── cart/
│   │   ├── CartPage.tsx
│   │   ├── CartItems.tsx
│   │   ├── CartItem.tsx
│   │   ├── CartSummary.tsx
│   │   ├── PriceCalculation.tsx
│   │   └── EmptyCart.tsx
│   ├── wishlist/
│   │   ├── WishlistPage.tsx
│   │   ├── WishlistItems.tsx
│   │   ├── WishlistItem.tsx
│   │   └── EmptyWishlist.tsx
│   └── common/
│       └── WishlistButton.tsx
├── store/ or context/
│   ├── cart-store.ts (or CartContext.tsx)
│   └── wishlist-store.ts
└── lib/
    └── price-calc.ts
```

**Acceptance Criteria**:
- [ ] Cart page displays line items
- [ ] Quantity can be updated (increment/decrement)
- [ ] Items can be removed from cart
- [ ] Cart summary shows subtotal, shipping, tax, total
- [ ] Cart persists in localStorage or session
- [ ] Wishlist page displays saved items
- [ ] Wishlist items can be added to cart
- [ ] Wishlist items can be removed
- [ ] Wishlist persists
- [ ] Empty cart state shows message and link to shop
- [ ] Empty wishlist state shows message
- [ ] Estimated delivery date displays
- [ ] Mobile layout is responsive

**Tests Required**:
- Add to cart functionality
- Update quantity in cart
- Remove from cart
- Add to wishlist / remove from wishlist
- Price calculations (subtotal, shipping, tax, total)
- Cart persistence
- Wishlist persistence
- Empty states
- Mobile responsiveness

**Dependencies**:
- Phase 1 (foundation)
- Phase 2 (header, footer)
- Phase 4 (product detail, add-to-cart interaction)

**Estimated Effort**: 3–4 days

---

### Phase 6 — Customer Accounts

**Scope**: Build user registration, login, profile, saved addresses, order history, account dashboard.

**Objectives**:
- Create authentication UI (login, registration, password reset)
- Build account dashboard with my orders, wishlist, addresses, profile
- Implement address management (add, edit, delete, set default)
- Display order history with order status
- Show order details (items, dates, tracking)
- Implement profile edit (name, email, phone)
- Add "Track Order" functionality
- Handle account security (password change)

**Reference UI**:
- `WhatsApp Image 2026-10-29 at 12.48.07 PM.jpeg` (account dashboard, my orders, wishlist, addresses)

**Deliverables**:
- Login page at `/auth/login`
- Registration page at `/auth/register`
- Password reset page at `/auth/reset-password`
- Account dashboard at `/account`
- Account pages: Profile, Orders, Wishlist, Addresses
- Address management modal/page
- Order detail page at `/account/orders/[order-id]`
- Authentication context/store
- Protected routes middleware

**Files to Create**:
```
apps/storefront/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── reset-password/
│   │       └── page.tsx
│   ├── account/
│   │   ├── page.tsx (dashboard)
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── addresses/
│   │   │   └── page.tsx
│   │   └── wishlist/
│   │       └── page.tsx
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── PasswordResetForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── account/
│   │   ├── AccountDashboard.tsx
│   │   ├── ProfileForm.tsx
│   │   ├── AddressList.tsx
│   │   ├── AddressForm.tsx
│   │   ├── OrderHistory.tsx
│   │   ├── OrderCard.tsx
│   │   ├── OrderDetail.tsx
│   │   └── AccountNav.tsx
├── store/ or context/
│   └── auth-store.ts (or AuthContext.tsx)
└── lib/
    └── auth.ts (auth utilities)
```

**Acceptance Criteria**:
- [ ] Login form works (validates email/password)
- [ ] Registration form works (creates new user)
- [ ] Password reset flow works
- [ ] Authenticated users can access account pages
- [ ] Non-authenticated users are redirected to login
- [ ] Account dashboard displays user info
- [ ] Profile can be edited
- [ ] Addresses can be added, edited, deleted, set as default
- [ ] Order history shows list of orders with status
- [ ] Order detail page shows items, dates, tracking info
- [ ] Wishlist is accessible from account
- [ ] Session persists (localStorage, cookie, JWT)
- [ ] Logout works
- [ ] Mobile layout is responsive

**Tests Required**:
- Login validation
- Registration validation
- Password reset flow
- Protected route access
- Profile edit functionality
- Address management (add, edit, delete)
- Order history display
- Authentication persistence
- Mobile responsiveness

**API Integration** (placeholder):
- `/api/auth/login` (POST)
- `/api/auth/register` (POST)
- `/api/auth/reset-password` (POST)
- `/api/auth/me` (GET, current user)
- `/api/users/[id]/profile` (GET, PATCH)
- `/api/users/[id]/addresses` (GET, POST, PATCH, DELETE)
- `/api/users/[id]/orders` (GET)
- `/api/orders/[id]` (GET)

**Dependencies**:
- Phase 1 (foundation)
- Phase 2 (header, footer)
- Phase 5 (wishlist persistence)

**Estimated Effort**: 4–5 days

---

### Phase 7 — Checkout

**Scope**: Build multi-step checkout flow (cart review, delivery address, shipping, payment, order confirmation).

**Objectives**:
- Implement multi-step checkout form (Cart → Information → Payment → Review)
- Validate cart contents and quantities
- Delivery address form (new or select saved)
- Shipping method selection and cost calculation
- Tax calculation
- Payment method selection (UPI, Credit Card, Net Banking, COD)
- Order summary and review
- Order confirmation page
- Error handling and recovery
- Implement idempotency for payment processing

**Reference UI**:
- `WhatsApp Image 2026-10-29 at 12.46.57 PM.jpeg` (checkout information step, payment methods, order summary)

**Deliverables**:
- Checkout flow at `/checkout`
- Multi-step form (Cart, Information, Payment, Review)
- Delivery address form
- Shipping method selector with costs
- Payment method selector
- Order summary component
- Order confirmation page at `/checkout/confirmation`
- Error states and retry logic

**Files to Create**:
```
apps/storefront/
├── app/
│   └── checkout/
│       ├── page.tsx
│       ├── confirmation/
│       │   └── page.tsx
│       └── error/
│           └── page.tsx
├── components/
│   ├── checkout/
│   │   ├── CheckoutFlow.tsx
│   │   ├── StepIndicator.tsx
│   │   ├── CartReviewStep.tsx
│   │   ├── InformationStep.tsx
│   │   ├── DeliveryAddressForm.tsx
│   │   ├── ShippingMethodSelector.tsx
│   │   ├── PaymentStep.tsx
│   │   ├── PaymentMethodSelector.tsx
│   │   ├── ReviewStep.tsx
│   │   ├── OrderSummary.tsx (reusable)
│   │   ├── ConfirmationPage.tsx
│   │   └── CheckoutForm.tsx
└── store/
    └── checkout-store.ts (checkout state management)
```

**Acceptance Criteria**:
- [ ] Checkout flow displays 4 steps
- [ ] Step indicator shows current and completed steps
- [ ] Cart review step shows items and allows quantity changes
- [ ] Delivery address form validates address
- [ ] Address can be selected from saved addresses or entered new
- [ ] Shipping methods display with costs
- [ ] Shipping cost updates total
- [ ] Tax is calculated based on address and items
- [ ] Payment methods display (UPI, Credit Card, Net Banking, COD)
- [ ] Review step shows complete order summary
- [ ] "Place Order" button submits order
- [ ] Confirmation page shows order number and details
- [ ] Error states display clear messages
- [ ] Back/next navigation works
- [ ] Mobile layout is responsive
- [ ] Form validation prevents submission with errors

**Tests Required**:
- Multi-step form navigation
- Form validation (address, shipping, payment)
- Price calculation with shipping and tax
- Payment method selection
- Order submission
- Confirmation page display
- Error handling and recovery
- Mobile responsiveness
- Accessibility (form labels, error messages)

**API Integration** (placeholder):
- `/api/checkout/validate` (POST, validates cart and address)
- `/api/shipping/methods` (GET, returns shipping options)
- `/api/shipping/calculate` (POST, calculates shipping cost)
- `/api/tax/calculate` (POST, calculates tax)
- `/api/orders` (POST, creates order)
- `/api/orders/[id]/confirmation` (GET, returns order confirmation)

**Security Considerations**:
- CSRF protection on checkout form
- HTTPS for all checkout pages
- Idempotency keys for order creation
- PCI compliance (if handling cards directly — avoid this, use payment gateway)

**Dependencies**:
- Phase 1 (foundation)
- Phase 2 (header, footer)
- Phase 5 (cart state)
- Phase 6 (authentication, addresses)

**Estimated Effort**: 5–6 days

---

### Phase 8 — Backend and Database

**Scope**: Build NestJS API with all backend services, database schema, authentication, order processing, payment webhooks.

**Objectives**:
- Set up NestJS project structure with modules per domain
- Design and implement PostgreSQL schema (identity, catalog, inventory, cart, orders, payments, shipping, notifications)
- Implement authentication and authorization (JWT, roles, permissions)
- Build product API (list, detail, search, filters)
- Build cart API (add, remove, update)
- Build order API (create, list, detail, update status)
- Build checkout API (validate, create order, confirm payment)
- Build payment webhook handler
- Implement inventory management (stock tracking, reservations)
- Implement shipping integration (calculate costs, print labels)
- Build notification system (email, SMS, webhook)
- Add audit logging
- Implement error handling and validation
- Set up database migrations

**Deliverables**:
- NestJS API project structure
- Database schema (Prisma schema.prisma)
- Database migrations
- Authentication module (JWT, guards, decorators)
- Product module (catalog, search, filters)
- Cart module
- Order module (creation, status tracking, cancellation)
- Checkout module (validation, order creation)
- Payment module (webhook handling, idempotency)
- Inventory module (stock tracking, reservations)
- Shipping module (cost calculation, label generation)
- Notification module (email, SMS, webhooks)
- Admin module (RBAC, permissions)
- Audit logging module
- OpenAPI/Swagger documentation

**Files to Create**:
```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── pricing/
│   │   ├── inventory/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── shipping/
│   │   ├── notifications/
│   │   ├── admin/
│   │   └── audit/
│   └── database/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── seeding/
│           └── seed.ts
├── test/
├── package.json
├── tsconfig.json
└── nest-cli.json

packages/types/
├── src/
│   ├── schemas/
│   │   ├── auth.ts
│   │   ├── products.ts
│   │   ├── orders.ts
│   │   ├── payments.ts
│   │   └── ...other domains
│   ├── api.ts (API response types)
│   └── index.ts
└── package.json
```

**Acceptance Criteria**:
- [ ] API starts on port 3002
- [ ] All CRUD endpoints implemented for each module
- [ ] Authentication works (login returns JWT)
- [ ] Protected endpoints require valid JWT
- [ ] Product filtering works (category, size, price, color)
- [ ] Cart operations work (add, remove, update)
- [ ] Checkout validation works
- [ ] Order creation works
- [ ] Payment webhook handler receives and processes webhook
- [ ] Inventory is updated on order creation
- [ ] Shipping costs are calculated
- [ ] Email notifications are queued/sent
- [ ] Audit log records all mutations
- [ ] Error responses use consistent format
- [ ] OpenAPI documentation is generated

**Tests Required**:
- Unit tests for services and utilities
- Integration tests for API endpoints
- Database transaction tests (order creation with inventory update)
- Authentication and authorization tests
- Payment webhook tests
- Inventory reservation tests
- Error handling and validation tests

**Database Schema**:
Tables include: users, roles, permissions, products, categories, variants, pricing, inventory, cart_items, orders, order_items, order_status_history, addresses, payments, payment_webhooks, shipping_methods, shipments, notifications, audit_log

**Deployment**:
- Docker containerization for API
- Environment variables for secrets (DB_URL, JWT_SECRET, PAYMENT_API_KEY, etc.)
- Database connection pooling

**Dependencies**:
- Phase 1 (foundation)
- Phases 2–7 (inform API design based on frontend needs)

**Estimated Effort**: 6–8 days

---

### Phase 9 — Admin Panel

**Scope**: Build admin interface for staff to manage products, inventory, orders, customers, permissions, reports.

**Objectives**:
- Build admin dashboard with KPIs (sales, orders, customers)
- Product management (list, create, edit, delete, bulk import)
- Category and variant management
- Inventory management (stock levels, stock movements, reservations)
- Order management (list, detail, status updates, refunds, cancellations)
- Payment management (view payments, initiate refunds)
- Shipment management (view shipments, print labels, update tracking)
- Customer management (list, detail, orders, addresses, communication)
- Promotion management (coupons, discounts)
- Staff accounts and permissions (RBAC)
- Reports and analytics (sales, inventory, customer)
- Audit log viewer
- System health and monitoring

**Reference UI**:
- Admin dashboard design (not provided in UI folder; use similar layout patterns to storefront)

**Deliverables**:
- Admin app at separate domain (e.g., admin.premalkaizen.com or /admin)
- Dashboard with KPI cards, charts, recent orders
- Products page with CRUD operations
- Inventory page with stock levels and movements
- Orders page with filters, bulk actions
- Order detail page with status management
- Customers page with list and detail
- Staff accounts page with role/permission management
- Reports page with exportable data
- Audit log viewer

**Files to Create**:
```
apps/admin/
├── app/
│   ├── layout.tsx (admin layout with sidebar)
│   ├── page.tsx (dashboard)
│   ├── products/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── create/
│   │       └── page.tsx
│   ├── inventory/
│   │   └── page.tsx
│   ├── orders/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── customers/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── staff/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── reports/
│   │   └── page.tsx
│   ├── audit-log/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AdminLayout.tsx
│   ├── dashboard/
│   │   ├── KPICard.tsx
│   │   ├── SalesChart.tsx
│   │   ├── OrdersChart.tsx
│   │   └── RecentOrders.tsx
│   ├── products/
│   │   ├── ProductTable.tsx
│   │   ├── ProductForm.tsx
│   │   └── ProductDetail.tsx
│   ├── orders/
│   │   ├── OrderTable.tsx
│   │   ├── OrderDetail.tsx
│   │   └── StatusUpdateModal.tsx
│   └── ...other modules
└── lib/
    └── admin-auth.ts
```

**Acceptance Criteria**:
- [ ] Admin pages require staff authentication
- [ ] Dashboard shows KPIs and recent activity
- [ ] Products can be created, edited, deleted
- [ ] Inventory levels can be updated
- [ ] Orders can be viewed and status updated
- [ ] Refunds can be initiated
- [ ] Customers can be viewed and searched
- [ ] Staff accounts can be created with roles
- [ ] Permissions control access to features
- [ ] Reports can be generated and exported
- [ ] Audit log shows all mutations with user and timestamp
- [ ] Mobile-friendly (admin typically used on desktop, but should be functional on tablet)

**Tests Required**:
- Admin authentication
- RBAC enforcement (staff with limited permissions cannot access restricted features)
- Product CRUD operations
- Inventory updates
- Order status updates
- Report generation
- Audit logging

**Dependencies**:
- Phase 1 (foundation)
- Phase 8 (backend API must be complete for admin to call endpoints)

**Estimated Effort**: 5–6 days

---

### Phase 10 — Testing and Release

**Scope**: Automated testing, accessibility verification, security review, CI/CD setup, staging/production deployment, monitoring.

**Objectives**:
- Write unit tests for shared utilities and components
- Write integration tests for API endpoints
- Write contract tests for API (OpenAPI-driven)
- Write e2e tests for critical flows (add to cart, checkout, login, order)
- Run accessibility audit (axe, Lighthouse)
- Perform security review (OWASP, input validation, auth)
- Set up CI/CD pipelines (lint, test, build, deploy)
- Set up staging environment
- Set up production environment
- Configure secrets management
- Set up monitoring, logging, alerting
- Create deployment runbook
- Set up backup and disaster recovery
- Performance testing (load testing, core web vitals)

**Deliverables**:
- Unit tests (Vitest) for all packages
- Integration tests for API
- E2E tests (Playwright) for critical flows
- Accessibility test report
- Security review checklist
- GitHub Actions workflows (CI/CD)
- Staging deployment
- Production deployment
- Monitoring dashboards
- Logging infrastructure
- Backup strategy
- Deployment runbook
- Incident response plan

**Files to Create/Modify**:
```
.github/workflows/
├── test.yml (run tests on PR)
├── lint.yml (run lint on PR)
├── build.yml (build on main)
├── deploy-staging.yml
└── deploy-production.yml

.env.staging (staging secrets)
.env.production (production secrets)

docs/
├── deployment-runbook.md
├── monitoring-setup.md
├── backup-strategy.md
└── incident-response.md
```

**Acceptance Criteria**:
- [ ] Unit test coverage > 80% for all packages
- [ ] Integration tests pass for all API endpoints
- [ ] E2E tests pass for critical flows
- [ ] Accessibility score > 90 (Lighthouse)
- [ ] Security review checklist passed
- [ ] CI/CD pipelines are automated
- [ ] Staging environment is deployable
- [ ] Production environment is deployable
- [ ] Monitoring is set up and working
- [ ] Logging is centralized and queryable
- [ ] Backup/restore is tested
- [ ] Load testing passes (sub-2s response times at 100 concurrent users)

**Testing Strategy**:
- Unit tests for utilities, schemas, calculations
- Integration tests for API endpoints (authenticated and public)
- E2e tests for: registration → add to cart → checkout → order confirmation; login → browse → add to wishlist; admin: create product → view in storefront
- Accessibility tests (axe, keyboard navigation, screen reader)
- Security tests (OWASP top 10, input validation, auth/authz)

**CI/CD Pipelines**:
- Pull request: lint + unit tests + build
- Main/production branch: lint + tests + build + deploy-staging
- Production release tag: build + deploy-production + smoke tests

**Deployment Strategy**:
- Storefront and Admin: Deploy to Vercel (automatic on git push)
- API: Deploy to containerized host (Fly.io, Render, AWS ECS, etc.)
- Database: Managed PostgreSQL (Neon, RDS, etc.)
- Secrets: Environment variables from hosting platform

**Monitoring**:
- Error tracking (Sentry)
- Logs (Cloud provider or ELK stack)
- Metrics (CPU, memory, response times, request rate)
- Uptime monitoring
- Performance monitoring (Core Web Vitals)

**Dependencies**:
- Phases 1–9 (all functionality must be complete)

**Estimated Effort**: 4–5 days

---

## Project Dependencies and Critical Path

```
Phase 1 (Foundation) [1-2 days]
  ↓
Phase 2 (Homepage) [3-4 days]
  ├→ Phase 3 (Catalog) [4-5 days]
  │   ↓
  │   Phase 4 (Product Detail) [4-5 days]
  │     ↓
  │     Phase 5 (Cart/Wishlist) [3-4 days]
  │       ↓
  │       Phase 7 (Checkout) [5-6 days]
  │         ↓
  │         Phase 8 (Backend) [6-8 days]
  │
  ├→ Phase 6 (Accounts) [4-5 days]
  │   ↓
  │   Phase 8 (Backend) [6-8 days]
  │
  └→ Phase 8 (Backend) [6-8 days]
      ↓
      Phase 9 (Admin Panel) [5-6 days]
        ↓
        Phase 10 (Testing & Release) [4-5 days]
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7 → Phase 8 → Phase 9 → Phase 10

**Can run in parallel after Phase 1**:
- Phases 2, 3, 4, 5 (frontend in parallel with Phase 8 backend, as long as API stubs are available)
- Phase 6 (accounts) can run in parallel with Phases 2–5
- Phase 9 (admin) starts after Phase 8

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| Unclear API contract between frontend and backend | HIGH | MEDIUM | Establish OpenAPI spec early in Phase 1, use contract-driven development |
| Authentication complexity (JWT, RBAC, webhooks) | HIGH | MEDIUM | Use proven libraries (passport, casl, nest guards), test early |
| Payment gateway integration (webhooks, PCI) | HIGH | MEDIUM | Use managed payment service (Stripe), avoid handling card data directly |
| Database schema changes mid-project | MEDIUM | MEDIUM | Use Prisma migrations strictly, test migrations in staging |
| Frontend/backend mismatch in data validation | MEDIUM | MEDIUM | Share Zod schemas in packages/types, keep them in sync |
| Performance issues under load (inventory, cart) | MEDIUM | MEDIUM | Use database transactions, optimize queries, load test early |
| Deployment failures | HIGH | LOW | Test deployment process in staging first, have rollback procedure |

---

## Technology Choices and Justifications

| Choice | Reasoning |
|--------|-----------|
| Next.js + React | Proven, fast, good DX, SEO-friendly, can use for both storefront and admin |
| NestJS over Express | Built-in dependency injection, decorators, module system, OpenAPI integration, better for larger apps |
| Tailwind CSS | Utility-first, fast prototyping, consistent design tokens, good for startups |
| Prisma | Type-safe ORM, migrations, excellent DX, prisma studio, integrated with TypeScript |
| PostgreSQL | Mature, ACID guarantees, good for transactions (orders, payments), JSON support for flexibility |
| Zod | Runtime validation, TypeScript-first, no code generation needed |
| Vitest | Fast, ESM native, Jest-compatible, good for monorepo |
| Playwright | Robust e2e testing, cross-browser, excellent for testing real user flows |

---

## Next Steps and Approval Gate

**Step 1 (this document) is COMPLETE**: Audit, planning, and roadmap creation.

**Next actions pending your approval**:
1. Review this roadmap and adjust phases/scope as needed
2. Decide on deployment platform (Vercel for Next.js apps, hosting for NestJS API, managed DB)
3. Decide on payment gateway (Stripe recommended)
4. Decide on hosting provider for API (Fly.io, Render, AWS ECS, DigitalOcean, etc.)
5. Approve Phase 1 start

**Do NOT proceed to Phase 1 until you explicitly approve this roadmap.**

---

## Questions for You

1. **Scope**: Should any phases be combined or reduced? Any features you want to defer to MVP+?
2. **Payment Gateway**: Stripe (strong recommendation) or another provider?
3. **Authentication**: Roll-your-own JWT, or use managed service (Clerk, Auth0)?
4. **Database Hosting**: Managed PostgreSQL (Neon, Supabase, RDS) or self-hosted?
5. **API Hosting**: Vercel Functions (simple), managed container (Fly.io, Render), or self-hosted?
6. **Timeline**: Do you have a hard deadline for MVP launch?
7. **Team**: Will you be solo, or will there be other developers? This affects parallelization strategy.

