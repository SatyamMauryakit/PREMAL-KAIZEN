# PREMAL KAIZEN - AWS Deployment Guide

Complete documentation of the AWS setup: every resource, how it was created, how it is
configured, how to operate it, and how to rebuild it from scratch.

- Region: `ap-south-1` (Mumbai)
- Deployed: 2026-11-22
- Style: single small EC2 instance, Docker Compose, private-by-default S3, daily database backups, minimum cost
- This repo is public. Real resource IDs (account, instance, security group, IPs) are deliberately **not**
  written here; they appear as `<PLACEHOLDERS>`. Keep the real values in `RESOURCES.local.md` (git-ignored).

## Contents

1. [Architecture](#1-architecture)
2. [Resource inventory](#2-resource-inventory)
3. [Network and security](#3-network-and-security)
4. [Compute: EC2 and Docker](#4-compute-ec2-and-docker)
5. [Reverse proxy and TLS (Caddy)](#5-reverse-proxy-and-tls-caddy)
6. [Database: PostgreSQL](#6-database-postgresql)
7. [Storage: S3 (images, backups, artifacts)](#7-storage-s3-images-backups-artifacts)
8. [IAM](#8-iam)
9. [Configuration and environment variables](#9-configuration-and-environment-variables)
10. [Create everything from scratch (CLI)](#10-create-everything-from-scratch-cli)
11. [Build and deploy procedure](#11-build-and-deploy-procedure)
12. [Backups and restore](#12-backups-and-restore)
13. [Operations runbook](#13-operations-runbook)
14. [Adding a domain (GoDaddy)](#14-adding-a-domain-godaddy)
15. [Problems found and how they were fixed](#15-problems-found-and-how-they-were-fixed)
16. [Cost](#16-cost)
17. [Security checklist and open items](#17-security-checklist-and-open-items)
18. [Teardown](#18-teardown)

---

## 1. Architecture

```
                         Internet
                            |
        80/443 (public)     |      3001 (admin, owner IP only)
                            v
                   Elastic IP  <PUBLIC_IP>
                            |
        +-------------------+----------------------------------------+
        |  EC2  t3a.small, Ubuntu 24.04, 25 GB gp3 (encrypted)        |
        |  Docker Compose, every container on the host network        |
        |                                                             |
        |   Caddy  :80 :443 :3001   (TLS, routing)                    |
        |     |-- /api/*  ------------> api         127.0.0.1:3002    |
        |     |-- everything else ----> storefront  127.0.0.1:3000    |
        |     '-- :3001 --------------> admin       127.0.0.1:3101    |
        |                                                             |
        |   api ----> postgres  127.0.0.1:5432  -> EBS data dir       |
        |   api ----> S3 (instance IAM role, no access keys)          |
        |   cron (20:00 UTC) -> pg_dump -> S3 backups/                |
        +-------------------------------------------------------------+
                            |
                            v
        S3 bucket  premal-kaizen-v2-<ACCOUNT_ID>
           products/          public-read (product + banner images)
           backups/           private, 14-day expiry (database dumps)
           deploy-artifacts/  private, 7-day expiry (build inputs)
```

Design choices:

| Choice | Reason |
|---|---|
| One EC2 instance, no load balancer | An ALB costs about USD 17 per month and adds nothing with a single instance. Add one only when a second instance or autoscaling is needed. |
| PostgreSQL in a container on the same instance | RDS is far more expensive for a small store. Daily dumps to S3 cover recovery. |
| S3 for images | Survives instance loss, cheap, and the API already supports `STORAGE_DRIVER=s3`. |
| No SSH, access through AWS Systems Manager (SSM) | No port 22 exposed, no key pair to lose. |
| Images built on the instance | The frontend images bake `NEXT_PUBLIC_API_URL` in at build time, and Docker Desktop was not available locally. |

## 2. Resource inventory

| Resource | Name / type | Notes |
|---|---|---|
| Account / region | `<ACCOUNT_ID>` / `ap-south-1` | |
| EC2 instance | `premal-kaizen-v2`, `t3a.small` | Ubuntu 24.04 (Canonical AMI), AZ `ap-south-1a`, default VPC, IMDSv2 required, no key pair |
| EBS volume | 25 GB gp3, encrypted | Root volume, deleted on termination |
| Elastic IP | `<PUBLIC_IP>` | Associated with the instance. Free while attached to a running instance (the public IPv4 charge applies) |
| Security group | `premal-kaizen-v2-sg` | 80 and 443 from anywhere. No SSH |
| IAM role | `premal-kaizen-v2-ec2-role` | Managed `AmazonSSMManagedInstanceCore` plus inline policy `premal-v2-s3` |
| Instance profile | `premal-kaizen-v2-ec2-profile` | Wraps the role |
| S3 bucket | `premal-kaizen-v2-<ACCOUNT_ID>` | SSE-S3 (AES256), versioning off, tagged `Project=premal-kaizen-v2` |
| Cron job | `/etc/cron.d/premal-backup` | Daily 20:00 UTC (01:30 IST) |
| Swap | 4 GB `/swapfile` | Safety net for the 2 GB instance |
| Load balancer / RDS / CloudFront / Route 53 | none | Not used, see section 16 |

All resources carry the tag `Project=premal-kaizen-v2`.

## 3. Network and security

Security group inbound rules:

| Port | Source | Purpose |
|---|---|---|
| 80 | 0.0.0.0/0 | Redirects to HTTPS |
| 443 | 0.0.0.0/0 | Storefront and API over HTTPS |
| 3001 | closed | Was the admin port while the site was IP-only. Admin now lives at `admin.<domain>` on 443 |
| 22 | not open | No SSH. Use SSM |

Outbound: allow all (default).

Hardening in place:

- Instance Metadata Service v2 required (`HttpTokens=required`).
- Root EBS volume encrypted.
- PostgreSQL listens on `127.0.0.1` only (`listen_addresses=127.0.0.1`), and is not reachable even if the security group were opened.
- The API container binds `0.0.0.0:3002`, but port 3002 is not in the security group, so it is only reachable through Caddy.
- Secrets live only in `/opt/premal-kaizen/deploy/.env` (`chmod 600`, root). They are not in git, in S3, or in the image.
- `POST /api/auth/admin/bootstrap` (creates the first admin when none exists) is restricted by Caddy to the owner IP. See section 5.
- S3 bucket is private except `products/*` (read only). Bucket listing is denied to the public.
- The EC2 role can only write `products/*`, read and write `backups/*`, and read `deploy-artifacts/*`.

Access to the instance (no SSH): AWS Systems Manager.

```bash
# Run a command (works from any machine with the AWS CLI and permissions)
aws ssm send-command --instance-ids <INSTANCE_ID> --document-name AWS-RunShellScript \
  --parameters 'commands=["docker ps"]' --region ap-south-1 --query Command.CommandId --output text
aws ssm get-command-invocation --command-id <COMMAND_ID> --instance-id <INSTANCE_ID> \
  --region ap-south-1 --query StandardOutputContent --output text

# Interactive shell (needs the Session Manager plugin installed locally)
aws ssm start-session --target <INSTANCE_ID> --region ap-south-1
```

## 4. Compute: EC2 and Docker

- AMI: Canonical Ubuntu 24.04, looked up from the public SSM parameter
  `/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id`.
- Packages: `docker.io`, `docker-compose-v2`, `unzip`, `cron`, AWS CLI v2 (snap).
- Bootstrap (user data): create 4 GB swap, install packages, enable Docker, create directories.
- Sizing: the images were built on a `t3a.medium`, and later rebuilt on a temporary `t3a.large`
  for speed. The running size is `t3a.small` (2 vCPU, 2 GB RAM). Memory use is about 700 MB of
  1.9 GB. Resize path: stop, change type, start (the Elastic IP stays attached, about 2 minutes of downtime).

Directories on the instance:

| Path | Contents |
|---|---|
| `/opt/premal-kaizen/deploy/` | `docker-compose.yml`, `Caddyfile`, `.env`, `backup.sh` |
| `/opt/premal-kaizen/data/postgres/` | PostgreSQL data (on the EBS volume) |
| `/opt/premal-kaizen/caddy_data/` | Caddy state, including the internal CA certificate |
| `/opt/premal-kaizen/app/src/` | Source used to build the images |
| `/var/log/premal-backup.log` | Backup cron output |

Containers (all `network_mode: host`, `restart: unless-stopped`):

| Container | Image | Listens on | Memory limit | Notes |
|---|---|---|---|---|
| `premal-postgres` | `postgres:16-alpine` | 127.0.0.1:5432 | 300 MB | `shared_buffers=64MB`, `max_connections=40`, `work_mem=4MB`, healthcheck `pg_isready` |
| `premal-api` | `premal-api:v2` | 0.0.0.0:3002 | 550 MB | NestJS, `NODE_OPTIONS=--max-old-space-size=400`, `STORAGE_DRIVER=s3` |
| `premal-storefront` | `premal-storefront:v2` | 127.0.0.1:3000 | 400 MB | Next.js standalone, `NODE_OPTIONS=--max-old-space-size=300` |
| `premal-admin` | `premal-admin:v2` | 127.0.0.1:3101 | 400 MB | Next.js standalone, `PORT=3101` (Caddy exposes it on 3001) |
| `premal-caddy` | `caddy:2-alpine` | 80, 443, 3001 | 150 MB | TLS and routing |

Image tags are mutable (`v2` is re-tagged to the newest build). The frontend containers mount the Caddy
data directory read-only and set `NODE_EXTRA_CA_CERTS` so server-side requests to
`https://<PUBLIC_IP>` trust Caddy's internal CA (not needed once a real domain and certificate are used).

## 5. Reverse proxy and TLS (Caddy)

Template: `deploy-aws/Caddyfile.example`.

- `https://<PUBLIC_IP>`: `/api/*` goes to the API (`127.0.0.1:3002`), everything else to the storefront (`127.0.0.1:3000`).
- `https://<PUBLIC_IP>:3001`: admin panel (`127.0.0.1:3101`).
- `http://<PUBLIC_IP>`: permanent redirect to HTTPS.
- `default_sni <PUBLIC_IP>` is required. Browsers and curl send no SNI when the address is an IP, and without
  this Caddy aborts the TLS handshake.
- `tls internal` issues certificates from Caddy's own CA. Without a domain no public CA will issue a
  certificate for a bare IP, so browsers show a certificate warning until a real domain is configured.
- `handle /api/auth/admin/bootstrap` allows only `<OWNER_IP>`; all other sources get 403. This endpoint is public
  by design (it creates the first admin and disables itself afterwards), so it is locked down.
- Applying a Caddyfile change: `docker restart premal-caddy` (a plain `caddy reload` did not pick up
  `default_sni` during setup).

## 6. Database: PostgreSQL

- PostgreSQL 16 in the `premal-postgres` container, database `premal_kaizen`, user `premal`.
- Data directory: `/opt/premal-kaizen/data/postgres` on the encrypted EBS volume.
- Schema: Prisma, `apps/api/prisma-postgres/schema.prisma`; migrations in `apps/api/prisma-postgres/migrations/`.
- Apply migrations (idempotent, safe to repeat):

```bash
cd /opt/premal-kaizen/deploy
PGU=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
PGP=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
PGD=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
docker run --rm --network host \
  -e DATABASE_URL="postgresql://$PGU:$PGP@127.0.0.1:5432/$PGD" -w /app premal-api:v2 \
  apps/api/node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma-postgres/schema.prisma
```

- Open a SQL shell: `docker exec -it premal-postgres psql -U premal -d premal_kaizen`
- The first admin is created from the admin login page ("Create admin account"). This calls
  `POST /api/auth/admin/bootstrap`, which only works while no admin exists.
- Data carried over from the previous deployment: categories, products, product images and store
  settings only (no customers, orders or sessions). Image URLs were rewritten to the new bucket:

```sql
UPDATE "ProductImage"
SET url = replace(url, '<OLD_BUCKET>', 'premal-kaizen-v2-<ACCOUNT_ID>');
```

## 7. Storage: S3 (images, backups, artifacts)

Bucket: `premal-kaizen-v2-<ACCOUNT_ID>`, region `ap-south-1`.

### 7.1 Layout

| Prefix | Contents | Public? | Lifecycle |
|---|---|---|---|
| `products/` | Product images and homepage banner images (uploaded through the admin panel) | Read only, anyone | None |
| `backups/` | `premal_backup_YYYYMMDD_HHMMSS.sql.gz` database dumps | No | Expire after 14 days |
| `deploy-artifacts/` | Source tarball and deploy files used to build on the instance | No | Expire after 7 days |

### 7.2 Access model

- Block Public Access: `BlockPublicAcls=true`, `IgnorePublicAcls=true`, `BlockPublicPolicy=false`,
  `RestrictPublicBuckets=false`. Public policies are allowed so that the single `products/*` read rule works.
  ACLs are fully blocked, so nothing can be made public per object.
- Bucket policy (only public access allowed):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadProductImagesOnly",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::premal-kaizen-v2-<ACCOUNT_ID>/products/*"
  }]
}
```

- Public result: an image URL works, listing the bucket or reading `backups/` returns 403.
- Encryption at rest: SSE-S3 (AES256), default. Versioning: off.
- CORS (read only, for browsers loading images):

```json
{"CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]}
```

- Lifecycle rules (also abort incomplete multipart uploads after 2 days):

```json
{"Rules":[
 {"ID":"expire-backups-14d","Status":"Enabled","Filter":{"Prefix":"backups/"},
  "Expiration":{"Days":14},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":2}},
 {"ID":"expire-deploy-artifacts-7d","Status":"Enabled","Filter":{"Prefix":"deploy-artifacts/"},
  "Expiration":{"Days":7},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":2}}
]}
```

### 7.3 How image upload works

1. The admin uploads an image (product or banner) in the admin panel.
2. The admin panel calls `POST /api/uploads/image` on the API. It needs an admin session and the
   `uploads:manage` permission.
3. The API (`STORAGE_DRIVER=s3`, `S3_BUCKET`, `AWS_REGION=ap-south-1`, `S3_KEY_PREFIX=products/`) writes the file
   with `PutObject` using the **EC2 instance role**. There are no access keys anywhere in the app.
4. The API returns the public URL:
   `https://premal-kaizen-v2-<ACCOUNT_ID>.s3.ap-south-1.amazonaws.com/products/<hash>.<ext>`
   and that URL is stored in the database (`ProductImage.url`, `HomeBanner.imageUrl`).
5. Product cards use plain `<img>` and load straight from S3. Homepage banners use `next/image`, so they
   go through `/_next/image`, which needs the S3 host in `apps/storefront/next.config.ts`
   (`remotePatterns`: `https://*.s3.ap-south-1.amazonaws.com/products/**`).

Image types and size are validated by the API (see `apps/api/src/uploads/upload-validation.ts`).

### 7.4 Migrating images from another bucket

Same-account copy (server-side, no download):

```bash
aws s3 sync s3://<OLD_BUCKET>/products/ s3://premal-kaizen-v2-<ACCOUNT_ID>/products/
```

then rewrite the URLs in the database (see section 6).

### 7.5 Useful commands

```bash
aws s3 ls s3://premal-kaizen-v2-<ACCOUNT_ID>/ --recursive --summarize --human-readable
aws s3 ls s3://premal-kaizen-v2-<ACCOUNT_ID>/backups/
curl -I https://premal-kaizen-v2-<ACCOUNT_ID>.s3.ap-south-1.amazonaws.com/products/<file>   # expect 200
curl -I https://premal-kaizen-v2-<ACCOUNT_ID>.s3.ap-south-1.amazonaws.com/backups/x         # expect 403
```

Size at setup: about 73 images, roughly 17 MB.

### 7.6 Future improvement: CloudFront

The repo docs recommend a private bucket behind CloudFront with Origin Access Control for caching and a
custom image domain. The API already supports it through `S3_PUBLIC_BASE_URL`. It was not set up to keep
cost and moving parts minimal.

## 8. IAM

Role `premal-kaizen-v2-ec2-role`, trusted by `ec2.amazonaws.com`:

```json
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
```

Attached managed policy: `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore` (lets the instance register with SSM).

Inline policy `premal-v2-s3` (least privilege):

```json
{"Version":"2012-10-17","Statement":[
 {"Sid":"ProductImageUploads","Effect":"Allow","Action":"s3:PutObject","Resource":"arn:aws:s3:::premal-kaizen-v2-<ACCOUNT_ID>/products/*"},
 {"Sid":"Backups","Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::premal-kaizen-v2-<ACCOUNT_ID>/backups/*"},
 {"Sid":"DeployArtifacts","Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::premal-kaizen-v2-<ACCOUNT_ID>/deploy-artifacts/*"},
 {"Sid":"ListOwnBucket","Effect":"Allow","Action":"s3:ListBucket","Resource":"arn:aws:s3:::premal-kaizen-v2-<ACCOUNT_ID>"}
]}
```

The setup itself was done from a workstation with an IAM user (`AdministratorAccess`). Rotate or delete that
access key after setup, and prefer a narrower policy for day-to-day work.

## 9. Configuration and environment variables

`/opt/premal-kaizen/deploy/.env` (template: `deploy-aws/.env.example`; mode 600; never commit):

| Variable | Purpose |
|---|---|
| `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` | Database credentials (generate a long random password) |
| `APP_BASE_URL` | Public storefront URL, used in emails and invoices |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact origins allowed to call the API (storefront and admin origins) |
| `S3_BUCKET` | Image bucket name |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments. Empty means online payments are off (cash on delivery still works) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Email (login OTP, order mails). Gmail needs an app password |
| `EMAIL_FROM`, `CONTACT_NOTIFICATION_EMAIL` | Sender and contact-form recipient |

Set by `docker-compose.yml` itself: `NODE_ENV=production`, `API_PORT=3002`, `DATABASE_URL`, `STORAGE_DRIVER=s3`,
`AWS_REGION=ap-south-1`, `S3_KEY_PREFIX=products/`.

Baked into the frontend images at build time (changing them needs a rebuild):

| Build arg | Image | Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | storefront, admin | `https://<PUBLIC_IP>` (or the domain) |
| `NEXT_PUBLIC_STOREFRONT_URL` | admin | `https://<PUBLIC_IP>` (or the domain) |
| `DATABASE_PROVIDER` | api | `postgresql` |

## 10. Create everything from scratch (CLI)

Run from any machine with the AWS CLI configured (`--region ap-south-1`). Replace the placeholders.
On Windows PowerShell call `aws.exe` explicitly.

```bash
REGION=ap-south-1
ACCOUNT_ID=<ACCOUNT_ID>
BUCKET=premal-kaizen-v2-$ACCOUNT_ID

# 1. S3 bucket
aws s3api create-bucket --bucket $BUCKET --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

# Bucket policy, CORS and lifecycle: JSON is in section 7
aws s3api put-bucket-policy --bucket $BUCKET --policy file://bucket-policy.json
aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration file://cors.json
aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET --lifecycle-configuration file://lifecycle.json
aws s3api put-bucket-tagging --bucket $BUCKET --tagging 'TagSet=[{Key=Project,Value=premal-kaizen-v2}]'

# 2. IAM role and instance profile
aws iam create-role --role-name premal-kaizen-v2-ec2-role --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name premal-kaizen-v2-ec2-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam put-role-policy --role-name premal-kaizen-v2-ec2-role --policy-name premal-v2-s3 \
  --policy-document file://role-policy.json
aws iam create-instance-profile --instance-profile-name premal-kaizen-v2-ec2-profile
aws iam add-role-to-instance-profile --instance-profile-name premal-kaizen-v2-ec2-profile \
  --role-name premal-kaizen-v2-ec2-role

# 3. Security group (no SSH)
SG=$(aws ec2 create-security-group --group-name premal-kaizen-v2-sg \
  --description "premal-kaizen v2" --vpc-id <VPC_ID> --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG --ip-permissions \
  'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]' \
  'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' \
  'IpProtocol=tcp,FromPort=3001,ToPort=3001,IpRanges=[{CidrIp=<OWNER_IP>/32}]'

# 4. Elastic IP
aws ec2 allocate-address --domain vpc

# 5. EC2 instance (wait about 10 seconds after creating the instance profile)
AMI=$(aws ssm get-parameter --query Parameter.Value --output text \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id)
aws ec2 run-instances --image-id $AMI --instance-type t3a.medium \
  --subnet-id <SUBNET_ID> --security-group-ids $SG \
  --iam-instance-profile Name=premal-kaizen-v2-ec2-profile \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":25,"VolumeType":"gp3","Encrypted":true,"DeleteOnTermination":true}}]' \
  --metadata-options HttpTokens=required,HttpEndpoint=enabled \
  --user-data file://userdata.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=premal-kaizen-v2},{Key=Project,Value=premal-kaizen-v2}]'
aws ec2 associate-address --instance-id <INSTANCE_ID> --allocation-id <EIP_ALLOCATION_ID>
```

`userdata.sh` (runs once at first boot):

```bash
#!/bin/bash
set -eux
exec > /var/log/premal-bootstrap.log 2>&1
fallocate -l 4G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 unzip cron
systemctl enable --now docker
snap install aws-cli --classic
mkdir -p /opt/premal-kaizen/data/postgres /opt/premal-kaizen/caddy_data /opt/premal-kaizen/app
touch /var/lib/premal-bootstrap-done
```

Check the instance is ready: `aws ssm describe-instance-information` shows `Online`, and
`/var/lib/premal-bootstrap-done` exists.

## 11. Build and deploy procedure

1. **Package the source** from the repo root (no secrets, no node_modules, no uploads):

```bash
tar -czf source.tar.gz \
  --exclude='./.git' --exclude='**/node_modules' --exclude='**/.next' --exclude='**/dist' \
  --exclude='./apps/api/uploads' --exclude='**/.env' --exclude='**/.env.local' \
  --exclude='*.db' --exclude='*.bak' --exclude='*.log' --exclude='*.tar.gz' .
aws s3 cp source.tar.gz s3://$BUCKET/deploy-artifacts/source.tar.gz
aws s3 cp deploy-aws/docker-compose.yml s3://$BUCKET/deploy-artifacts/
aws s3 cp Caddyfile s3://$BUCKET/deploy-artifacts/        # filled in from Caddyfile.example
aws s3 cp deploy-aws/backup.sh s3://$BUCKET/deploy-artifacts/
```

   Put the `.env` on the instance directly (SSM command or an interactive session). If it ever passes
   through S3, delete it from the bucket immediately.

2. **On the instance** download and unpack:

```bash
cd /opt/premal-kaizen/deploy
for f in docker-compose.yml Caddyfile backup.sh; do aws s3 cp s3://$BUCKET/deploy-artifacts/$f .; done
chmod +x backup.sh; chmod 600 .env
mkdir -p /opt/premal-kaizen/app/src && cd /opt/premal-kaizen/app
aws s3 cp s3://$BUCKET/deploy-artifacts/source.tar.gz . && tar xzf source.tar.gz -C src
```

3. **Build the images** (about 10 to 20 minutes on a 2 vCPU instance; a larger temporary instance is faster):

```bash
cd /opt/premal-kaizen/app/src
docker build -f apps/api/Dockerfile --build-arg DATABASE_PROVIDER=postgresql -t premal-api:v2 .
docker build -f apps/storefront/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://<PUBLIC_IP> -t premal-storefront:v2 .
docker build -f apps/admin/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://<PUBLIC_IP> \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://<PUBLIC_IP> -t premal-admin:v2 .
```

4. **Start the database and migrate** (section 6), then start Caddy first so its internal CA exists, then the rest:

```bash
cd /opt/premal-kaizen/deploy
docker compose up -d postgres
# ... run migrations ...
docker compose up -d caddy
until [ -f /opt/premal-kaizen/caddy_data/caddy/pki/authorities/local/root.crt ]; do sleep 2; done
docker compose up -d
```

5. **Create the first admin** at `https://<PUBLIC_IP>:3001` ("Create admin account"), from the owner IP.

6. **Verify**:

```bash
curl -sk https://<PUBLIC_IP>/api/health             # {"status":"ok"}
curl -sk -o /dev/null -w '%{http_code}\n' https://<PUBLIC_IP>/          # 200
curl -sk -o /dev/null -w '%{http_code}\n' https://<PUBLIC_IP>:3001/     # 307 (redirect to /admin)
docker ps                                            # all containers healthy
```

Deploying a code change later: upload the changed files (or a new tarball), rebuild only the affected
image(s), then `docker compose up -d --force-recreate <service>`.

## 12. Backups and restore

What runs: `/opt/premal-kaizen/deploy/backup.sh`, from `/etc/cron.d/premal-backup`:

```
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
0 20 * * * root /opt/premal-kaizen/deploy/backup.sh >> /var/log/premal-backup.log 2>&1
```

It runs `pg_dump` inside the Postgres container, gzips it, refuses to upload a file smaller than 100 bytes, and
copies it to `s3://<BUCKET>/backups/premal_backup_<timestamp>.sql.gz`. The S3 lifecycle rule deletes dumps
older than 14 days. Dumps are about 7 KB for a nearly empty store and grow with data.

Run a backup now: `/opt/premal-kaizen/deploy/backup.sh` (as root, with `/snap/bin` in `PATH`).

Restore into a **new** database first, check it, then decide:

```bash
aws s3 cp s3://<BUCKET>/backups/<file>.sql.gz /tmp/restore.sql.gz
docker exec premal-postgres psql -U premal -d postgres -c "CREATE DATABASE restore_check"
gunzip -c /tmp/restore.sql.gz | docker exec -i premal-postgres psql -U premal -d restore_check -q
docker exec premal-postgres psql -U premal -d restore_check -c '\dt'
```

To replace the live database: stop the API (`docker compose stop api`), drop and recreate `premal_kaizen`,
load the dump into it, then start the API. Take a fresh backup before doing this.

A restore was tested on 2026-11-22: 32 tables and the admin user came back.

Limits to be aware of:

- Dumps live in the same account and region as the database. There is no cross-region copy.
- Retention is 14 days. Raise it in `lifecycle.json` if needed.
- The database sits on a single EBS volume. For faster whole-instance recovery add daily EBS snapshots
  (Amazon Data Lifecycle Manager), at a small extra cost.
- Uploaded images are in S3 only (11 nines durability) with no versioning. Turn on bucket versioning if
  accidental deletes are a concern.

## 13. Operations runbook

```bash
# Status
docker ps
docker stats --no-stream
free -m; df -h /

# Logs
docker logs --tail 100 premal-api
docker logs --since 15m premal-caddy
tail -50 /var/log/premal-backup.log

# Restart one service / all
cd /opt/premal-kaizen/deploy
docker compose restart api
docker compose up -d --force-recreate api storefront
docker compose up -d

# Change .env, then recreate the containers that use it
docker compose up -d --force-recreate api

# Resize the instance (from your workstation; about 2 minutes of downtime)
aws ec2 stop-instances --instance-ids <INSTANCE_ID>
aws ec2 wait instance-stopped --instance-ids <INSTANCE_ID>
aws ec2 modify-instance-attribute --instance-id <INSTANCE_ID> --instance-type Value=t3a.medium
aws ec2 start-instances --instance-ids <INSTANCE_ID>
```

Containers restart automatically after a reboot (`restart: unless-stopped`, Docker enabled at boot, cron active).

Changing the owner IP (admin access): update the security group rule for 3001 and the `remote_ip` in the
Caddyfile bootstrap block, then `docker restart premal-caddy`.

Windows note: if plain `aws` prints nothing in PowerShell, a zero-byte file may be shadowing it. Call
`aws.exe` explicitly. Also, `aws ssm get-command-invocation` can fail printing non-ASCII characters; filter the
remote command's output through `tr -cd '\11\12\40-\176'`.

## 14. Adding a domain (GoDaddy)

**Status: done on 2026-11-22 for `premalkaizen.in`.** The apex serves the storefront and API, `www` redirects
to the apex, and `admin.premalkaizen.in` serves the admin panel. Certificates are real Let's Encrypt
certificates that Caddy issues and renews by itself (valid 90 days, renewed automatically). The bare IP now
only redirects to the domain. On the instance the pre-domain files were kept as
`/opt/premal-kaizen/deploy/Caddyfile.ip-backup` and `.env.ip-backup`.

The steps below are what was done, written generically so they can be repeated for another domain.

1. In GoDaddy DNS for the domain add:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<PUBLIC_IP>` | 600 |
| A | `www` | `<PUBLIC_IP>` | 600 |
| A | `admin` | `<PUBLIC_IP>` | 600 |

   Remove any default "parked" A record for `@` and any `CNAME` for `www` that conflicts.
   Wait until `nslookup <domain>` returns `<PUBLIC_IP>` (usually minutes, up to an hour or more).

2. Replace the Caddyfile (the certificates become real Let's Encrypt certificates, issued automatically
   once DNS points here and ports 80 and 443 are open):

```
example.com, www.example.com {
	handle /api/auth/admin/bootstrap {
		@blocked not remote_ip <OWNER_IP>
		respond @blocked 403
		reverse_proxy 127.0.0.1:3002
	}
	handle /api/* {
		reverse_proxy 127.0.0.1:3002
	}
	handle {
		reverse_proxy 127.0.0.1:3000
	}
	encode gzip
}

admin.example.com {
	reverse_proxy 127.0.0.1:3101
	encode gzip
}
```

3. Update `.env`:
   - `APP_BASE_URL=https://example.com`
   - `CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com,https://admin.example.com`
4. Rebuild the frontends with the new URLs (they are baked in at build time):

```bash
docker build -f apps/storefront/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://example.com -t premal-storefront:v2 .
docker build -f apps/admin/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://example.com \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://example.com -t premal-admin:v2 .
```

5. `docker restart premal-caddy`, then `docker compose up -d --force-recreate api storefront admin`.
6. Optional cleanups: remove the `NODE_EXTRA_CA_CERTS` setting and caddy-data mounts from the frontend
   services (public certificates need no custom CA), and close port 3001 in the security group (admin
   is now at `admin.example.com`; if you want it private, add a `remote_ip` check in its Caddy block).
7. Razorpay (live mode) needs the HTTPS domain. Add the live keys to `.env` and recreate the API.

## 15. Problems found and how they were fixed

| Symptom | Cause | Fix |
|---|---|---|
| API image build failed at Prisma generate | The Postgres client was generated from a schema in `/tmp`, where Prisma finds no `package.json` and tries `npm i` | Generate from `apps/api/` instead (`apps/api/Dockerfile`) |
| API crashed with "URL must start with `file:`" | `pnpm run build` runs the package's `prebuild` (`prisma generate` for SQLite), overwriting the Postgres client | Regenerate the Postgres client again after the build step (`apps/api/Dockerfile`) |
| HTTPS handshake failed on the bare IP | No SNI is sent for IP addresses | `default_sni <PUBLIC_IP>` in the Caddyfile global block |
| Everyone got 429 Too Many Requests | Behind Caddy all clients looked like `127.0.0.1`, so they shared one rate-limit bucket | `app.set('trust proxy', 'loopback')` in `apps/api/src/main.ts` |
| Products, banners and health checks returned 429 after about 10 requests | The `otp` throttler (10 per 15 min) applied to every route, not just OTP routes | `skipIf` on the `otp` throttler so only `@Throttle({ otp })` routes count (`apps/api/src/app.module.ts`) |
| API container showed `unhealthy` | The healthcheck itself was being rate limited | Same fix as above |
| Banner images broken | Banners use `next/image` and the S3 host was not in `remotePatterns` | Added the S3 host (`products/**`) in `apps/storefront/next.config.ts` |
| Admin sign-up open to anyone | `admin/bootstrap` is public until an admin exists | Caddy restricts it to the owner IP |

## 16. Cost

Estimated monthly cost in `ap-south-1` at on-demand prices (verify in the AWS pricing pages; prices change):

| Item | Approx. USD / month |
|---|---|
| EC2 `t3a.small` (24x7) | 13.7 |
| EBS 25 GB gp3 | 2.3 |
| Public IPv4 address (Elastic IP) | 3.7 |
| S3 storage (about 20 MB) and requests | under 0.1 |
| Data transfer out (first 100 GB per month is free account-wide) | 0 for a small store |
| **Total** | **about 20** |

Not used on purpose (add only when needed): Application Load Balancer (about 17+), RDS (about 15+ for the
smallest instance), NAT gateway (about 32+), CloudFront, Route 53 hosted zone (0.5).

Cost tips: stop the instance when not in use (the Elastic IP then costs the same while idle, EBS keeps
charging); delete old `v*` Docker images with `docker image prune -a` when disk is tight; the builds are
the only reason to size up temporarily.

## 17. Security checklist and open items

- [ ] Rotate or delete the IAM access key used for the setup (it was shared in a chat) and use a least-privilege user afterwards.
- [ ] Add real Razorpay keys to `.env` (payments are off while they are empty).
- [x] Domain and real certificates (section 14), done 2026-11-22.
- [ ] Optional: daily EBS snapshots, S3 versioning, CloudFront in front of images.
- [ ] Optional: copy backups to a second region or account.
- [ ] The storefront's server-side requests reach the API through Caddy from one IP, so they share one rate-limit bucket (120 per minute). If traffic grows, raise the limit or let the storefront call the API on localhost.
- [ ] A previous deployment (separate instance, Elastic IP and bucket) may still be running in the account and costing money. Decommission it once nothing needs it.
- Secrets policy: `.env` on the instance only, never in git or in image layers. Do not paste credentials in chat or tickets.
- This repository is public: never commit account IDs, IPs, keys, passwords or database dumps.

## 18. Teardown

Back up first (run `backup.sh`, copy the dump and `products/` somewhere safe). Then:

```bash
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>
aws ec2 wait instance-terminated --instance-ids <INSTANCE_ID>
aws ec2 release-address --allocation-id <EIP_ALLOCATION_ID>
aws ec2 delete-security-group --group-id <SG_ID>
aws iam remove-role-from-instance-profile --instance-profile-name premal-kaizen-v2-ec2-profile --role-name premal-kaizen-v2-ec2-role
aws iam delete-instance-profile --instance-profile-name premal-kaizen-v2-ec2-profile
aws iam delete-role-policy --role-name premal-kaizen-v2-ec2-role --policy-name premal-v2-s3
aws iam detach-role-policy --role-name premal-kaizen-v2-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role --role-name premal-kaizen-v2-ec2-role
aws s3 rm s3://$BUCKET --recursive && aws s3api delete-bucket --bucket $BUCKET
```
