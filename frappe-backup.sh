#!/bin/bash
set -e

# ============================================================
# Frappe Daily Backup -> Google Drive (primary) + GitHub (secondary)
# Run this via cron on your Oracle Cloud server.
# ============================================================

# ---- CONFIG: edit these before first run ----
SITE_NAME="your-site-name.local"          # your Frappe site name
FRAPPE_BENCH_DIR="/home/frappe/frappe-bench"  # path to bench directory
BACKUP_DIR="/opt/frappe-backups"          # local staging folder
GDRIVE_REMOTE="gdrive:ciago-backups"      # rclone remote name:path (configure with `rclone config`)
GITHUB_REPO_DIR="/opt/github-backup-repo" # local clone of your private GitHub backup repo
GITHUB_RETENTION_DAYS=14                  # keep only last N days in GitHub
R2_REMOTE="r2backup:ciago-backups"        # rclone remote for SEPARATE Cloudflare account's R2 bucket
DATE=$(date +%Y%m%d-%H%M%S)

echo "===== Starting backup: $DATE ====="

# ---- STEP 1: Create Frappe backup (DB + files) ----
cd "$FRAPPE_BENCH_DIR"
bench --site "$SITE_NAME" backup --with-files

# Frappe puts backups in sites/<site>/private/backups/
LATEST_BACKUP_DIR="$FRAPPE_BENCH_DIR/sites/$SITE_NAME/private/backups"
mkdir -p "$BACKUP_DIR"

# Copy the newest db + files backup out to staging folder
cp $(ls -t "$LATEST_BACKUP_DIR"/*.sql.gz | head -1) "$BACKUP_DIR/db-$DATE.sql.gz"
cp $(ls -t "$LATEST_BACKUP_DIR"/*-files.tar | head -1) "$BACKUP_DIR/files-$DATE.tar" 2>/dev/null || true
cp $(ls -t "$LATEST_BACKUP_DIR"/*-private-files.tar | head -1) "$BACKUP_DIR/private-files-$DATE.tar" 2>/dev/null || true

echo "Backup files staged in $BACKUP_DIR"

# ---- STEP 2: Push to Google Drive (PRIMARY - long-term archive) ----
# Requires: rclone installed + configured (`rclone config`, remote name = gdrive)
rclone copy "$BACKUP_DIR/db-$DATE.sql.gz" "$GDRIVE_REMOTE/" --progress
rclone copy "$BACKUP_DIR" "$GDRIVE_REMOTE/$DATE/" --include "*-$DATE.*" --progress

echo "Pushed to Google Drive: $GDRIVE_REMOTE/$DATE/"

# ---- STEP 3: Push to GitHub (SECONDARY - rolling 14-day window) ----
if [ -d "$GITHUB_REPO_DIR/.git" ]; then
  cd "$GITHUB_REPO_DIR"
  git pull --quiet

  mkdir -p "$GITHUB_REPO_DIR/latest"
  cp "$BACKUP_DIR"/*-"$DATE".* "$GITHUB_REPO_DIR/latest/" 2>/dev/null || true

  # Prune backups older than retention window
  find "$GITHUB_REPO_DIR/latest" -type f -mtime +"$GITHUB_RETENTION_DAYS" -delete

  git add .
  git commit -m "Backup: $DATE" --quiet || echo "Nothing new to commit"
  git push --quiet

  echo "Pushed to GitHub backup repo (rolling $GITHUB_RETENTION_DAYS-day window)"
else
  echo "WARNING: GitHub repo not found at $GITHUB_REPO_DIR - skipping GitHub push"
  echo "Run: git clone <your-private-repo-url> $GITHUB_REPO_DIR"
fi

# ---- STEP 4: Push to Cloudflare R2 (TERTIARY - separate account, isolated) ----
# Requires: rclone configured with a second remote pointing at your SECOND
# Cloudflare account's R2 bucket (separate API token/access key, not your main site's R2)
rclone copy "$BACKUP_DIR/db-$DATE.sql.gz" "$R2_REMOTE/" --progress
rclone copy "$BACKUP_DIR" "$R2_REMOTE/$DATE/" --include "*-$DATE.*" --progress

echo "Pushed to Cloudflare R2 (separate account): $R2_REMOTE/$DATE/"

# ---- STEP 5: Clean up local staging (keep only last 3 days locally) ----
find "$BACKUP_DIR" -type f -mtime +3 -delete

echo "===== Backup complete: $DATE ====="
echo "Verify all 3 copies exist before trusting this as a real backup:"
echo "  1. Google Drive : rclone ls $GDRIVE_REMOTE"
echo "  2. GitHub repo  : check $GITHUB_REPO_DIR/latest"
echo "  3. Cloudflare R2: rclone ls $R2_REMOTE"
