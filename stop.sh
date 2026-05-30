#!/usr/bin/env bash
# ============================================================
# PixelFlow 停止脚本
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }

# ── 1. 停止前端 ──────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  info "停止前端 (PM2)..."
  pm2 stop pixelflow-frontend 2>/dev/null || warn "PM2 中无 pixelflow-frontend 进程"
else
  warn "PM2 未安装，跳过前端停止"
fi

# ── 2. 停止后端 ──────────────────────────────────────────────
info "停止 FastAPI 后端..."
pkill -f "uvicorn app.main:app" 2>/dev/null || warn "未找到 uvicorn 进程"

info "停止 Celery Worker..."
pkill -f "celery -A app.core.celery_app" 2>/dev/null || warn "未找到 celery 进程"

# ── 3. 停止基础设施 (Docker) ────────────────────────────────
info "停止 Docker 基础设施..."
docker compose down

echo ""
info "PixelFlow 已全部停止"
