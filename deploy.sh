#!/usr/bin/env bash
#
# PREMAL KAIZEN - single-command EC2 deployment (Docker + kind + Kubernetes).
#
# Usage (on a fresh EC2 instance, after cloning this repo):
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Safe to rerun: every step below checks current state before acting and skips or
# reuses what's already correct. It never resets the Kubernetes cluster, never
# overwrites deploy/k8s/02-secret.yaml once it exists, and never touches the
# persistent data directory's existing contents (only creates what's missing).
#
# What this script does NOT do, by design:
#   - does not open EC2 security-group ports (prints the exact rules you must add)
#   - does not run any Prisma migration against the SQLite database
#   - does not seed demo/admin data
#   - does not touch any Kubernetes cluster/context other than the one it creates
#   - does not print secret values, only variable names

set -euo pipefail

# ---------------------------------------------------------------------------
# Setup: resolve repo root regardless of invocation directory, basic logging
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

CLUSTER_NAME="premal-kaizen"
NAMESPACE="premal-kaizen"
DATA_DIR="/opt/premal-kaizen/data"
RENDERED_DIR="deploy/.rendered"

c_reset="\033[0m"; c_red="\033[31m"; c_green="\033[32m"; c_yellow="\033[33m"; c_blue="\033[34m"
log()   { echo -e "${c_blue}[deploy]${c_reset} $*"; }
ok()    { echo -e "${c_green}[ ok ]${c_reset} $*"; }
warn()  { echo -e "${c_yellow}[warn]${c_reset} $*"; }
fail()  { echo -e "${c_red}[fail]${c_reset} $*" >&2; }

trap 'fail "Interrupted or failed at line $LINENO. Nothing was torn down - rerun ./deploy.sh once the issue above is fixed; it will pick up where it left off."' ERR
trap 'echo' EXIT

DOCKER="docker"
have() { command -v "$1" >/dev/null 2>&1; }

# ===========================================================================
# 1. Prerequisite and resource checks
# ===========================================================================
log "Step 1/9 - Prerequisite and resource checks"

OS_ID="unknown"
if [ -f /etc/os-release ]; then
  OS_ID="$(. /etc/os-release && echo "$ID")"
fi
if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
  ok "OS: $OS_ID (apt-based install path will be used)"
else
  warn "OS detected as '$OS_ID', not Ubuntu/Debian. This script's install steps use apt" \
       "and were written/verified against Ubuntu 22.04/24.04. Docker/kind install may fail" \
       "on other distros - install them manually first if so, then rerun."
fi

if [ "$(uname -s)" != "Linux" ]; then
  fail "This script targets a Linux EC2 instance. Detected: $(uname -s)."
  exit 1
fi

AVAIL_KB=$(df --output=avail -k "$REPO_ROOT" | tail -1 | tr -d ' ')
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
if [ "$AVAIL_GB" -lt 10 ]; then
  fail "Only ${AVAIL_GB}GB free disk space at $REPO_ROOT. Need at least 15GB" \
       "(3 app images ~2.1GB + kind's node image ~1-2GB + k8s system images + headroom)."
  exit 1
elif [ "$AVAIL_GB" -lt 15 ]; then
  warn "${AVAIL_GB}GB free disk space - workable but tight. 15GB+ recommended."
else
  ok "Disk: ${AVAIL_GB}GB free"
fi

TOTAL_MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM_MB" -lt 3072 ]; then
  fail "Only ${TOTAL_MEM_MB}MB RAM detected. A kind cluster's control plane alone needs" \
       "~1.5-2GB; 3 Node.js app pods need more on top of that. Minimum viable: t3.medium" \
       "(4GB). Recommended: t3.large (8GB) - kind's nested-container overhead is higher" \
       "than a bare k3s install would be at the same instance size."
  exit 1
elif [ "$TOTAL_MEM_MB" -lt 6144 ]; then
  warn "${TOTAL_MEM_MB}MB RAM detected. This is below the recommended t3.large (8GB)." \
       "Likely workable but with little headroom once kind's control-plane overhead and" \
       "all 3 app pods are running together - watch for OOMKilled pods."
else
  ok "Memory: ${TOTAL_MEM_MB}MB"
fi

CPU_COUNT=$(nproc)
if [ "$CPU_COUNT" -lt 2 ]; then
  warn "Only ${CPU_COUNT} vCPU detected. 2+ recommended (t3.medium/t3.large)."
else
  ok "CPU: ${CPU_COUNT} vCPU"
fi

if [ "$(id -u)" -ne 0 ] && ! have sudo; then
  fail "Not root and 'sudo' is not available. Docker/kind installation needs root." \
       "Install sudo, or rerun this script as root."
  exit 1
fi
ok "Privilege escalation available (root or sudo)"

for cmd in curl tar; do
  if ! have "$cmd"; then
    fail "Required command '$cmd' not found. Install it and rerun."
    exit 1
  fi
done
ok "Required base commands present (curl, tar)"

# ===========================================================================
# 2. Repository root / required-file validation
# ===========================================================================
log "Step 2/9 - Validating repository structure"

REQUIRED_PATHS=(
  "pnpm-workspace.yaml"
  "package.json"
  "apps/api/package.json"
  "apps/api/Dockerfile"
  "apps/api/prisma/schema.prisma"
  "apps/storefront/package.json"
  "apps/storefront/Dockerfile"
  "apps/admin/package.json"
  "apps/admin/Dockerfile"
  ".dockerignore"
  "deploy/kind-config.yaml"
  "deploy/k8s/00-namespace.yaml"
  "deploy/k8s/01-configmap.yaml"
  "deploy/k8s/02-secret.example.yaml"
  "deploy/k8s/03-pvc.yaml"
  "deploy/k8s/10-api.yaml"
  "deploy/k8s/11-storefront.yaml"
  "deploy/k8s/12-admin.yaml"
)
for p in "${REQUIRED_PATHS[@]}"; do
  if [ ! -e "$REPO_ROOT/$p" ]; then
    fail "Expected file/dir not found: $p"
    fail "Are you running this from the repository root after a full 'git clone'?"
    exit 1
  fi
done
ok "All required repository files present"

# This is a pnpm workspace (verified: apps/admin, apps/api, apps/storefront, no
# shared packages/) - every Dockerfile's build context MUST be the repo root, not
# the individual app directory, or the workspace lockfile/sibling packages won't
# resolve. The docker build commands below already account for this.
ok "Confirmed pnpm workspace layout (apps/admin, apps/api, apps/storefront)"

# ===========================================================================
# 3. Environment / secrets setup (names only - never prints values)
# ===========================================================================
log "Step 3/9 - Secret configuration check"

SECRET_FILE="deploy/k8s/02-secret.yaml"
SECRET_TEMPLATE="deploy/k8s/02-secret.example.yaml"

if [ ! -f "$SECRET_FILE" ]; then
  cp "$SECRET_TEMPLATE" "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  ok "Created $SECRET_FILE from the template (not committed - gitignored)"
else
  ok "$SECRET_FILE already exists - left untouched"
fi

# Required variable NAMES (verified against apps/api/.env and actual source usage -
# see deploy/k8s/02-secret.example.yaml's comments for what's genuinely read by code
# vs. kept only for .env parity). None of these are hard-required for the API to boot
# and pass health checks - the app degrades gracefully (logs a warning) without them.
EXPECTED_SECRET_KEYS=(
  JWT_SECRET JWT_EXPIRY ADMIN_EMAIL ADMIN_PASSWORD
  RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM
)
STILL_PLACEHOLDER=()
for key in "${EXPECTED_SECRET_KEYS[@]}"; do
  if ! grep -q "^\s*${key}:" "$SECRET_FILE"; then
    warn "Expected secret key '$key' not found in $SECRET_FILE"
    continue
  fi
  if grep -q "^\s*${key}: \"REPLACE_ME" "$SECRET_FILE"; then
    STILL_PLACEHOLDER+=("$key")
  fi
done

if [ "${#STILL_PLACEHOLDER[@]}" -gt 0 ]; then
  warn "The following secret values are still placeholders (names only, not values):"
  for k in "${STILL_PLACEHOLDER[@]}"; do warn "  - $k"; done
  warn "The app will still start and pass health checks without these, but:"
  warn "  - JWT_SECRET/JWT_EXPIRY: not currently read by any app code (confirmed by grep) - safe to leave"
  warn "  - ADMIN_EMAIL/ADMIN_PASSWORD: only used by the separate 'pnpm db:seed' script - not run by this deployment"
  warn "  - RAZORPAY_*: payments will log a warning and not function until set"
  warn "  - SMTP_*/EMAIL_FROM: transactional emails will be skipped until set"
  warn "Edit $SECRET_FILE now if you want these features working, then rerun ./deploy.sh."
  warn "Continuing with placeholders for now (not a blocker)."
else
  ok "All expected secret keys are set to non-placeholder values"
fi

# ===========================================================================
# 4. Public IP detection (EC2 instance metadata, IMDSv2)
# ===========================================================================
log "Step 4/9 - Detecting EC2 public IP"

PUBLIC_IP=""
IMDS_TOKEN="$(curl -sf -m 2 -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || true)"
if [ -n "$IMDS_TOKEN" ]; then
  PUBLIC_IP="$(curl -sf -m 2 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
    "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)"
fi
if [ -z "$PUBLIC_IP" ]; then
  # IMDSv1 fallback (older instance configuration)
  PUBLIC_IP="$(curl -sf -m 2 "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)"
fi
if [ -z "$PUBLIC_IP" ] && [ -n "${PREMAL_PUBLIC_IP:-}" ]; then
  PUBLIC_IP="$PREMAL_PUBLIC_IP"
  warn "Using PREMAL_PUBLIC_IP env var override: $PUBLIC_IP"
fi
if [ -z "$PUBLIC_IP" ]; then
  fail "Could not detect a public IP via the EC2 instance metadata service, and" \
       "PREMAL_PUBLIC_IP is not set."
  fail "If this is not an EC2 instance, rerun as: PREMAL_PUBLIC_IP=<ip-or-hostname> ./deploy.sh"
  exit 1
fi
ok "Public address: $PUBLIC_IP"

API_URL="http://${PUBLIC_IP}:30002"
STOREFRONT_URL="http://${PUBLIC_IP}:30000"
ADMIN_URL="http://${PUBLIC_IP}:30001"

# ===========================================================================
# 5. Docker install/check
# ===========================================================================
log "Step 5/9 - Docker"

if have docker && docker info >/dev/null 2>&1; then
  ok "Docker already installed and usable"
  DOCKER="docker"
elif have docker && sudo docker info >/dev/null 2>&1; then
  ok "Docker already installed (requires sudo for this user)"
  DOCKER="sudo docker"
else
  log "Installing Docker (official apt repository)..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.asc ]; then
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
  fi
  ARCH="$(dpkg --print-architecture)"
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  sudo usermod -aG docker "$(whoami)" || true
  warn "Added $(whoami) to the 'docker' group - group membership needs a new login to" \
       "take effect. Using 'sudo docker' for the rest of THIS run so you don't have to" \
       "log out now; future runs may work without sudo after you re-login."
  DOCKER="sudo docker"
fi

# kind shells out to the docker CLI directly - it needs the same elevation as $DOCKER
# above, or cluster creation/image loading will fail with a permission error even
# though $DOCKER itself works fine.
KIND="kind"
if [ "$DOCKER" = "sudo docker" ]; then
  KIND="sudo kind"
fi

# ===========================================================================
# 6. kind + kubectl install/check
# ===========================================================================
log "Step 6/9 - kind + kubectl"

if ! have kind; then
  log "Installing kind..."
  KIND_VERSION="v0.24.0"
  curl -Lo /tmp/kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-$(dpkg --print-architecture)"
  chmod +x /tmp/kind
  sudo mv /tmp/kind /usr/local/bin/kind
  ok "kind ${KIND_VERSION} installed"
else
  ok "kind already installed ($(kind version))"
fi

if ! have kubectl; then
  log "Installing kubectl..."
  KUBECTL_VERSION="$(curl -sL https://dl.k8s.io/release/stable.txt)"
  curl -Lo /tmp/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/$(dpkg --print-architecture)/kubectl"
  chmod +x /tmp/kubectl
  sudo mv /tmp/kubectl /usr/local/bin/kubectl
  ok "kubectl ${KUBECTL_VERSION} installed"
else
  ok "kubectl already installed ($(kubectl version --client --short 2>/dev/null || kubectl version --client))"
fi

# Persistent data directory on the EC2 host (see deploy/kind-config.yaml extraMounts
# and deploy/k8s/03-pvc.yaml). Only creates what's missing - never touches existing
# files, so an existing dev.db/uploads from a prior run (or one you scp'd in
# yourself) is preserved exactly as-is.
#
# Ownership/permissions: 10001:10001 is the FIXED, non-guessed UID/GID the `appuser`
# account runs as inside all 3 images (pinned explicitly in each Dockerfile's
# `useradd --uid 10001 --gid 10001` - verify with `docker run --rm premal-api:local id`
# once you build it on EC2). 700 = owner-only read/write/execute, no group or world
# access - least privilege, since only that one UID (the container process) ever
# needs to touch this data; chown/chmod only change ownership/permission metadata,
# never file contents, so this is safe to reapply on every rerun.
readonly APP_UID=10001
readonly APP_GID=10001
sudo mkdir -p "$DATA_DIR/db" "$DATA_DIR/uploads"
sudo chown -R "${APP_UID}:${APP_GID}" "$DATA_DIR"
sudo chmod -R 700 "$DATA_DIR"
if [ -f "$DATA_DIR/db/dev.db" ]; then
  ok "Existing dev.db found at $DATA_DIR/db/dev.db - will be reused, not touched"
else
  ok "No existing dev.db yet at $DATA_DIR/db/dev.db - a fresh one will be created on first boot"
  warn "This is likely a schema-less database until migrated. The authoritative check" \
       "happens later (a read-only 'prisma migrate status', once the pod is running) -" \
       "this script never runs a migration automatically."
fi

# Dedicated kubeconfig file for THIS cluster only - deliberately never touches
# ~/.kube/config or whatever context is already set up on this host (this EC2 instance
# may already have kubectl pointed at some other, unrelated cluster - leave that
# completely alone; every kubectl call in this script uses $KUBECONFIG below instead
# of the ambient default).
KUBECONFIG_PATH="$HOME/.kube/premal-kaizen.config"
mkdir -p "$HOME/.kube"
export KUBECONFIG="$KUBECONFIG_PATH"

# Does a cluster named premal-kaizen already exist? Reuse it. Does kind manage OTHER
# clusters? Leave them alone entirely - only ever touch our own named cluster.
if $KIND get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  ok "kind cluster '$CLUSTER_NAME' already exists - reusing it"
  if [ ! -f "$KUBECONFIG_PATH" ]; then
    $KIND get kubeconfig --name "$CLUSTER_NAME" > "$KUBECONFIG_PATH"
  fi
else
  EXISTING="$($KIND get clusters 2>/dev/null || true)"
  if [ -n "$EXISTING" ]; then
    warn "Other kind cluster(s) already exist on this host, left untouched: $EXISTING"
  fi
  log "Creating kind cluster '$CLUSTER_NAME'..."
  $KIND create cluster --name "$CLUSTER_NAME" --config deploy/kind-config.yaml --kubeconfig "$KUBECONFIG_PATH"
fi
# If any step above ran under sudo, the kubeconfig it wrote is root-owned - hand it
# back so plain `kubectl` (not sudo) works for the rest of this script and for you
# afterward (e.g. `KUBECONFIG=~/.kube/premal-kaizen.config kubectl get pods -A`).
if [ "$KIND" = "sudo kind" ]; then
  sudo chown "$(id -u):$(id -g)" "$KUBECONFIG_PATH"
fi

# ===========================================================================
# 7. Build and load application images
# ===========================================================================
log "Step 7/9 - Building application images"
log "(This runs the real 'pnpm --filter ... build' INSIDE each Docker build - not run"
log " directly on the host by this script.)"

$DOCKER build -f apps/api/Dockerfile -t premal-api:local .
$DOCKER build -f apps/storefront/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" -t premal-storefront:local .
$DOCKER build -f apps/admin/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" -t premal-admin:local .
ok "All 3 images built"

log "Loading images into kind cluster '$CLUSTER_NAME' (not a registry pull - kind's own mechanism)..."
$KIND load docker-image premal-api:local premal-storefront:local premal-admin:local --name "$CLUSTER_NAME"
ok "Images loaded into kind"

# ===========================================================================
# 8. Apply Kubernetes resources (in dependency order) and wait for readiness
# ===========================================================================
log "Step 8/9 - Applying Kubernetes resources"

mkdir -p "$RENDERED_DIR"
sed -e "s#__CORS_ALLOWED_ORIGINS__#${STOREFRONT_URL},${ADMIN_URL}#" \
    -e "s#__APP_URL__#${STOREFRONT_URL}#" \
  deploy/k8s/01-configmap.yaml > "$RENDERED_DIR/01-configmap.yaml"

kubectl apply -f deploy/k8s/00-namespace.yaml
kubectl apply -f "$RENDERED_DIR/01-configmap.yaml"
kubectl apply -f "$SECRET_FILE"
kubectl apply -f deploy/k8s/03-pvc.yaml
kubectl apply -f deploy/k8s/10-api.yaml
kubectl apply -f deploy/k8s/11-storefront.yaml
kubectl apply -f deploy/k8s/12-admin.yaml
ok "All manifests applied"

wait_for_rollout() {
  local deploy="$1"
  log "Waiting for deployment/$deploy to become ready (timeout 180s)..."
  if ! kubectl -n "$NAMESPACE" rollout status "deployment/${deploy}" --timeout=180s; then
    fail "deployment/${deploy} did not become ready in time. Diagnostics:"
    echo "--- kubectl describe ---"
    kubectl -n "$NAMESPACE" describe pod -l "app=${deploy}" || true
    echo "--- kubectl logs (last 80 lines, all containers) ---"
    kubectl -n "$NAMESPACE" logs -l "app=${deploy}" --all-containers --tail=80 || true
    echo "--- Troubleshooting ---"
    echo "  kubectl -n $NAMESPACE get pods -l app=${deploy}"
    echo "  kubectl -n $NAMESPACE describe pod -l app=${deploy}"
    echo "  kubectl -n $NAMESPACE logs -l app=${deploy} --previous --all-containers"
    exit 1
  fi
  ok "deployment/${deploy} is ready"
}

wait_for_rollout premal-api
wait_for_rollout premal-storefront
wait_for_rollout premal-admin

# ===========================================================================
# 9. Verify via real health endpoints
# ===========================================================================
log "Step 9/9 - Verifying application health"

check_url() {
  local name="$1" url="$2"
  for i in $(seq 1 10); do
    if curl -sf -o /dev/null -m 5 "$url"; then
      ok "$name responded OK at $url"
      return 0
    fi
    sleep 3
  done
  fail "$name did not respond OK at $url after 30s"
  echo "  kubectl -n $NAMESPACE get pods"
  echo "  kubectl -n $NAMESPACE logs deployment/${name}"
  return 1
}

HEALTH_OK=1
check_url "premal-api (liveness)" "${API_URL}/api/health" || HEALTH_OK=0
check_url "premal-api (readiness/DB)" "${API_URL}/api/health/ready" || HEALTH_OK=0
check_url "premal-storefront" "$STOREFRONT_URL" || HEALTH_OK=0
check_url "premal-admin" "$ADMIN_URL" || HEALTH_OK=0

echo
echo "============================================================"
echo "For any kubectl command below, after this script exits, run this first (this"
echo "cluster uses its own kubeconfig, deliberately separate from any other cluster"
echo "already configured on this host):"
echo "  export KUBECONFIG=$KUBECONFIG_PATH"
echo
if [ "$HEALTH_OK" -eq 1 ]; then
  echo -e "${c_green}Deployment successful.${c_reset}"
else
  echo -e "${c_yellow}Deployment applied, but one or more health checks failed above.${c_reset}"
  echo "The cluster is up - inspect with 'kubectl -n $NAMESPACE get pods' and rerun"
  echo "./deploy.sh once fixed (it will not recreate what's already working)."
fi
echo "============================================================"
echo
echo "Access URLs (EC2 public IP: $PUBLIC_IP):"
echo "  Storefront : $STOREFRONT_URL"
echo "  Admin      : $ADMIN_URL"
echo "  API        : $API_URL  (health: ${API_URL}/api/health)"
echo
echo "Required EC2 security-group INBOUND rules (this script does NOT open these -"
echo "add them yourself in the AWS console/CLI):"
echo "  TCP 30000  <- your IP (or 0.0.0.0/0 if intentionally public)   # storefront"
echo "  TCP 30002  <- your IP (or 0.0.0.0/0 - storefront/admin call this from the browser) # api"
echo
echo "  TCP 30001  (admin panel) - do NOT open this to 0.0.0.0/0. Two options:"
echo "    (a) simplest: open it to your own IP only, same as this rule set does for SSH"
echo "    (b) tighter: don't open 30001 at all - instead use an SSH tunnel from your"
echo "        machine: ssh -L 30001:localhost:30001 <user>@$PUBLIC_IP, then browse to"
echo "        http://localhost:30001 - nothing public needs to change for this to work"
echo "        since the NodePort is already bound on the node's own loopback-reachable"
echo "        interface regardless of the security group."
echo "Keep private (do not open): 22 beyond your own IP, 6443 (k8s API), any DB port."
echo
# Real, read-only schema-state check - NOT a file-size guess. `prisma migrate status`
# only reads migration metadata and does not modify the database in any way, so this
# is safe even against a database with real data. A host-side "is dev.db 0 bytes"
# check was considered and rejected: SQLite can write its header as soon as anything
# connects (even the readiness probe's own `SELECT 1`), so the file stops being empty
# before the schema is actually applied - that would make this warning silently stop
# appearing on a rerun despite the schema still being missing.
log "Checking database schema state (read-only - does not modify the database)..."
MIGRATE_STATUS_OUTPUT="$(kubectl -n "$NAMESPACE" exec deploy/premal-api -- \
  npx prisma migrate status --schema=prisma/schema.prisma 2>&1 || true)"
if echo "$MIGRATE_STATUS_OUTPUT" | grep -qi "database schema is up to date"; then
  ok "Database schema is up to date - no action needed"
elif echo "$MIGRATE_STATUS_OUTPUT" | grep -qiE "have not yet been applied|P3005|failed to apply|not been applied"; then
  warn "Database schema is NOT fully applied yet. This script does NOT run migrations"
  warn "automatically. Review the status below, then if it's really a fresh/empty"
  warn "database (not one with existing data you need to preserve), apply it once:"
  echo "----------------------------------------------------------------"
  echo "$MIGRATE_STATUS_OUTPUT"
  echo "----------------------------------------------------------------"
  echo "  kubectl -n $NAMESPACE exec deploy/premal-api -- npx prisma migrate deploy --schema=prisma/schema.prisma"
  echo
else
  warn "Could not determine schema state automatically. Raw output:"
  echo "----------------------------------------------------------------"
  echo "$MIGRATE_STATUS_OUTPUT"
  echo "----------------------------------------------------------------"
  warn "If this indicates a fresh/empty database, the one-time command is:"
  echo "  kubectl -n $NAMESPACE exec deploy/premal-api -- npx prisma migrate deploy --schema=prisma/schema.prisma"
  echo
fi
echo "HTTPS/domain (not configured - later phase): point a real domain's A record at"
echo "$PUBLIC_IP, put a reverse proxy (nginx/Traefik) or a K8s Ingress + cert-manager"
echo "in front of these NodePorts, and terminate TLS there."
