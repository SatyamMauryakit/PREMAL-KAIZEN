# DATABASE-READINESS.md

Date: 2026-11-11. Database: **SQLite** (confirmed, explicit, deliberate choice —
PostgreSQL migration was in scope for this round but declined, see
`GITHUB-RELEASE-SUMMARY.md` for the decision record). `schema.postgres-test.prisma`
exists in the repo as groundwork for later, not active.

## Schema and migrations

27 models (`User`, `Session`, `VerificationToken`, `Address`, `Product`, `Category`,
`ProductImage`, `CartItem`, `WishlistItem`, `Order`, `OrderItem`, `Invoice`,
`NotificationEvent`, `OrderStatusEvent`, `Inventory`, `InventoryAdjustment`,
`InventoryAuditLog`, `Promotion`, `CouponCode`, `CouponRedemption`, `StoreSettings`,
`PaymentWebhookEvent`, `SettingsAuditLog`, `AdminAuditLog`, `ContactMessage`, `Review`).
Migration history under `apps/api/prisma/migrations/` is fully tracked, provider-locked
to `sqlite` (`migration_lock.toml`), and every migration applied during this engagement
used the safe additive "redefine table" pattern (confirmed for the OTP-attempt-tracking
column, the earlier RBAC/reviews/invoice additions, etc.) — no destructive rewrites.

## Indexes and constraints

`@@index`/`@@unique` annotations are present throughout (e.g. `VerificationToken.token`
unique, `WishlistItem` unique on `(userId, productId)`, `NotificationEvent.idempotencyKey`
unique, `PaymentWebhookEvent` unique on `(provider, eventId)`, numerous `@@index` on
hot lookup fields like `orderId`, `status`, `createdAt`). Foreign keys carry explicit
`onDelete` behavior (`Cascade` for genuinely dependent rows — e.g. a user's sessions,
addresses, cart/wishlist items, orders; `Restrict` for `OrderItem → Product`, correctly
preventing a product from being deleted while a real order still references it;
`SetNull` for `Order → Promotion`). Two models (`NotificationEvent`, `OrderStatusEvent`)
deliberately use a plain scalar `orderId` with **no** cascade — by design, so an audit
trail survives even if the order row itself were ever removed; this was accounted for
explicitly (not missed) during this session's data cleanup, which deleted those rows
itself rather than relying on a cascade that doesn't exist for them.

## Transactions

Order creation (`OrdersService.create`) runs inside a single `$transaction`: line-item
validation, stock decrement (`InventoryService.decrementForOrder`), and — as of this
engagement's cart-clear-on-order fix — the customer's cart is now cleared in the same
transaction. If any variant is out of stock, the whole transaction rolls back: no order,
no stock taken, no cart cleared. This was live-verified this session (DB `CartItem`
table confirmed empty immediately after order creation, not dependent on a best-effort
frontend call).

## Duplicate order / payment prevention

- Payment webhook idempotency via `(provider, eventId)` unique constraint — a retried
  Razorpay delivery is detected and skipped.
- Payment verification is conditional (`updateMany` with `paymentVerifiedAt: null` as a
  guard) so a race between the browser callback and the webhook can't double-process
  the same payment.
- Stale/abandoned unpaid online orders are auto-cancelled with stock restored
  (`StaleOrderCleanupService`, unit-tested).

## Inventory consistency

Stock decrements happen atomically with order creation (not at payment confirmation —
matches how COD orders, which never get a separate "payment confirmed" event, still
correctly reserve stock). Inventory audit log + adjustment history tables exist and are
populated on every stock change, giving a real trail rather than inferring history from
`updatedAt`.

## Production database initialization (Phase 7 of the mega-prompt)

Already performed this engagement, immediately before this audit — see
`docs/production/CLEANUP-REPORT.md` for the full record:

- All sample/dev customer, session, order, cart, payment, coupon, and audit-log records
  removed (counts documented per-table in that report).
- The real 49-product catalog, all 13 categories, and the `StoreSettings` business
  configuration were explicitly preserved (confirmed not sample data) — flagged and
  confirmed with the repository owner before proceeding, since the cleanup prompt's
  literal instruction would have deleted them.
- Zero admin accounts remain; the existing bootstrap mechanism is live and ready.
- A full pre-cleanup backup exists (`backups/dev.db.pre-cleanup.20261111_181605.bak`,
  now gitignored, not tracked).
- No destructive command was run against any database other than the confirmed local
  `apps/api/prisma/dev.db` — `DATABASE_URL` was read and confirmed before the cleanup
  transaction ran.

## Connection handling

`PrismaService` (confirmed present, `onModuleDestroy` wired into `app.enableShutdownHooks()`
in `main.ts`) closes its connection cleanly on `SIGTERM`/`SIGINT` — matters for a clean
pod restart during a Kubernetes rolling update on the single-EC2 `kind` cluster.

## Verdict

Ready for the chosen SQLite/single-EC2 path. No orphaned records, no sample data, real
business data (catalog + settings) intact, migrations safe and complete.
