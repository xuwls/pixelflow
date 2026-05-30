#!/usr/bin/env bash
# ============================================================
# PixelFlow 一键部署脚本
# 适用于全新 OpenCloudOS / CentOS 8+ 服务器
#
# 使用方式:
#   1. 将整个项目上传到服务器 (如 /opt/pixelflow)
#   2. cd /opt/pixelflow
#   3. bash deploy.sh
# ============================================================
set -e

# ── 颜色 ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}=== $* ===${NC}"; }

# ── 检查 root ──────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  error "请使用 root 用户运行此脚本: sudo bash deploy.sh"
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ============================================================
# 1. 系统更新 & 基础工具
# ============================================================
step "1/9 安装基础工具"
dnf install -y curl wget git tar gzip gcc gcc-c++ make openssl-devel 2>/dev/null || \
  yum install -y curl wget git tar gzip gcc gcc-c++ make openssl-devel
info "基础工具就绪"

# ============================================================
# 2. Docker
# ============================================================
step "2/9 安装 Docker"
if command -v docker &>/dev/null; then
  info "Docker 已安装: $(docker --version)"
else
  warn "正在安装 Docker..."
  # 使用国内镜像加速
  curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
  systemctl enable docker
  systemctl start docker
  info "Docker 安装完成"
fi

# Docker Compose 插件
if docker compose version &>/dev/null; then
  info "Docker Compose 已可用"
else
  warn "安装 Docker Compose 插件..."
  dnf install -y docker-compose-plugin 2>/dev/null || {
    # 手动安装
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/libexec/docker/cli-plugins/docker-compose 2>/dev/null || true
  }
  info "Docker Compose 就绪"
fi

# ============================================================
# 3. Python 3.11+
# ============================================================
step "3/9 安装 Python"
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3; do
  if command -v "$cmd" &>/dev/null; then
    ver=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    major=$("$cmd" -c "import sys; print(sys.version_info.major)")
    minor=$("$cmd" -c "import sys; print(sys.version_info.minor)")
    if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
      PYTHON_CMD="$cmd"
      info "Python 已安装: $cmd ($ver)"
      break
    fi
  fi
done

if [ -z "$PYTHON_CMD" ]; then
  warn "需要 Python >= 3.11，正在安装..."
  # OpenCloudOS / CentOS 8+ 用 dnf
  dnf install -y python3.11 python3.11-devel python3.11-pip 2>/dev/null || {
    # 如果 dnf 仓库没有，尝试从源码编译
    warn "dnf 仓库无 Python 3.11，从源码编译（约 3 分钟）..."
    cd /tmp
    curl -O https://www.python.org/ftp/python/3.12.4/Python-3.12.4.tgz
    tar xzf Python-3.12.4.tgz
    cd Python-3.12.4
    ./configure --enable-optimizations --prefix=/usr/local 2>&1 | tail -1
    make -j$(nproc) 2>&1 | tail -1
    make altinstall
    cd "$PROJECT_DIR"
    rm -rf /tmp/Python-3.12.4*
  }
  PYTHON_CMD="python3.11"
  command -v python3.11 &>/dev/null || PYTHON_CMD="python3.12"
  command -v "$PYTHON_CMD" &>/dev/null || PYTHON_CMD="python3"
  info "Python 安装完成: $PYTHON_CMD ($($PYTHON_CMD --version))"
fi

# 确保 pip 和 venv
$PYTHON_CMD -m ensurepip --upgrade 2>/dev/null || true
$PYTHON_CMD -m pip install --upgrade pip -q 2>/dev/null || true
dnf install -y python3-devel 2>/dev/null || true

# ============================================================
# 4. Node.js 20+
# ============================================================
step "4/9 安装 Node.js"
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [ "$NODE_MAJOR" -ge 20 ]; then
    info "Node.js 已安装: $(node --version)"
  else
    warn "Node.js 版本过低 ($(node --version))，需要 >= 20"
    dnf remove -y nodejs npm 2>/dev/null || true
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    info "Node.js 已更新: $(node --version)"
  fi
else
  warn "正在安装 Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
  info "Node.js 安装完成: $(node --version)"
fi

# PM2
if command -v pm2 &>/dev/null; then
  info "PM2 已安装"
else
  npm install -g pm2
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
  info "PM2 安装完成"
fi

# ============================================================
# 5. Nginx
# ============================================================
step "5/9 安装 Nginx"
if command -v nginx &>/dev/null; then
  info "Nginx 已安装"
else
  dnf install -y epel-release 2>/dev/null || true
  dnf install -y nginx 2>/dev/null || yum install -y nginx
  systemctl enable nginx
  info "Nginx 安装完成"
fi

# ============================================================
# 6. FFmpeg
# ============================================================
step "6/9 安装 FFmpeg"
if command -v ffmpeg &>/dev/null; then
  info "FFmpeg 已安装: $(ffmpeg -version 2>&1 | head -1)"
else
  warn "正在安装 FFmpeg..."
  dnf install -y epel-release 2>/dev/null || true
  # RPM Fusion 仓库 (OpenCloudOS/CentOS 8+)
  dnf install -y https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm 2>/dev/null || true
  dnf install -y ffmpeg 2>/dev/null || {
    # 如果仓库安装失败，下载静态二进制
    warn "从静态包安装 FFmpeg..."
    cd /tmp
    curl -L -o ffmpeg.tar.xz "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
    tar xf ffmpeg.tar.xz
    cp ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe /usr/local/bin/
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
    cd "$PROJECT_DIR"
    rm -rf /tmp/ffmpeg*
  }
  info "FFmpeg 安装完成"
fi

# ============================================================
# 7. 启动基础设施 (Docker)
# ============================================================
step "7/9 启动基础设施 (PostgreSQL / Redis / MinIO)"
cd "$PROJECT_DIR"
docker compose up -d

# 等待就绪
info "等待 PostgreSQL..."
for i in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U pixelflow &>/dev/null && break
  [ "$i" -eq 30 ] && error "PostgreSQL 启动超时"
  sleep 1
done
info "PostgreSQL 就绪"

info "等待 Redis..."
for i in $(seq 1 30); do
  docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && break
  [ "$i" -eq 30 ] && error "Redis 启动超时"
  sleep 1
done
info "Redis 就绪"

info "等待 MinIO..."
for i in $(seq 1 30); do
  curl -sf http://localhost:9000/minio/health/live &>/dev/null && break
  [ "$i" -eq 30 ] && error "MinIO 启动超时"
  sleep 1
done
info "MinIO 就绪"

# ============================================================
# 8. 后端部署
# ============================================================
step "8/9 部署后端 (FastAPI + Celery)"
cd "$PROJECT_DIR"

# 检查 .env
if [ ! -f "backend/.env" ]; then
  warn "backend/.env 不存在，从模板创建..."
  cp .env.example backend/.env
  warn "请编辑 backend/.env 填入 DASHSCOPE_API_KEY!"
  warn "  vi backend/.env"
fi

# 创建虚拟环境
if [ ! -d "backend/.venv" ]; then
  $PYTHON_CMD -m venv backend/.venv
fi
source backend/.venv/bin/activate

# 安装依赖
pip install -r backend/requirements.txt -q -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com 2>/dev/null || \
  pip install -r backend/requirements.txt -q

# 数据库迁移
cd backend
alembic upgrade head
cd ..

# 创建日志目录
mkdir -p logs

# 杀掉旧进程
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "celery -A app.core.celery_app" 2>/dev/null || true
sleep 1

# 启动后端
cd backend
nohup "$PROJECT_DIR/backend/.venv/bin/uvicorn" app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  > "$PROJECT_DIR/logs/backend.log" 2>&1 &
cd ..
info "FastAPI 后端已启动 (PID: $!, 日志: logs/backend.log)"

# 启动 Celery
cd backend
nohup "$PROJECT_DIR/backend/.venv/bin/celery" -A app.core.celery_app worker \
  --loglevel=info \
  --concurrency=2 \
  > "$PROJECT_DIR/logs/celery.log" 2>&1 &
cd ..
info "Celery Worker 已启动 (PID: $!, 日志: logs/celery.log)"

# ============================================================
# 9. 前端部署
# ============================================================
step "9/9 部署前端 (Next.js)"
cd "$PROJECT_DIR/frontend"

npm install --silent
npm run build

# PM2 启动
pm2 delete pixelflow-frontend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

info "前端已启动 (PM2: pixelflow-frontend)"
cd "$PROJECT_DIR"

# ============================================================
# 配置 Nginx
# ============================================================
step "配置 Nginx 反向代理"
cp nginx.conf /etc/nginx/conf.d/pixelflow.conf

# 移除默认配置 (如果有冲突)
if [ -f /etc/nginx/conf.d/default.conf ]; then
  mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
  warn "已备份并移除默认 Nginx 配置"
fi

# 检测并修复主配置中可能存在的 server 冲突
if grep -q "listen.*80" /etc/nginx/nginx.conf 2>/dev/null; then
  if ! grep -q "include.*conf.d" /etc/nginx/nginx.conf 2>/dev/null; then
    warn "/etc/nginx/nginx.conf 中有内联 server 块，请检查是否冲突"
  fi
fi

nginx -t && systemctl restart nginx
info "Nginx 配置完成并已重启"

# ============================================================
# 防火墙
# ============================================================
if command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-service=http 2>/dev/null || true
  firewall-cmd --permanent --add-service=https 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
  info "防火墙已开放 HTTP/HTTPS"
fi

# ============================================================
# 获取公网 IP
# ============================================================
PUBLIC_IP=$(curl -s http://ifconfig.me 2>/dev/null || curl -s http://ip.sb 2>/dev/null || hostname -I | awk '{print $1}')

# ============================================================
# 完成
# ============================================================
echo ""
echo "=========================================="
echo -e "${GREEN} PixelFlow 部署完成!${NC}"
echo "=========================================="
echo ""
echo "  访问地址:   http://${PUBLIC_IP}/pixelflow/"
echo ""
echo "  内部服务:"
echo "    前端:       http://127.0.0.1:3001"
echo "    后端 API:   http://127.0.0.1:8000"
echo "    API 文档:   http://127.0.0.1:8000/docs"
echo "    健康检查:   http://127.0.0.1:8000/health"
echo "    MinIO:      http://127.0.0.1:9001 (minioadmin/minioadmin)"
echo ""
echo "  管理命令:"
echo "    查看状态:   pm2 status"
echo "    查看日志:   pm2 logs"
echo "    后端日志:   tail -f logs/backend.log"
echo "    Celery日志: tail -f logs/celery.log"
echo "    停止全部:   bash stop.sh"
echo ""

# 检查 DASHSCOPE_API_KEY
if grep -q "your-dashscope-api-key-here" backend/.env 2>/dev/null || \
   ! grep -q "DASHSCOPE_API_KEY=sk-" backend/.env 2>/dev/null; then
  echo -e "${YELLOW}=========================================="
  echo "  ⚠  重要: 请配置 DASHSCOPE_API_KEY"
  echo "  vi backend/.env"
  echo "  然后重启后端:"
  echo "  pkill -f uvicorn && cd backend && nohup ../backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 > ../logs/backend.log 2>&1 &"
  echo -e "==========================================${NC}"
fi
