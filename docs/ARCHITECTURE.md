# PREMAL KAIZEN — Microservices Architecture

**Date**: 2026-10-29  
**Version**: 1.0  
**Status**: Foundation Complete - Ready for Phase 6

---

## Executive Summary

PREMAL KAIZEN uses a **modular monolith architecture with service-oriented design patterns**. This approach:
- ✅ Preserves all existing functionality (Phases 1-5)
- ✅ Enables clean separation of concerns
- ✅ Provides a migration path to microservices
- ✅ Requires zero infrastructure overhead today
- ✅ Scales with demand without rearchitecting

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PREMAL KAIZEN Platform                    │
├─────────────────────┬────────────────────┬─────────────────┤
│   Storefront        │     Admin Panel     │   API Gateway   │
│   (Next.js 15)      │     (Next.js 15)    │   (NestJS 10)   │
│                     │                    │                 │
│ - Homepage          │ - Dashboard         │ - ProductService│
│ - Shop & Filters    │ - Products Mgmt     │ - CartService   │
│ - Cart & Wishlist   │ - Orders Mgmt       │ - WishlistServ. │
│ - Product Details   │ - Customers         │ - OrderService* │
│   (Phase 4)         │ - Analytics         │ - CustomerServ. │
│ - Checkout* (Ph 6)  │ - Settings          │ - AuthService*  │
│                     │                    │ - AdminService  │
└─────────────────────┴────────────────────┴─────────────────┘
                           │
                           ↓
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (Single DB) │
                    └──────────────┘
                    
* = Phase 6+ implementation
```

---

## Service Boundaries

### 1. ProductService (Implemented)

**Responsibility**: Manage product catalog, searching, filtering, and metadata.

**Owns**:
- Product data (name, description, SKU, pricing)
- Product categories and attributes
- Product images and metadata
- Inventory levels (reserved for OrderService communication)

**API Contract**:
```
GET    /api/products           - List products with filters
GET    /api/products/:id       - Get product details
POST   /api/products           - Create product (admin)
PUT    /api/products/:id       - Update product (admin)
DELETE /api/products/:id       - Delete product (admin)
```

**Database Tables**:
- `products` - Core product data
- `product_categories` - Category definitions
- `product_images` - Product images

---

### 2. CartService (Scaffolded)

**Responsibility**: Manage shopping cart operations.

**Current Implementation**: Client-side via React Context + localStorage  
**Future Implementation** (Phase 6+): Server-backed with database persistence

**Owns**:
- Cart items and quantities
- Cart metadata (user/session)
- Cart pricing calculations (coordinated with OrderService)

**API Contract** (Phase 6+):
```
GET    /api/cart               - Get current cart
POST   /api/cart/items         - Add item to cart
PUT    /api/cart/items/:id     - Update cart item
DELETE /api/cart/items/:id     - Remove from cart
POST   /api/cart/clear         - Clear cart
```

---

### 3. WishlistService (Scaffolded)

**Responsibility**: Manage user wishlists and saved items.

**Current Implementation**: Client-side via React Context + localStorage  
**Future Implementation** (Phase 6+): Server-backed with database persistence

**Owns**:
- Wishlist items per user
- Wishlist metadata

**API Contract** (Phase 6+):
```
GET    /api/wishlist           - Get user's wishlist
POST   /api/wishlist/:id       - Add product to wishlist
DELETE /api/wishlist/:id       - Remove from wishlist
```

---

### 4. OrderService (Planned - Phase 6)

**Responsibility**: Manage orders, checkout, and fulfillment.

**Owns**:
- Order creation and management
- Order status tracking
- Fulfillment workflow
- **Coordinates with**:
  - CartService: Convert cart to order
  - ProductService: Validate inventory
  - PaymentService: Process payments
  - CustomerService: Link to customer

---

### 5. CustomerService (Planned - Phase 6)

**Responsibility**: Manage customer accounts and authentication.

**Owns**:
- User accounts and profiles
- Authentication and authorization
- Customer preferences
- **Coordinates with**:
  - OrderService: Link orders to customers
  - WishlistService: Store persistent wishlists

---

### 6. AdminService (Planned - Phase 9)

**Responsibility**: Admin operations and store management.

**Owns**:
- Admin user management
- Store configuration
- Reporting and analytics
- **Coordinates with**: All other services

---

## Data Ownership & Boundaries

| Service | Database Tables | Read/Write Access | External Reads | Notes |
|---------|-----------------|-------------------|-----------------|-------|
| ProductService | products, categories, images | RW | Yes (public) | Inventory is RO by OrderService |
| CartService | carts, cart_items | RW (own) | Sync from OrderService | Temporary during checkout |
| WishlistService | wishlists, wishlist_items | RW (own) | No | User-private data |
| OrderService | orders, order_items | RW (own) | Own only | Single source of truth for orders |
| CustomerService | customers, users, sessions | RW (own) | Own only | Authentication data is secure |

**Key Principle**: Each service owns its tables and grants read-only access to other services where needed.

---

## Communication Patterns

### 1. Synchronous (REST API)
Used for:
- Direct data queries (products, customers)
- Immediate operations (add to cart)
- Admin operations

**Example**: CartService queries ProductService for pricing validation

```typescript
// In CartService
const product = await productsService.findById(productId);
const lineTotal = product.price * quantity;
```

### 2. Asynchronous (Event-Driven) - Phase 7+
Used for:
- Order notifications
- Inventory updates
- Email/SMS communications

**Plan**: Kafka/RabbitMQ for events (not implemented yet)

---

## Authentication & Authorization

**Current Status**: No authentication (guest checkout only)

**Phase 6 Plan**:
- JWT-based auth via AuthService
- Role-based access control (RBAC):
  - `customer` - Public shop access
  - `admin` - Admin panel access
  - `system` - Internal service-to-service

**Frontend**: Admin panel checks auth before rendering

---

## Error Handling & Resilience

### Current Implementation
- HTTP status codes (200, 400, 404, 500)
- Service-level try-catch
- Error logging (console for now)

### Phase 6+ Enhancements
- Circuit breakers for cross-service calls
- Retry logic with exponential backoff
- Dead letter queues for failed events
- Centralized error logging (ELK stack)

---

## Configuration Management

**Environment Variables**: `.env.local` (not in git)

**Example**:
```
DATABASE_URL=postgresql://user:pass@localhost/premal_kaizen
API_PORT=3002
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
STRIPE_API_KEY=sk_test_...
```

See `.env.example` for template.

---

## Deployment Strategy

### Current (Phase 5)
- Storefront: Vercel (Next.js)
- Admin: Vercel (Next.js)
- API: Self-hosted or managed container (NestJS)

### Future (Phase 6+)
- **Option A**: Keep monolith, scale horizontally
- **Option B**: Split to microservices on Kubernetes
- **Option C**: Serverless (AWS Lambda) for some services

**Recommended**: Stay with monolith through Phase 7, reassess at Phase 8.

---

## Performance Considerations

### Caching Strategy (Phase 6+)
- **Redis**: Product catalog caching (30-min TTL)
- **Browser**: Assets and CSS (long-lived)
- **CDN**: Product images and static assets

### Query Optimization (Phase 8+)
- Database indexes on frequently filtered columns
- Read replicas for analytics queries
- Pagination (default 20 items/page)

---

## Testing Strategy

### Unit Tests
- Service methods (business logic)
- DTO validation

### Integration Tests
- API endpoints
- Database operations
- Cross-service calls

### E2E Tests
- Storefront user flows
- Admin workflows
- Admin-API integration

**Framework**: Vitest + Playwright

---

## Monitoring & Observability

### Metrics (Phase 7+)
- API response times
- Error rates by service
- Database query performance
- Business metrics (orders, revenue)

### Logging
- Structured logging (Winston)
- Logs aggregated to ELK stack

### Health Checks
```
GET /health - API health
GET /health/db - Database connectivity
GET /health/cache - Redis connectivity
```

---

## Migration Roadmap

### Phase 6: Add Backend Cart & Wishlist
- Move cart/wishlist from localStorage to database
- Add authentication and user sessions
- Implement OrderService

### Phase 7: Optimize & Scale
- Add Redis caching
- Implement event-driven architecture
- Add comprehensive monitoring

### Phase 8: Separate Concerns
- Extract email/notification service
- Add search service (Elasticsearch)
- Optimize database queries

### Phase 9: Microservices (Optional)
- Deploy services independently
- Implement API gateway (Kong/AWS API Gateway)
- Add service mesh (Istio) if needed

---

## Security Considerations

### Current
- Storefront: HTTPS enforced
- API: CORS configured for storefront
- Admin: No auth (development only)

### Phase 6+
- OAuth2/JWT authentication
- Role-based access control
- API rate limiting
- Input validation with Zod
- SQL injection prevention (Prisma ORM)
- XSS protection (React, CSP headers)

### Data Protection
- Passwords: bcrypt hashing
- Sensitive data: Encrypted at rest
- PII: GDPR compliance (Phase 8+)

---

## Conclusion

This architecture provides:
✅ **Clear separation of concerns** - Easy to understand, test, and maintain  
✅ **Scalability path** - From monolith to microservices  
✅ **Team structure** - Services can be owned by teams  
✅ **No technical debt** - No premature optimization  
✅ **Flexibility** - Can pivot to serverless or add services easily

**Ready for**: Phase 6 (checkout, authentication, order management)

---

**See also**:
- [`development-roadmap.md`](./development-roadmap.md) — 10-phase plan
- [`ARCHITECTURE-DECISIONS.md`](./ARCHITECTURE-DECISIONS.md) — Detailed ADRs (coming soon)

