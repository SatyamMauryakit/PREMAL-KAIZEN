# Upload storage: local disk vs. S3

The API's `POST /api/uploads/image` endpoint (admin-only, used for product images)
stores files through a pluggable `StorageAdapter` (see
`apps/api/src/uploads/storage/`). Exactly one backend is active at a time, chosen by
`STORAGE_DRIVER`. **Nothing here is provisioned yet** - this documents the
configuration and plan for when it is.

## Configuration

| Variable | Required when | Purpose |
|---|---|---|
| `STORAGE_DRIVER` | always (defaults to `local`) | `local` or `s3` |
| `S3_BUCKET` | `STORAGE_DRIVER=s3` | target bucket name |
| `AWS_REGION` (or `S3_REGION`) | `STORAGE_DRIVER=s3` | bucket's region |
| `S3_KEY_PREFIX` | optional | e.g. `products/` - namespaces uploads within a shared bucket |
| `S3_PUBLIC_BASE_URL` | optional | CDN/custom domain (e.g. CloudFront) to use instead of the raw S3 URL |

If `STORAGE_DRIVER=s3` is set but `S3_BUCKET` or the region is missing, the app
**fails at startup** with a clear error naming exactly what's missing - it never
silently falls back to local disk (which would be ephemeral and empty on every
container restart in production).

**Credentials are never read, constructed, or embedded by this code.** The AWS SDK's
own default provider chain resolves them: an IAM role / instance profile in
production (EKS: IRSA - IAM Roles for Service Accounts), or
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars for local testing against a
real bucket if ever needed.

## IAM permissions (least privilege)

The API only ever calls `PutObject`. It never lists, reads, or deletes objects, and
should not be granted permission to do so:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::<bucket-name>/<S3_KEY_PREFIX>*"
    }
  ]
}
```

## Private/public access strategy

**Recommendation: the bucket stays fully private.** Block Public Access stays
enabled at the bucket level, and the adapter never sets an object ACL (confirmed by
`s3-storage.adapter.spec.ts`).

Product images still need to be publicly viewable without login - that's a real,
unavoidable requirement of a storefront, and presigned URLs are the wrong tool for
it: they expire, defeat HTTP/CDN caching, and would require the backend to mint a
fresh URL on every page render. The correct AWS-native way to get "publicly
viewable, but the bucket itself is never directly internet-accessible" is:

**CloudFront distribution + Origin Access Control (OAC) in front of the private
bucket.** `S3_PUBLIC_BASE_URL` is exactly the hook for this - point it at the
CloudFront domain once that distribution exists, and every new upload's returned
`url` automatically goes through it. No application code changes needed.

If a genuinely private, access-controlled upload feature is ever added later (e.g.
a customer-only document), the adapter interface already supports adding a
`getSignedUrl`-style method without touching the public product-image path - not
built now because nothing in the app currently needs it.

## Migration plan for existing local uploads

As of this phase, 8 real files exist under `apps/api/uploads/`, and every
`ProductImage.url` in the database is an **absolute URL with the current host baked
in** (e.g. `http://localhost:3002/uploads/<hash>.jpg`). This is the one real
constraint on migration:

1. **Switching `STORAGE_DRIVER=s3` only affects uploads made *after* the switch.**
   Existing `ProductImage.url` values are untouched and keep resolving exactly as
   before, as long as the local static route (`/uploads/*` in `main.ts`) keeps
   running. This is why implementing the adapter itself required no data migration
   and no breaking change.
2. **Moving the *existing* files into S3 is a separate, explicit, manual step** -
   not automatic, not part of a normal deploy. When ready:
   - Take a full database backup first (same discipline as the Phase B1 SQLite
     backup).
   - Run a one-off script (not yet written - this is a plan, not code) that: lists
     every `ProductImage` row whose `url` points at the local `/uploads/` path,
     uploads that file's bytes to S3 under a new key, and updates only matching
     rows to the new URL - in a transaction, with a `--dry-run` mode first that
     only prints what it would change.
   - Verify a sample of migrated images actually load from the new URL before
     updating the rest.
   - Keep the local files and the `/uploads/*` static route in place for a
     transition period after the DB rewrite, in case of a rollback.
3. **Do not delete local files or rewrite database rows as part of just adding the
   adapter** - that's this phase's explicit boundary, and the stop condition this
   document exists to satisfy instead of silently doing it.
