# Single-EC2 AWS deployment (Docker Compose)

Runs Postgres, API, storefront, admin and Caddy on one small EC2 instance
(t3a.small, Ubuntu 24.04, 25 GB gp3, Elastic IP). Product images go to a private S3
bucket (only `products/*` is public-read); the API uploads with the instance role, no keys.
No load balancer (one instance); add an ALB only when a second instance is needed.

1. Create: S3 bucket, IAM role (SSM core + `s3:PutObject` on `products/*`, backups/ access),
   security group (80/443 public, 3001 from the owner IP only, no SSH, use SSM), Elastic IP.
2. On the instance install `docker.io docker-compose-v2` and the AWS CLI, add swap.
3. Build images on the instance from the repo root. `NEXT_PUBLIC_*` values are baked in at
   build time, so a new IP or domain needs a rebuild:
   - `docker build -f apps/api/Dockerfile --build-arg DATABASE_PROVIDER=postgresql -t premal-api:v2 .`
   - `docker build -f apps/storefront/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://<PUBLIC_IP> -t premal-storefront:v2 .`
   - `docker build -f apps/admin/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://<PUBLIC_IP> --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://<PUBLIC_IP> -t premal-admin:v2 .`
4. Copy `docker-compose.yml`, `Caddyfile.example` (as `Caddyfile`, placeholders filled) and
   `.env.example` (as `.env`, `chmod 600`) to `/opt/premal-kaizen/deploy`.
5. `docker compose up -d postgres`, then run migrations once:
   `docker run --rm --network host -e DATABASE_URL=... -w /app premal-api:v2 apps/api/node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma-postgres/schema.prisma`
6. Start Caddy first (it creates the internal CA the frontends trust for server-side calls), then `docker compose up -d`.
7. Create the first admin from the admin login page ("Create admin account").
8. Backups: install `backup.sh` in cron (`S3_BUCKET` exported), daily pg_dump to `s3://$S3_BUCKET/backups/`
   with a 14-day lifecycle rule on that prefix.

The certificate is self-signed (`tls internal`) until a real domain exists; browsers will warn.
