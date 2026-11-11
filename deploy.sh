#!/usr/bin/env bash
#
# PREMAL KAIZEN - EC2 deployment (Docker + kind + Kubernetes), 9-stage structure.
#
# Usage (on a fresh EC2 instance, after cloning this repo):
#   chmod +x deploy.sh
#   ./deploy.sh                          # staging/kind mode (default)
#   DEPLOY_MODE=production ./deploy.sh   # production mode - stricter secret checks,
#                                        # explicit HTTPS/domain status in the report
#
# Safe to rerun: every stage checks current state before acting and skips or reuses
# what's already correct. It never resets the Kubernetes cluster, never overwrites
# deploy/k8s/02-secret.yaml once it exists, and never touches the persistent data
# directory's existing contents (only creates what's missing).
#
# What this script does NOT do, by design:
#   - does not open EC2 security-group ports (prints the exact rules you must add)
#   - does not run `prisma migrate reset` or `db push --force-reset` - ever
#   - does not seed demo/admin data
#   - does not touch any Kubernetes cluster/context other than the one it creates
#   - does not print secret values, only variable names and whether each is set
#   - does not provision AWS resources (RDS, ALB, Route53, ACM, Secrets Manager) -
#     see PRODUCTION_DEPLOYMENT_GUIDE.md for that, which requires separate approval
#
# IMPORTANT - what changed from the previous version of this script, and why:
#   - Stage 6 now actually runs migrations (as a dedicated, scoped Kubernetes Job -
#     see deploy/k8s/09-migration-job.yaml), gated BEFORE the API Deployment is
#     (re)applied. The previous version deliberately never did this and only printed
#     a manual command - that caused a real production incident (NotificationEvent
#     table missing) because nothing ever ran `prisma migrate deploy`.
#   - Stage 8's health verification no longer fails the whole deployment because the
#     EC2 host can't curl its own public IP through a NodePort (a well-known cloud
#     networking limitation, not an application failure - see DEPLOYMENT_AUDIT_REPORT.md
#     Issue A). External reachability is now a separate, clearly-labeled manual
#     verification step, never an automated pass/fail gate.

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
DEPLOY_MODE="${DEPLOY_MODE:-staging}"   # staging | production

c_reset="\033[0m"; c_red="\033[31m"; c_green="\033[32m"; c_yellow="\033[33m"; c_blue="\033[34m"
log()   { echo -e "${c_blue}[deploy]${c_reset} $*"; }
ok()    { echo -e "${c_green}[ ok ]${c_reset} $*"; }
warn()  { echo -e "${c_yellow}[warn]${c_reset} $*"; }
fail()  { echo -e "${c_red}[fail]${c_reset} $*" >&2; }

trap 'fail "Interrupted or failed at line $LINENO. Nothing was torn down - rerun ./deploy.sh once the issue above is fixed; it will pick up where it left off."' ERR
trap 'echo' EXIT

DOCKER="docker"
have() { command -v "$1" >/dev/null 2>&1; }

if [ "$DEPLOY_MODE" != "staging" ] && [ "$DEPLOY_MODE" != "production" ]; then
  fail "DEPLOY_MODE must be 'staging' or 'production', got: '$DEPLOY_MODE'"
  exit 1
fi
log "Deployment mode: $DEPLOY_MODE"
if [ "$DEPLOY_MODE" = "production" ]; then
  warn "PRODUCTION MODE NOTICE: this script deploys to a SINGLE-NODE kind cluster on"
  warn "ONE EC2 instance - this is NOT a managed, highly-available Kubernetes cluster."
  warn "There is no multi-node failover, no managed control plane, and (per the"
  warn "repository's own design) the API runs at replicas:1 because the database is"
  warn "SQLite on local disk, not a shared/networked database. 'production mode' here"
  warn "means stricter secret/config validation and explicit reporting, not a"
  warn "different, higher-availability infrastructure - see PRODUCTION_DEPLOYMENT_GUIDE.md."
fi

# ===========================================================================
# STAGE 1 - Preflight checks
# ===========================================================================
log "Stage 1/9 - Preflight checks"

OS_ID="unknown"
if [ -f /etc/os-release ]; then
  OS_ID="$(. /etc/os-release && echo "$ID")"
  OS_VERSION="$(. /etc/os-release && echo "${VERSION_ID:-unknown}")"
fi
if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
  ok "OS: $OS_ID ${OS_VERSION:-} (apt-based install path will be used)"
else
  warn "OS detected as '$OS_ID', not Ubuntu/Debian. This script's install steps use apt" \
       "and were written/verified against Ubuntu 22.04/24.04. Docker/kind install may fail" \
       "on other distros - install them manually first if so, then rerun."
fi

if [ "$(uname -s)" != "Linux" ]; then
  fail "This script targets a Linux EC2 instance. Detected: $(uname -s)."
  exit 1
fi

# Configurable thresholds (env-overridable), not hardcoded assumptions.
MIN_DISK_GB="${PREMAL_MIN_DISK_GB:-15}"
MIN_DISK_GB_HARD="${PREMAL_MIN_DISK_GB_HARD:-10}"
MIN_MEM_MB="${PREMAL_MIN_MEM_MB:-6144}"
MIN_MEM_MB_HARD="${PREMAL_MIN_MEM_MB_HARD:-3072}"
MIN_CPU="${PREMAL_MIN_CPU:-2}"

AVAIL_KB=$(df --output=avail -k "$REPO_ROOT" | tail -1 | tr -d ' ')
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
if [ "$AVAIL_GB" -lt "$MIN_DISK_GB_HARD" ]; then
  fail "Only ${AVAIL_GB}GB free disk space at $REPO_ROOT. Need at least ${MIN_DISK_GB_HARD}GB" \
       "(3 app images ~2.1GB + kind's node image ~1-2GB + k8s system images + headroom)." \
       "Override with PREMAL_MIN_DISK_GB_HARD if you've verified this is sufficient."
  exit 1
elif [ "$AVAIL_GB" -lt "$MIN_DISK_GB" ]; then
  warn "${AVAIL_GB}GB free disk space - workable but tight. ${MIN_DISK_GB}GB+ recommended."
else
  ok "Disk: ${AVAIL_GB}GB free"
fi

TOTAL_MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM_MB" -lt "$MIN_MEM_MB_HARD" ]; then
  fail "Only ${TOTAL_MEM_MB}MB RAM detected. A kind cluster's control plane alone needs" \
       "~1.5-2GB; 3 Node.js app pods need more on top of that. Minimum viable: t3.medium" \
       "(4GB). Recommended: t3.large (8GB)."
  exit 1
elif [ "$TOTAL_MEM_MB" -lt "$MIN_MEM_MB" ]; then
  warn "${TOTAL_MEM_MB}MB RAM detected. Below the recommended ${MIN_MEM_MB}MB (t3.large)." \
       "Likely workable but with little headroom - watch for OOMKilled pods."
else
  ok "Memory: ${TOTAL_MEM_MB}MB"
fi

CPU_COUNT=$(nproc)
if [ "$CPU_COUNT" -lt "$MIN_CPU" ]; then
  warn "Only ${CPU_COUNT} vCPU detected. ${MIN_CPU}+ recommended (t3.medium/t3.large)."
else
  ok "CPU: ${CPU_COUNT} vCPU"
fi

if [ "$(id -u)" -ne 0 ] && ! have sudo; then
  fail "Not root and 'sudo' is not available. Docker/kind installation needs root." \
       "Install sudo, or rerun this script as root."
  exit 1
fi
ok "Privilege escalation available (root or sudo)"

for cmd in curl tar git; do
  if ! have "$cmd"; then
    fail "Required command '$cmd' not found. Install it and rerun."
    exit 1
  fi
done
ok "Required base commands present (curl, tar, git)"

# pnpm is NOT required on the EC2 host - every build runs INSIDE the Docker build
# stages (see apps/*/Dockerfile), which install their own pinned pnpm via corepack.
# Installing pnpm on the host would do nothing useful and was never a real
# requirement; this check exists only to say so explicitly, not to install it.
if have pnpm; then
  ok "pnpm found on host ($(pnpm --version)) - not required, not used by this script"
else
  ok "pnpm not found on host - expected and fine, not required (builds run inside Docker)"
fi

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
  "deploy/k8s/09-migration-job.yaml"
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
ok "All required repository files present (including migration Job manifest)"
ok "Confirmed pnpm workspace layout (apps/admin, apps/api, apps/storefront)"

# Full manifest validation (apiVersion/kind recognized, schema-correct) needs a real
# API server to discover against - deliberately NOT done here. At this point in the
# script (Stage 1) no cluster exists yet (that's Stage 4), so `kubectl apply
# --dry-run=client` would itself fail with a discovery/connection error on a
# completely fresh host regardless of whether the YAML is valid - that would make
# this check block every first-ever deployment, not catch a real problem. The real
# structural validation runs in Stage 4, once the kind cluster actually exists.
ok "Manifest existence confirmed above - full structural validation runs in Stage 4" \
   "once a real cluster exists to validate against"

if [ "$DEPLOY_MODE" = "production" ]; then
  log "Production mode: checking domain/HTTPS configuration..."
  if [ -n "${PREMAL_STOREFRONT_DOMAIN:-}" ] || [ -n "${PREMAL_API_DOMAIN:-}" ]; then
    ok "Domain env vars provided (PREMAL_STOREFRONT_DOMAIN/PREMAL_API_DOMAIN) - see" \
       "PRODUCTION_DEPLOYMENT_GUIDE.md for the reverse-proxy/TLS setup this script" \
       "itself does NOT automate."
  else
    warn "No PREMAL_STOREFRONT_DOMAIN/PREMAL_API_DOMAIN set. Production mode will" \
         "proceed (the app itself still works over plain HTTP via NodePorts), but" \
         "HTTPS/a real domain are NOT configured by this script - see" \
         "PRODUCTION_DEPLOYMENT_GUIDE.md before accepting real customer traffic/payments."
  fi
fi

# ===========================================================================
# STAGE 2 - Environment validation (deployment mode + secrets)
# ===========================================================================
log "Stage 2/9 - Environment validation"

SECRET_FILE="deploy/k8s/02-secret.yaml"
SECRET_TEMPLATE="deploy/k8s/02-secret.example.yaml"

if [ ! -f "$SECRET_FILE" ]; then
  cp "$SECRET_TEMPLATE" "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  ok "Created $SECRET_FILE from the template (not committed - gitignored, mode 600)"
else
  ok "$SECRET_FILE already exists - left untouched"
  CUR_MODE="$(stat -c '%a' "$SECRET_FILE" 2>/dev/null || echo '???')"
  if [ "$CUR_MODE" != "600" ]; then
    warn "$SECRET_FILE has mode $CUR_MODE, not 600 - tightening it (file contents untouched)."
    chmod 600 "$SECRET_FILE"
  fi
fi

# Required variable NAMES only - values are never read into a variable that could
# be echoed or logged. Classified by actual code usage (verified by grep against
# apps/api/src, not assumed) into: unused-by-code, optional-integration, and
# production-required.
UNUSED_BY_CODE_KEYS=(JWT_SECRET JWT_EXPIRY)
SEED_ONLY_KEYS=(ADMIN_EMAIL ADMIN_PASSWORD)
OPTIONAL_INTEGRATION_KEYS=(
  RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM
)
ALL_EXPECTED_KEYS=("${UNUSED_BY_CODE_KEYS[@]}" "${SEED_ONLY_KEYS[@]}" "${OPTIONAL_INTEGRATION_KEYS[@]}")

STILL_PLACEHOLDER=()
for key in "${ALL_EXPECTED_KEYS[@]}"; do
  if ! grep -q "^\s*${key}:" "$SECRET_FILE"; then
    warn "Expected secret key '$key' not found in $SECRET_FILE"
    continue
  fi
  if grep -q "^\s*${key}: \"REPLACE_ME" "$SECRET_FILE"; then
    STILL_PLACEHOLDER+=("$key")
  fi
done

RAZORPAY_CONFIGURED=1
SMTP_CONFIGURED=1
for key in RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET; do
  for p in "${STILL_PLACEHOLDER[@]:-}"; do [ "$p" = "$key" ] && RAZORPAY_CONFIGURED=0; done
done
for key in SMTP_HOST SMTP_USER SMTP_PASSWORD EMAIL_FROM; do
  for p in "${STILL_PLACEHOLDER[@]:-}"; do [ "$p" = "$key" ] && SMTP_CONFIGURED=0; done
done

if [ "${#STILL_PLACEHOLDER[@]}" -gt 0 ]; then
  warn "The following secret values are still placeholders:"
  for k in "${STILL_PLACEHOLDER[@]}"; do warn "  - $k"; done
  warn "  - JWT_SECRET/JWT_EXPIRY: confirmed NOT read by any app code - safe to leave as-is"
  warn "  - ADMIN_EMAIL/ADMIN_PASSWORD: only used by 'pnpm db:seed', not run by this script" \
       "(the real admin account is created via the self-disabling /api/auth/admin/bootstrap" \
       "endpoint instead - see PRODUCTION_SECURITY_CHECKLIST.md)"
  [ "$RAZORPAY_CONFIGURED" -eq 0 ] && warn "  - Razorpay: DISABLED until set - payments will not function"
  [ "$SMTP_CONFIGURED" -eq 0 ] && warn "  - SMTP: DISABLED until set - transactional emails will not send"
else
  ok "All expected secret keys are set to non-placeholder values"
fi

if [ "$DEPLOY_MODE" = "production" ]; then
  PROD_BLOCKERS=()
  [ "$RAZORPAY_CONFIGURED" -eq 0 ] && PROD_BLOCKERS+=("Razorpay is not configured - no payments can be accepted")
  [ "$SMTP_CONFIGURED" -eq 0 ] && PROD_BLOCKERS+=("SMTP is not configured - no OTP/order emails will send")
  if [ "${#PROD_BLOCKERS[@]}" -gt 0 ]; then
    fail "Production mode requires Razorpay and SMTP to be configured (OTP login and" \
         "checkout genuinely depend on them). Missing:"
    for b in "${PROD_BLOCKERS[@]}"; do fail "  - $b"; done
    fail "Edit $SECRET_FILE with real values, then rerun. (Staging mode does not require this.)"
    exit 1
  fi
  ok "Production mode: Razorpay and SMTP are configured (required integrations present)"
fi

log "Recommended for a real production secret source (not done by this script):" \
    "AWS Secrets Manager or SSM Parameter Store, injected at pod-start rather than" \
    "committed to a local file - see PRODUCTION_DEPLOYMENT_GUIDE.md."

# ===========================================================================
# STAGE 3 - Docker
# ===========================================================================
log "Stage 3/9 - Docker"

if have docker && docker info >/dev/null 2>&1; then
  ok "Docker already installed and usable"
  DOCKER="docker"
elif have docker && sudo docker info >/dev/null 2>&1; then
  ok "Docker already installed (requires sudo for this user)"
  DOCKER="sudo docker"
else
  log "Installing Docker (official apt repository, pinned to current stable)..."
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
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$(whoami)" || true
  warn "Added $(whoami) to the 'docker' group - needs a new login to take effect." \
       "Using 'sudo docker' for the rest of THIS run."
  DOCKER="sudo docker"
fi

KIND="kind"
if [ "$DOCKER" = "sudo docker" ]; then
  KIND="sudo kind"
fi

# ===========================================================================
# STAGE 4 - Kubernetes (kind cluster, storage)
# ===========================================================================
log "Stage 4/9 - Kubernetes"

if ! have kind; then
  log "Installing kind (pinned version)..."
  KIND_VERSION="v0.24.0"
  curl -Lo /tmp/kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-$(dpkg --print-architecture)"
  chmod +x /tmp/kind
  sudo mv /tmp/kind /usr/local/bin/kind
  ok "kind ${KIND_VERSION} installed"
else
  ok "kind already installed ($(kind version))"
fi

if ! have kubectl; then
  log "Installing kubectl (pinned to current stable)..."
  KUBECTL_VERSION="$(curl -sL https://dl.k8s.io/release/stable.txt)"
  curl -Lo /tmp/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/$(dpkg --print-architecture)/kubectl"
  chmod +x /tmp/kubectl
  sudo mv /tmp/kubectl /usr/local/bin/kubectl
  ok "kubectl ${KUBECTL_VERSION} installed"
else
  ok "kubectl already installed ($(kubectl version --client 2>/dev/null | head -1))"
fi

readonly APP_UID=10001
readonly APP_GID=10001
sudo mkdir -p "$DATA_DIR/db" "$DATA_DIR/uploads"
sudo chown -R "${APP_UID}:${APP_GID}" "$DATA_DIR"
sudo chmod -R 700 "$DATA_DIR"
if [ -f "$DATA_DIR/db/dev.db" ]; then
  ok "Existing dev.db found at $DATA_DIR/db/dev.db - will be reused, not touched"
else
  ok "No existing dev.db yet - a fresh (schema-less) file will be created; Stage 6 applies" \
     "migrations to it before the API is ever started against it"
fi

KUBECONFIG_PATH="$HOME/.kube/premal-kaizen.config"
mkdir -p "$HOME/.kube"
export KUBECONFIG="$KUBECONFIG_PATH"

CLUSTER_EXISTED=0
if $KIND get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  ok "kind cluster '$CLUSTER_NAME' already exists - preserved, not recreated"
  CLUSTER_EXISTED=1
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
if [ "$KIND" = "sudo kind" ]; then
  sudo chown "$(id -u):$(id -g)" "$KUBECONFIG_PATH"
fi

log "Applying namespace (and validating every manifest's structure against this" \
    "now-real cluster before anything else gets applied)..."
kubectl apply -f deploy/k8s/00-namespace.yaml

VALIDATION_FAILED=0
for f in deploy/k8s/*.yaml; do
  if ! kubectl apply --dry-run=server --validate=true -f "$f" >/tmp/premal-manifest-check.log 2>&1; then
    fail "Manifest failed validation: $f"
    cat /tmp/premal-manifest-check.log
    VALIDATION_FAILED=1
  fi
done
if [ "$VALIDATION_FAILED" -eq 1 ]; then
  fail "One or more manifests failed structural validation against the live cluster API - fix and rerun."
  exit 1
fi
ok "All deploy/k8s/*.yaml pass structural validation (server dry-run against this kind cluster)"

kubectl apply -f deploy/k8s/03-pvc.yaml
ok "Namespace 'premal-kaizen' and StorageClass/PV/PVC applied"
kubectl get storageclass premal-local >/dev/null 2>&1 \
  && ok "StorageClass 'premal-local' resolves correctly (fixes the previously-observed" \
       "'storageclass.storage.k8s.io \"premal-local\" not found' error)" \
  || warn "StorageClass 'premal-local' still not found after apply - inspect 'kubectl get storageclass'"

# ===========================================================================
# STAGE 5 - Build (images, release-tagged)
# ===========================================================================
log "Stage 5/9 - Building application images"
log "(This runs the real 'pnpm --filter ... build' INSIDE each Docker build - not run"
log " directly on the host.)"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
RELEASE_TAG="${PREMAL_RELEASE_TAG:-${GIT_SHA}-$(date +%Y%m%d%H%M%S)}"
log "Release tag for this deployment: $RELEASE_TAG"

# Public IP is needed for NEXT_PUBLIC_API_URL before the frontend builds can run -
# detect it now (Stage 5), even though it's also used again in Stage 7/8.
PUBLIC_IP=""
IMDS_TOKEN="$(curl -sf -m 2 -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || true)"
if [ -n "$IMDS_TOKEN" ]; then
  PUBLIC_IP="$(curl -sf -m 2 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
    "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)"
fi
if [ -z "$PUBLIC_IP" ]; then
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
ok "Public address (used only for NEXT_PUBLIC_API_URL / NodePort URLs - never" \
   "hardcoded into any committed file): $PUBLIC_IP"

# NEXT_PUBLIC_API_URL prefers an explicit production API domain if one was given
# (PREMAL_API_DOMAIN, e.g. https://api.your-domain.com) over the bare NodePort IP -
# this is how a later HTTPS/domain cutover gets reflected without touching this script.
if [ -n "${PREMAL_API_DOMAIN:-}" ]; then
  API_URL="$PREMAL_API_DOMAIN"
else
  API_URL="http://${PUBLIC_IP}:30002"
fi
STOREFRONT_URL="http://${PUBLIC_IP}:30000"
ADMIN_URL="http://${PUBLIC_IP}:30001"

$DOCKER build -f apps/api/Dockerfile -t "premal-api:${RELEASE_TAG}" -t premal-api:local .
$DOCKER build -f apps/storefront/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" \
  -t "premal-storefront:${RELEASE_TAG}" -t premal-storefront:local .
$DOCKER build -f apps/admin/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" \
  -t "premal-admin:${RELEASE_TAG}" -t premal-admin:local .
ok "All 3 images built and tagged :${RELEASE_TAG} (and :local for manual convenience)"

log "Loading images into kind cluster '$CLUSTER_NAME'..."
$KIND load docker-image "premal-api:${RELEASE_TAG}" "premal-storefront:${RELEASE_TAG}" "premal-admin:${RELEASE_TAG}" --name "$CLUSTER_NAME"
ok "Images loaded into kind"

mkdir -p "$RENDERED_DIR"
sed -e "s#__CORS_ALLOWED_ORIGINS__#${STOREFRONT_URL},${ADMIN_URL}#" \
    -e "s#__APP_URL__#${STOREFRONT_URL}#" \
  deploy/k8s/01-configmap.yaml > "$RENDERED_DIR/01-configmap.yaml"
for f in 09-migration-job.yaml 10-api.yaml 11-storefront.yaml 12-admin.yaml; do
  sed -e "s#premal-api:local#premal-api:${RELEASE_TAG}#g" \
      -e "s#premal-storefront:local#premal-storefront:${RELEASE_TAG}#g" \
      -e "s#premal-admin:local#premal-admin:${RELEASE_TAG}#g" \
    "deploy/k8s/$f" > "$RENDERED_DIR/$f"
done
ok "Rendered manifests written to $RENDERED_DIR (image refs point at :${RELEASE_TAG})"

kubectl apply -f "$RENDERED_DIR/01-configmap.yaml"
kubectl apply -f "$SECRET_FILE"
ok "ConfigMap and Secret applied"

# ===========================================================================
# STAGE 6 - Database migration (gated, before the API ever starts on this schema)
# ===========================================================================
log "Stage 6/9 - Database migration"

MIGRATION_OK=0
log "Ensuring no API pod is running before the migration Job starts - this and the" \
    "migration Job must never write to the SQLite file at the same time."

if kubectl -n "$NAMESPACE" get deployment/premal-api >/dev/null 2>&1; then
  log "deployment/premal-api exists - scaling it to 0 replicas..."
  if ! kubectl -n "$NAMESPACE" scale deployment/premal-api --replicas=0 --timeout=60s; then
    fail "Failed to scale deployment/premal-api to 0 replicas. Refusing to run the" \
         "migration Job while it's unknown whether an old API pod is still writing to" \
         "the same SQLite file - this is not a 'continue anyway' situation."
    exit 1
  fi
  ok "deployment/premal-api scale-to-0 request succeeded"
else
  ok "deployment/premal-api does not exist yet (first-ever deploy on this cluster) -" \
     "nothing to scale down"
fi

# Verify, not just assume: no premal-api pod may still be Running/Pending once we're
# about to start the migration Job, regardless of why (a fresh cluster with nothing
# to scale down, or a successful scale-down above - either way this is checked for
# real rather than inferred from the scale command's own exit code).
log "Verifying no premal-api pod remains before starting the migration Job..."
kubectl -n "$NAMESPACE" wait --for=delete pod -l app=premal-api --timeout=60s >/dev/null 2>&1 || true
REMAINING_API_PODS="$(kubectl -n "$NAMESPACE" get pods -l app=premal-api --field-selector=status.phase!=Succeeded,status.phase!=Failed -o name 2>/dev/null | wc -l)"
if [ "$REMAINING_API_PODS" -gt 0 ]; then
  fail "${REMAINING_API_PODS} premal-api pod(s) are still present/running after the" \
       "scale-down and a 60s wait. Refusing to start the migration Job while this is" \
       "true - a concurrent writer against the SQLite file is a real risk, not a" \
       "theoretical one. Inspect with:"
  echo "  kubectl -n $NAMESPACE get pods -l app=premal-api"
  echo "  kubectl -n $NAMESPACE describe pod -l app=premal-api"
  exit 1
fi
ok "Confirmed: no premal-api pod remains - safe to start the migration Job"

log "Removing any previous migration Job (Jobs are not rerunnable in place - this" \
    "does not touch the database itself, only the Job's own bookkeeping object)..."
kubectl -n "$NAMESPACE" delete job premal-api-migrate --ignore-not-found=true >/dev/null 2>&1 || true

log "Applying migration Job (runs 'prisma migrate deploy' - never 'migrate reset' or" \
    "'db push --force-reset' - see deploy/k8s/09-migration-job.yaml)..."
kubectl apply -f "$RENDERED_DIR/09-migration-job.yaml"

if kubectl -n "$NAMESPACE" wait --for=condition=complete job/premal-api-migrate --timeout=120s 2>/dev/null; then
  ok "Migration Job completed successfully"
  echo "--- migration Job output ---"
  kubectl -n "$NAMESPACE" logs job/premal-api-migrate || true
  echo "----------------------------"
  MIGRATION_OK=1
else
  fail "Migration Job did NOT complete successfully within 120s. Exact failure:"
  echo "--- migration Job logs ---"
  kubectl -n "$NAMESPACE" logs job/premal-api-migrate --all-containers || true
  echo "--- migration Job pod description ---"
  kubectl -n "$NAMESPACE" describe job/premal-api-migrate || true
  echo "--------------------------------------"
  fail "Refusing to deploy the API against a database with unverified/failed migrations."
  fail "The API Deployment stays scaled to 0 - fix the failure above, then rerun ./deploy.sh."
  exit 1
fi

# ===========================================================================
# STAGE 7 - Deploy (apply workloads in dependency order, wait for rollout)
# ===========================================================================
log "Stage 7/9 - Deploying application workloads"

if [ "$MIGRATION_OK" -ne 1 ]; then
  fail "Internal error: reached Stage 7 without a confirmed-successful migration. Aborting."
  exit 1
fi

kubectl apply -f "$RENDERED_DIR/10-api.yaml"
kubectl apply -f "$RENDERED_DIR/11-storefront.yaml"
kubectl apply -f "$RENDERED_DIR/12-admin.yaml"
ok "All 3 Deployment/Service manifests applied (API restored to replicas:1)"

wait_for_rollout() {
  local deploy="$1"
  log "Waiting for deployment/$deploy to become ready (timeout 180s)..."
  if ! kubectl -n "$NAMESPACE" rollout status "deployment/${deploy}" --timeout=180s; then
    fail "deployment/${deploy} did not become ready in time. Diagnostics:"
    echo "--- kubectl get pods -o wide ---"
    kubectl -n "$NAMESPACE" get pods -l "app=${deploy}" -o wide || true
    echo "--- kubectl describe pod ---"
    kubectl -n "$NAMESPACE" describe pod -l "app=${deploy}" || true
    echo "--- kubectl get events (sorted) ---"
    kubectl -n "$NAMESPACE" get events --sort-by='.lastTimestamp' | tail -30 || true
    echo "--- kubectl logs (last 80 lines, all containers) ---"
    kubectl -n "$NAMESPACE" logs -l "app=${deploy}" --all-containers --tail=80 || true
    exit 1
  fi
  local image
  image="$(kubectl -n "$NAMESPACE" get deployment "$deploy" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  ok "deployment/${deploy} is ready (image: ${image})"
}

wait_for_rollout premal-api
wait_for_rollout premal-storefront
wait_for_rollout premal-admin

log "Service and endpoint status:"
kubectl -n "$NAMESPACE" get svc -o wide
kubectl -n "$NAMESPACE" get endpoints

# ===========================================================================
# STAGE 8 - Health verification (5 separated layers - see DEPLOYMENT_AUDIT_REPORT.md)
# ===========================================================================
log "Stage 8/9 - Health verification"

OVERALL_HEALTH_OK=1

# Layer 1+2: container health / pod readiness - Kubernetes' own Ready condition,
# which already reflects each container's liveness+readiness probes passing.
log "Layer 1-2: container health + pod readiness (Kubernetes Ready condition)"
for app in premal-api premal-storefront premal-admin; do
  READY="$(kubectl -n "$NAMESPACE" get pods -l "app=${app}" -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")"
  RESTARTS="$(kubectl -n "$NAMESPACE" get pods -l "app=${app}" -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}' 2>/dev/null || echo "?")"
  if [ "$READY" = "True" ]; then
    ok "$app: pod Ready=True, restarts=${RESTARTS}"
  else
    fail "$app: pod Ready=${READY}, restarts=${RESTARTS}"
    OVERALL_HEALTH_OK=0
  fi
done

# Layer 3: Kubernetes Service connectivity - resolved and reachable via in-cluster
# DNS from a DIFFERENT pod, not just "the pod can reach itself". Confirms the
# Service's selector/endpoints actually route, independent of host networking.
log "Layer 3: in-cluster Service connectivity (storefront pod -> api Service by DNS name)"
if kubectl -n "$NAMESPACE" exec deploy/premal-storefront -- \
     node -e "require('http').get('http://premal-api:3002/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
     >/dev/null 2>&1; then
  ok "In-cluster Service DNS (http://premal-api:3002) is reachable from another pod"
else
  warn "Could not reach http://premal-api:3002 from the storefront pod via in-cluster DNS." \
       "This does not affect the app today (the frontends call the API via its public" \
       "NodePort URL, not an internal Service name - see API_CONTRACT_AUDIT.md), but" \
       "is worth investigating if an Ingress or internal service mesh is added later."
fi

# Layer 4: EC2 host localhost connectivity - this is the authoritative "did the
# deployment itself actually work" signal, and matches the user-facing experience
# for anyone tunneling in (e.g. the documented admin SSH-tunnel access pattern).
log "Layer 4: EC2 host localhost connectivity"
check_localhost() {
  local name="$1" port="$2" path="${3:-/}"
  local url="http://127.0.0.1:${port}${path}"
  for i in $(seq 1 10); do
    if curl -sf -o /dev/null -m 5 "$url"; then
      ok "$name responded OK at $url (localhost)"
      return 0
    fi
    sleep 3
  done
  fail "$name did not respond OK at $url (localhost) after 30s"
  return 1
}
check_localhost "premal-api (liveness)" 30002 "/api/health" || OVERALL_HEALTH_OK=0
check_localhost "premal-api (readiness/DB)" 30002 "/api/health/ready" || OVERALL_HEALTH_OK=0
check_localhost "premal-storefront" 30000 "/" || OVERALL_HEALTH_OK=0
check_localhost "premal-admin" 30001 "/" || OVERALL_HEALTH_OK=0

# Layer 5: external public connectivity - deliberately NOT tested by curling the
# public IP from this same EC2 instance. That specific pattern (a host curling its
# own public IP back through a NodePort) is a well-known cloud-networking gap in
# many VPC configurations (no automatic "hairpin" NAT) - it reliably times out for
# reasons that have nothing to do with whether the app is actually reachable from
# the real internet. Treating that timeout as an application failure was the
# original bug (see DEPLOYMENT_AUDIT_REPORT.md Issue A). This is reported as an
# action item for YOU to verify from a genuinely external client, never as a
# pass/fail gate this script can honestly evaluate from where it's running.
log "Layer 5: external public connectivity - NOT automatically tested (see explanation)"
warn "This script cannot reliably test 'http://${PUBLIC_IP}:30002' etc. from THIS EC2" \
     "instance - curling your own public IP back through a NodePort is a known cloud" \
     "networking limitation (no hairpin NAT in many VPC setups), not a sign the app is" \
     "broken. Verify externally, from a machine that is NOT this EC2 instance:"
echo "    curl -I http://${PUBLIC_IP}:30002/api/health"
echo "    curl -I http://${PUBLIC_IP}:30000/"
echo "    curl -I http://${PUBLIC_IP}:30001/   (only if you opened 30001 publicly - see below)"
warn "If those time out from an external client AND the EC2 security group has the" \
     "required inbound rules (printed at the end of this report), the next thing to" \
     "check is the EC2 instance's own OS firewall (ufw/iptables), not this script."

echo
log "Database readiness (via the readiness probe used above):" \
    "/api/health/ready passing here means Prisma can run a trivial query - it does" \
    "NOT by itself prove every migration is applied (SELECT 1 succeeds even on an" \
    "empty schema). Stage 6's migration Job having completed successfully is the" \
    "actual guarantee of schema completeness, not this probe."

# ===========================================================================
# STAGE 9 - Deployment report
# ===========================================================================
log "Stage 9/9 - Deployment report"

echo
echo "============================================================"
echo "PREMAL KAIZEN deployment report"
echo "============================================================"
echo "Mode                 : $DEPLOY_MODE"
echo "Release tag           : $RELEASE_TAG"
echo "Cluster               : kind/$CLUSTER_NAME ($([ "$CLUSTER_EXISTED" -eq 1 ] && echo "reused existing" || echo "newly created"))"
echo "Image tags             : premal-api:${RELEASE_TAG}, premal-storefront:${RELEASE_TAG}, premal-admin:${RELEASE_TAG}"
echo
echo "Pod status:"
kubectl -n "$NAMESPACE" get pods -o wide
echo
echo "Database migration    : $([ "$MIGRATION_OK" -eq 1 ] && echo "SUCCEEDED (prisma migrate deploy)" || echo "FAILED")"
echo "API health (localhost) : $([ "$OVERALL_HEALTH_OK" -eq 1 ] && echo "OK" || echo "ONE OR MORE CHECKS FAILED - see above")"
echo
echo "Disabled/unconfigured integrations:"
if [ "$RAZORPAY_CONFIGURED" -eq 1 ]; then echo "  - Razorpay: configured"; else echo "  - Razorpay: DISABLED (placeholder secret values)"; fi
if [ "$SMTP_CONFIGURED" -eq 1 ]; then echo "  - SMTP/email: configured"; else echo "  - SMTP/email: DISABLED (placeholder secret values)"; fi
echo "  - HTTPS/TLS: NOT configured by this script (plain HTTP over NodePorts) - see PRODUCTION_DEPLOYMENT_GUIDE.md"
echo "  - PostgreSQL/RDS: NOT in use - this deployment runs SQLite on local disk (see DATABASE_MIGRATION_REPORT.md for the audited migration plan, not yet executed)"
echo
echo "Access URLs (EC2 public IP: $PUBLIC_IP):"
echo "  Storefront : $STOREFRONT_URL"
echo "  Admin      : $ADMIN_URL"
echo "  API        : $API_URL  (health: ${API_URL}/api/health)"
echo
echo "Required EC2 security-group INBOUND rules (this script does NOT open these):"
echo "  TCP 30000  <- your IP (or 0.0.0.0/0 if intentionally public)   # storefront"
echo "  TCP 30002  <- your IP (or 0.0.0.0/0 - browsers call this directly)   # api"
echo "  TCP 30001  (admin panel) - do NOT open to 0.0.0.0/0. Prefer an SSH tunnel:"
echo "    ssh -L 30001:localhost:30001 <user>@$PUBLIC_IP   then browse http://localhost:30001"
echo "  Keep private: 22 beyond your own IP, 6443 (k8s API), any DB port (none public here)."
echo
if [ "$MIGRATION_OK" -eq 1 ] && [ "$OVERALL_HEALTH_OK" -eq 1 ]; then
  echo -e "${c_green}DEPLOYMENT SUCCESSFUL${c_reset} (mandatory checks passed: migrations + localhost health)."
else
  echo -e "${c_red}DEPLOYMENT DID NOT FULLY SUCCEED${c_reset} - see FAILED items above. Do not treat this as production-ready."
  exit 1
fi
echo "============================================================"
echo
echo "Remaining items before this is a genuinely production-ready deployment (not" \
     "fixed by this script, require your separate decision - see" \
     "PRODUCTION_DEPLOYMENT_GUIDE.md):"
echo "  1. HTTPS + a real domain (Nginx+TLS for this single-EC2 setup, or ALB+ACM if"
echo "     you move to a load-balanced architecture - do not mix both)."
echo "  2. PostgreSQL/RDS migration, if you want it - audited and planned in"
echo "     DATABASE_MIGRATION_REPORT.md, NOT executed (requires your explicit approval"
echo "     to provision RDS and is a real architecture change from what's running now)."
echo "  3. A real secret source (AWS Secrets Manager/SSM) instead of the local"
echo "     deploy/k8s/02-secret.yaml file."
[ "$RAZORPAY_CONFIGURED" -eq 0 ] && echo "  4. Razorpay keys (payments are currently disabled)."
[ "$SMTP_CONFIGURED" -eq 0 ] && echo "  5. SMTP credentials (emails are currently disabled)."
echo
log "To inspect this cluster after this script exits:"
echo "  export KUBECONFIG=$KUBECONFIG_PATH"
echo "  kubectl -n $NAMESPACE get pods"
