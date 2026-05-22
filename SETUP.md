# 运行与配置 · SETUP

PixelFlow 的本地运行指南。两种方式:Docker(推荐)与手动启动。

---

## 一、前置条件

| 工具 | 版本要求 | 用途 |
| --- | --- | --- |
| **Node.js** | ≥ 20 | 前端开发 |
| **Python** | ≥ 3.11 | 后端开发 |
| **Docker** + Docker Compose | 任意现代版本 | 一键启动数据库 / Redis / MinIO |
| **FFmpeg** | ≥ 6.0 | 视频合成(手动启动时需自行安装) |
| **DashScope API Key** | — | 调用 Qwen / 通义万相 / 阿里视频生成 |

> 申请 DashScope Key:[https://dashscope.console.aliyun.com](https://dashscope.console.aliyun.com)

---

## 二、Docker 一键启动(推荐)

适合**只想跑起来看看**的场景,所有依赖一次拉齐。

```bash
# 1. 配置环境变量
cp .env.example backend/.env
# 编辑 backend/.env,把 DASHSCOPE_API_KEY 换成你自己的

# 2. 启动整套服务
docker compose up -d

# 3. 查看日志
docker compose logs -f backend
```

启动后访问:

| 服务 | 地址 |
| --- | --- |
| **前端** | http://localhost:3000 |
| **后端 API** | http://localhost:8000 |
| **API 文档** | http://localhost:8000/docs |
| **MinIO 控制台** | http://localhost:9001 (账号 `minioadmin` / `minioadmin`) |
| **PostgreSQL** | localhost:5432 |
| **Redis** | localhost:6379 |

首次启动后初始化数据库:

```bash
docker compose exec backend alembic upgrade head
```

停止 / 清理:

```bash
docker compose down              # 停止
docker compose down -v           # 停止并清理所有数据卷(谨慎)
```

---

## 三、手动启动(开发模式)

适合**要改代码、要看堆栈**的开发场景。

### 3.1 启动基础设施(数据库 / Redis / MinIO)

```bash
docker compose up -d postgres redis minio
```

只启动这三个容器,前端 / 后端在本机运行。

### 3.2 后端 · FastAPI

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp ../.env.example .env
# 编辑 .env,把 DASHSCOPE_API_KEY 换成你自己的

# 数据库迁移
alembic upgrade head

# 启动
uvicorn app.main:app --reload --port 8000
```

### 3.3 后端 · Celery Worker

**新开一个终端**(Worker 必须独立进程):

```bash
cd backend
source .venv/bin/activate

# Linux / macOS
celery -A app.core.celery_app worker --loglevel=info --concurrency=2

# Windows(必须 solo 池,prefork 在 Win 下不工作)
celery -A app.core.celery_app worker --loglevel=info --pool=solo
```

### 3.4 前端 · Next.js

**新开一个终端**:

```bash
cd frontend

npm install

# 配置后端地址(可选,默认就是本机 8000)
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
EOF

npm run dev
```

打开 http://localhost:3000 ,完成。

---

## 四、环境变量参考

后端 `backend/.env` 全部可配置项:

```bash
# ── 数据库 ─────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://pixelflow:pixelflow_dev@localhost:5432/pixelflow

# ── Redis(Celery broker + result backend)─────
REDIS_URL=redis://localhost:6379/0

# ── 对象存储 MinIO ─────────────────────────────
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pixelflow-media

# ── FFmpeg(可选,默认走 PATH)─────────────────
# FFMPEG_BIN=ffmpeg
# FFPROBE_BIN=ffprobe
# Windows 示例:
# FFMPEG_BIN=C:\ffmpeg\bin\ffmpeg.exe
# FFPROBE_BIN=C:\ffmpeg\bin\ffprobe.exe

# ── AI ─────────────────────────────────────────
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# ── 应用 ───────────────────────────────────────
APP_ENV=development
DEBUG=true
SECRET_KEY=dev-secret-change-in-production
```

前端 `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## 五、安装 FFmpeg

仅**手动启动**时需要(Docker 镜像里已经内置)。

### macOS

```bash
brew install ffmpeg
```

### Ubuntu / Debian

```bash
sudo apt update && sudo apt install -y ffmpeg
```

### Windows

1. 下载:https://www.gyan.dev/ffmpeg/builds/(选 `release full`)
2. 解压到 `C:\ffmpeg`
3. 把 `C:\ffmpeg\bin` 加入系统 PATH,**或者**在 `backend/.env` 里写绝对路径

验证:

```bash
ffmpeg -version
ffprobe -version
```

---

## 六、数据库管理

所有迁移在 `backend/alembic/` 下。

```bash
cd backend

# 应用所有迁移到最新
alembic upgrade head

# 创建新迁移(基于模型 diff)
alembic revision --autogenerate -m "add new column"

# 回滚一个版本
alembic downgrade -1

# 查看当前版本
alembic current

# 查看历史
alembic history --verbose
```

直接连接数据库:

```bash
psql postgresql://pixelflow:pixelflow_dev@localhost:5432/pixelflow
```

---

## 七、端口速查

| 端口 | 服务 | 协议 |
| ---- | ----------------- | ----- |
| 3000 | 前端 Next.js dev | HTTP |
| 8000 | 后端 FastAPI | HTTP / WS |
| 5432 | PostgreSQL | TCP |
| 6379 | Redis | TCP |
| 9000 | MinIO API | HTTP |
| 9001 | MinIO Console | HTTP |

如果某个端口被占用,改 `docker-compose.yml` 或在启动命令里覆盖。

---

## 八、常见问题

### ❌ Celery Worker 在 Windows 上启动后立刻退出

Windows 下不能用 `prefork` 池,改用 `--pool=solo`(开发足够,生产请部署到 Linux):

```bash
celery -A app.core.celery_app worker --loglevel=info --pool=solo
```

### ❌ `next/font` 报 "Axes can only be defined for variable fonts"

这是字体配置冲突。设置了 `axes` 时不能再写 `weight`(变量字体的 weight 是连续轴)。

### ❌ MinIO 中文文件名 / URL 乱码

MinIO 默认是返回原始字节,确保前端的 `Content-Disposition` 用 `filename*=UTF-8''<encoded>` 形式。

### ❌ 前端连后端报 CORS

后端默认允许 `localhost:3000`,如果换了端口,改 `backend/app/main.py` 里的 `CORSMiddleware` 白名单。

### ❌ DashScope 调用 401 / 余额不足

去 [DashScope 控制台](https://dashscope.console.aliyun.com) 检查 Key 是否正确,以及视频生成模型是否已开通。

### ❌ 数据库连接 "role pixelflow does not exist"

数据库初始化失败。删掉数据卷重来:

```bash
docker compose down -v
docker compose up -d postgres
docker compose exec backend alembic upgrade head
```

### ❌ 视频合成失败 / FFmpeg not found

确认 `ffmpeg -version` 可执行;若用绝对路径,在 `.env` 里设置 `FFMPEG_BIN` 与 `FFPROBE_BIN`。

---

## 九、生产部署提示

MVP 阶段不建议直接上生产,如果你一定要部署,至少做这些事:

- [ ] 把 `SECRET_KEY` 换成真随机值
- [ ] 数据库改成托管服务(RDS / 云数据库),开启 SSL
- [ ] MinIO 换成 S3 / OSS,生成预签名 URL 而不是直传
- [ ] Celery 用 `--pool=prefork` 或 `--pool=gevent`,并配 `--concurrency`
- [ ] 前端 `npm run build` 打包后用 `npm run start` 或部署到 Vercel
- [ ] 后端套 Nginx / Caddy 做反向代理 + HTTPS
- [ ] 接入日志采集(Sentry / Loki / SLS)
- [ ] WebSocket 走 sticky session 或 Redis pub/sub

---

返回:[项目介绍 · readme.md](./readme.md)
