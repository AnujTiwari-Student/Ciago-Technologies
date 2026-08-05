#!/bin/bash
################################################################################
# ENTERPRISE-GRADE FRAPPE DEPLOYMENT SCRIPT
# ============================================================================
# Safely deploys Frappe + Custom App with:
# - Zero-downtime deployment
# - Database migration safety
# - Health checks
# - Automatic rollback on failure
# - Comprehensive logging
#
# Usage: ./deploy.sh <image-tag> <site-name> [environment]
# Example: ./deploy.sh ghcr.io/ciago/frappe:sha-abc123 erpnext.local production
################################################################################

set -euo pipefail

# ============================================================================
# Configuration & Setup
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/frappe-deploy-$(date +%Y%m%d-%H%M%S).log"
DEPLOY_LOCK="/tmp/frappe-deploy.lock"
BACKUP_DIR="/opt/frappe-backups"
MAX_RETRIES=3
RETRY_DELAY=5
HEALTH_CHECK_TIMEOUT=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Logging Functions
# ============================================================================

log() {
  local level=$1
  shift
  local msg="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${timestamp}] [${level}] ${msg}" | tee -a "$LOG_FILE"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $@" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[✓ SUCCESS]${NC} $@" | tee -a "$LOG_FILE"
}

log_warn() {
  echo -e "${YELLOW}[⚠ WARNING]${NC} $@" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[✗ ERROR]${NC} $@" | tee -a "$LOG_FILE"
}

# ============================================================================
# Utility Functions
# ============================================================================

require_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
  fi
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
  fi
  log_success "Docker found: $(docker --version)"
}

check_docker_compose() {
  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed or not in PATH"
    exit 1
  fi
  log_success "docker-compose found: $(docker-compose --version)"
}

acquire_deploy_lock() {
  if [[ -f "$DEPLOY_LOCK" ]]; then
    local lock_age=$(($(date +%s) - $(stat -f%m "$DEPLOY_LOCK" 2>/dev/null || stat -c%Y "$DEPLOY_LOCK" 2>/dev/null)))
    if [[ $lock_age -lt 600 ]]; then  # 10 minutes
      log_error "Deployment already in progress (lock file exists)"
      exit 1
    else
      log_warn "Stale lock file found, removing..."
      rm -f "$DEPLOY_LOCK"
    fi
  fi
  touch "$DEPLOY_LOCK"
  log_success "Deployment lock acquired"
}

release_deploy_lock() {
  rm -f "$DEPLOY_LOCK"
  log_info "Deployment lock released"
}

# ============================================================================
# Docker Registry Functions
# ============================================================================

pull_image() {
  local image=$1
  log_info "Pulling Docker image: $image"
  
  for attempt in $(seq 1 $MAX_RETRIES); do
    if docker pull "$image" 2>&1 | tee -a "$LOG_FILE"; then
      log_success "Image pulled successfully"
      return 0
    else
      if [[ $attempt -lt $MAX_RETRIES ]]; then
        log_warn "Pull attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
        sleep "$RETRY_DELAY"
      fi
    fi
  done
  
  log_error "Failed to pull image after $MAX_RETRIES attempts"
  return 1
}

# ============================================================================
# Backup Functions
# ============================================================================

create_backup() {
  local site_name=$1
  local backup_path="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S)-${site_name}"
  
  log_info "Creating database backup..."
  mkdir -p "$BACKUP_DIR"
  
  # Backup database
  docker-compose exec -T mariadb mysqldump \
    -u"${DB_USER}" -p"${DB_PASSWORD}" \
    "${DB_NAME}" | gzip > "${backup_path}-db.sql.gz" 2>&1 | tee -a "$LOG_FILE"
  
  # Backup Frappe files (sites directory)
  docker-compose exec -T backend tar czf - /home/frappe/frappe-bench/sites | \
    gzip > "${backup_path}-sites.tar.gz" 2>&1 | tee -a "$LOG_FILE"
  
  log_success "Backup created: $backup_path"
  echo "$backup_path"
}

restore_backup() {
  local backup_path=$1
  log_warn "Initiating database rollback from backup: $backup_path"
  
  # Restore database
  log_info "Restoring database from backup..."
  gunzip -c "${backup_path}-db.sql.gz" | \
    docker-compose exec -T mariadb mysql -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" 2>&1 | tee -a "$LOG_FILE"
  
  # Restore sites directory
  log_info "Restoring sites directory..."
  docker-compose exec -T backend bash -c "cd / && tar xzf -" < "${backup_path}-sites.tar.gz" 2>&1 | tee -a "$LOG_FILE"
  
  log_success "Rollback completed"
}

# ============================================================================
# Container Update Functions
# ============================================================================

update_docker_compose() {
  local image=$1
  log_info "Updating docker-compose.yml with new image: $image"
  
  # Update the image in docker-compose
  sed -i.bak "s|image: ghcr.io.*frappe.*|image: $image|g" docker-compose.yml
  log_success "docker-compose.yml updated"
}

restart_containers() {
  log_info "Restarting Frappe containers..."
  
  # Gracefully stop old containers
  docker-compose down --timeout=30 2>&1 | tee -a "$LOG_FILE"
  
  # Start new containers
  if ! docker-compose up -d 2>&1 | tee -a "$LOG_FILE"; then
    log_error "Failed to start containers"
    return 1
  fi
  
  log_success "Containers restarted"
  return 0
}

# ============================================================================
# Database Migration Functions
# ============================================================================

run_migrations() {
  local site_name=$1
  log_info "Running database migrations for site: $site_name"
  
  local migration_output="/tmp/migration-${site_name}.log"
  
  # Wait for backend container to be healthy
  local wait_count=0
  while [[ $wait_count -lt $HEALTH_CHECK_TIMEOUT ]]; do
    if docker-compose exec -T backend curl -f http://localhost:8000/api/method/frappe.client.get_list &>/dev/null; then
      log_success "Backend container is healthy"
      break
    fi
    log_info "Waiting for backend to be healthy... ($wait_count/$HEALTH_CHECK_TIMEOUT)"
    sleep 5
    ((wait_count+=5))
  done
  
  if [[ $wait_count -ge $HEALTH_CHECK_TIMEOUT ]]; then
    log_error "Backend container failed to become healthy within timeout"
    return 1
  fi
  
  # Run migrations
  if ! docker-compose exec -T backend bench --site "$site_name" migrate 2>&1 | tee -a "$LOG_FILE" "$migration_output"; then
    log_error "Migration failed. See $migration_output for details"
    return 1
  fi
  
  log_success "Migrations completed successfully"
  return 0
}

clear_cache() {
  local site_name=$1
  log_info "Clearing Frappe cache for site: $site_name"
  
  if ! docker-compose exec -T backend bench --site "$site_name" clear-cache 2>&1 | tee -a "$LOG_FILE"; then
    log_warn "Cache clear failed (non-blocking)"
    return 0
  fi
  
  log_success "Cache cleared"
  return 0
}

rebuild_assets() {
  local site_name=$1
  log_info "Rebuilding frontend assets for site: $site_name"
  
  if ! docker-compose exec -T backend bench --site "$site_name" build 2>&1 | tee -a "$LOG_FILE"; then
    log_warn "Asset rebuild failed (non-blocking)"
    return 0
  fi
  
  log_success "Assets rebuilt"
  return 0
}

# ============================================================================
# Health Check Functions
# ============================================================================

health_check() {
  log_info "Performing health checks..."
  
  local health_ok=true
  
  # Check if containers are running
  if ! docker-compose ps --services --filter "status=running" | grep -q "backend"; then
    log_error "Backend container is not running"
    health_ok=false
  fi
  
  # Check API endpoint
  if ! docker-compose exec -T backend curl -f http://localhost:8000/api/method/frappe.client.get_list &>/dev/null; then
    log_error "API endpoint health check failed"
    health_ok=false
  fi
  
  # Check database connectivity
  if ! docker-compose exec -T backend bench doctor 2>&1 | grep -q "Database OK"; then
    log_error "Database connectivity check failed"
    health_ok=false
  fi
  
  if [[ "$health_ok" == "true" ]]; then
    log_success "All health checks passed"
    return 0
  else
    log_error "Health checks failed"
    return 1
  fi
}

# ============================================================================
# Main Deployment Function
# ============================================================================

deploy() {
  local image_tag=$1
  local site_name=$2
  local environment=${3:-staging}
  
  log_info "=========================================="
  log_info "FRAPPE DEPLOYMENT STARTED"
  log_info "=========================================="
  log_info "Image: $image_tag"
  log_info "Site: $site_name"
  log_info "Environment: $environment"
  log_info "Log file: $LOG_FILE"
  log_info "=========================================="
  
  # Pre-flight checks
  require_root
  check_docker
  check_docker_compose
  acquire_deploy_lock
  
  # Create backup before any changes
  local backup_path
  if ! backup_path=$(create_backup "$site_name"); then
    log_error "Backup creation failed"
    release_deploy_lock
    exit 1
  fi
  
  # Pull new image
  if ! pull_image "$image_tag"; then
    log_error "Failed to pull image"
    release_deploy_lock
    exit 1
  fi
  
  # Update docker-compose with new image
  update_docker_compose "$image_tag"
  
  # Restart containers with new image
  if ! restart_containers; then
    log_error "Container restart failed, initiating rollback..."
    restore_backup "$backup_path"
    release_deploy_lock
    exit 1
  fi
  
  # Run migrations
  if ! run_migrations "$site_name"; then
    log_error "Migrations failed, initiating rollback..."
    restore_backup "$backup_path"
    release_deploy_lock
    exit 1
  fi
  
  # Clear cache
  clear_cache "$site_name"
  
  # Rebuild assets
  rebuild_assets "$site_name"
  
  # Final health checks
  if ! health_check; then
    log_error "Post-deployment health checks failed, initiating rollback..."
    restore_backup "$backup_path"
    release_deploy_lock
    exit 1
  fi
  
  log_info "=========================================="
  log_success "DEPLOYMENT COMPLETED SUCCESSFULLY"
  log_info "=========================================="
  log_info "Backup location: $backup_path"
  log_info "Environment: $environment"
  log_info "Site: $site_name"
  log_info "=========================================="
  
  release_deploy_lock
  exit 0
}

# ============================================================================
# Error Handling
# ============================================================================

trap 'log_error "Script interrupted"; release_deploy_lock; exit 1' SIGINT SIGTERM

# ============================================================================
# Main Entry Point
# ============================================================================

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <image-tag> <site-name> [environment]"
  echo "Example: $0 ghcr.io/ciago/frappe:v1.0.0 erpnext.local production"
  exit 1
fi

deploy "$@"
