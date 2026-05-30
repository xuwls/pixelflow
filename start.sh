#!/usr/bin/env bash
# ============================================================
# PixelFlow 一键启动脚本
# 适用于 Linux 服务器混合部署模式:
#   - 基础设施 (PostgreSQL/Redis/MinIO) 跑在 Docker
#   - 后端 (FastAPI + Celery) 原生运行
#   - 前端 (Next.js) 通过 PM2 运行
#   - Nginx 做反向代理
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── 前置检查 ─────────────────────────────────────────────────
for cmd in docker python3 node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    error "缺少依赖: $cmd，请先安装"
    exit 1
  fi
done

if ! command -v pm2 &>/dev/null; then
  warn "PM2 未安装，正在安装..."
  npm install -g pm2
fi

# ── 1. 启动基础设施 (Docker) ──────────────────────────────────
info "启动基础设施 (PostgreSQL / Redis / MinIO)..."
docker compose up -d

# ── 2. 等待服务就绪 ──────────────────────────────────────────
info "等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U pixelflow &>/dev/null; then
    info "PostgreSQL 就绪"
    break
  fi
  [ "$i" -eq 30 ] && { error "PostgreSQL 启动超时"; exit 1; }
  sleep 1
done

info "等待 Redis 就绪..."
for i in $(seq 1 30); do
  if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    info "Redis 就绪"
    break
  fi
  [ "$i" -eq 30 ] && { error "Redis 启动超时"; exit 1; }
  sleep 1
done

info "等待 MinIO 就绪..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:9000/minio/health/live &>/dev/null; then
    info "MinIO 就绪"
    break
  fi
  [ "$i" -eq 30 ] && { error "MinIO 启动超时"; exit 1; }
  sleep 1
done

# ── 3. 后端: 创建虚拟环境 (首次) ────────────────────────────
if [ ! -d "backend/.venv" ]; then
  info "创建 Python 虚拟环境..."
  python3 -m venv backend/.venv
fi

# ── 4. 后端: 安装依赖 ───────────────────────────────────────
source backend/.venv/bin/activate
if ! python3 -c "import fastapi" 2>/dev/null; then
  info "安装后端依赖..."
  pip install -r backend/requirements.txt -q
fi

# ── 5. 后端: 数据库迁移 ─────────────────────────────────────
info "运行数据库迁移..."
cd backend
alembic upgrade head
cd ..

# ── 6. 后端: 检查 .env ──────────────────────────────────────
if [ ! -f "backend/.env" ]; then
  warn "backend/.env 不存在，从模板创建..."
  cp .env.example backend/.env
  warn "请编辑 backend/.env 填入 DASHSCOPE_API_KEY 等配置"
fi

# ── 7. 启动 FastAPI 后端 ─────────────────────────────────────
info "启动 FastAPI 后端..."
# 先杀掉已有的 uvicorn 进程
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1

cd backend
nohup uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
info "FastAPI 后端已启动 (PID: $BACKEND_PID, 日志: logs/backend.log)"

# ── 8. 启动 Celery Worker ───────────────────────────────────
info "启动 Celery Worker..."
pkill -f "celery -A app.core.celery_app" 2>/dev/null || true
sleep 1

cd backend
nohup celery -A app.core.celery_app worker \
  --loglevel=info \
  --concurrency=2 \
  > ../logs/celery.log 2>&1 &
CELERY_PID=$!
cd ..
info "Celery Worker 已启动 (PID: $CELERY_PID, 日志: logs/celery.log)"

# ── 9. 构建并启动前端 ──────────────────────────────────────
info "构建前端 (npm run build)..."
cd frontend
npm install --silent
npm run build
info "通过 PM2 启动前端..."
pm2 delete pixelflow-frontend 2>/dev/null || true
pm2 start ecosystem.config.js
cd ..
info "前端已启动 (PM2: pixelflow-frontend)"

# ── 10. Nginx ───────────────────────────────────────────────
if command -v nginx &>/dev/null; then
  info "重新加载 Nginx..."
  sudo nginx -t && sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || warn "Nginx 重载失败，请手动检查"
else
  warn "Nginx 未安装，请安装后手动配置:"
  warn "  sudo cp nginx.conf /etc/nginx/conf.d/pixelflow.conf"
  warn "  sudo nginx -t && sudo systemctl start nginx"
fi

# ── 完成 ─────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo -e "${GREEN} PixelFlow 启动完成!${NC}"
echo "=========================================="
echo ""
echo "  前端:       http://$(hostname -I | awk '{print $1}')/pixelflow/"
echo "  后端 API:   http://127.0.0.1:8000/api/v1"
echo "  API 文档:   http://127.0.0.1:8000/docs"
echo "  健康检查:   http://127.0.0.1:8000/health"
echo "  MinIO:      http://127.0.0.1:9001 (minioadmin/minioadmin)"
echo ""
echo "  日志:"
echo "    后端:  logs/backend.log"
echo "    Celery: logs/celery.log"
echo "    前端:  pm2 logs pixelflow-frontend"
echo ""
echo "  停止:  bash stop.sh"
echo "=========================================="
