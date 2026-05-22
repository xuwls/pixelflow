# PixelFlow · 像素流

> 一张商品图,自动产出 ready-to-post 的营销短视频。

[![Status](https://img.shields.io/badge/status-MVP-D4FF3A?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20FastAPI-0B0B0F?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-888?style=flat-square)](#)

PixelFlow 是一条**固定顺序的 AI 商品视频流水线**。
你只需要上传一张商品图,系统会用大约 4 分钟交付一支可直接发布到小红书 / 抖音 / TikTok / 视频号的短视频——脚本、分镜、画面、配音、字幕、合成,全部自动。

```
商品图 → 理解 → 卖点 → 脚本 → 分镜 → 提示词 → 关键帧 → 视频 → 字幕 → 配音 → 合成 → 成片
```

📦 想直接跑起来? → [SETUP.md](./SETUP.md)

---

## 它是什么 / 它不是什么

PixelFlow **不是**一个通用的 AI 工作流平台。

| 我们做 | 我们不做 |
| --- | --- |
| 商品视频固定流水线 | 通用工作流编排 |
| 顺序锁定的十一段流程 | 自由拖拽 / 多分支 |
| 配置节点、选择模型、重跑节点 | 插件市场 / Agent |
| 输出可发布的成片 MP4 | 复杂的节点系统 / 时间轴编辑 |

**用户能做什么**:配置节点、切换模型、单步重跑。
**用户不能做什么**:删除节点、添加节点、修改顺序。

这种「克制」是产品的核心设计:在一个明确的、可被模型反复优化的窄场景里把质量做到最好,而不是把决策推给用户。

---

## 流水线 · Pipeline

固定 11 段,顺序锁定。每一段是独立可重跑的节点,失败不影响上下游,模型可热替换。

| #  | 节点              | 作用                          | 默认模型      |
| -- | ----------------- | ----------------------------- | ------------- |
| 01 | 商品输入          | 接收商品图、标题、描述        | —             |
| 02 | 商品理解          | 识别品类、风格、人群、场景    | Qwen-VL       |
| 03 | 卖点生成          | 标题 / 营销文案 / 情绪文案     | Qwen          |
| 04 | 脚本生成          | 开场 / 转场 / 高潮 / 结尾 / CTA | Qwen          |
| 05 | 分镜生成          | 镜头时长、运镜、字幕、音效    | Qwen          |
| 06 | 提示词生成        | 图片 prompt / 视频 prompt     | Qwen          |
| 07 | 关键帧生成        | 商品场景图                    | 通义万相      |
| 08 | 视频生成          | 镜头片段                      | 阿里视频生成  |
| 09 | 字幕生成          | SRT 时间轴                    | —             |
| 10 | 配音生成          | TTS                           | DashScope TTS |
| 11 | 视频合成          | 拼接 / 字幕烧录 / BGM / 配音  | FFmpeg        |

---

## 技术栈

### 前端
- **Next.js 16** + **React 19** + **TypeScript**
- **TailwindCSS v4** + **shadcn/ui** + **Base UI**
- **ReactFlow (@xyflow/react)** — 流水线可视化(只读)
- **Zustand** — 状态管理
- **Sonner** — Toast

### 后端
- **FastAPI** — 异步 HTTP / WebSocket
- **Celery + Redis** — 异步任务队列(视频生成、FFmpeg 都是耗时操作)
- **PostgreSQL** + **SQLAlchemy 2.0 (async)** + **Alembic**
- **MinIO** — 媒体对象存储
- **FFmpeg** — 视频拼接、字幕烧录、转场

### AI
- **默认**:Qwen / 通义万相 / 阿里视频生成 (DashScope)
- **后续可扩展**:OpenAI、Flux、Kling、Runway、Veo、CogVideoX、ComfyUI

---

## 设计原则

#### 01 · 不是工作流平台
没有节点拖拽,没有自由分支,没有插件市场。我们只做一件事——把商品做成视频。

#### 02 · 顺序是被锁定的
理解 → 文案 → 分镜 → 画面 → 视频 → 合成。每一步可以重跑,但不能被绕过。

#### 03 · 为短视频投放而生
输出比例、时长、节奏都按小红书 / 抖音 / TikTok 的算法偏好做了预设。

#### 04 · 实时反馈
WebSocket 推送节点状态变化,前端实时展示进度、错误、调试日志。

---

## 项目结构

```
PixelFlow/
├── frontend/                  # Next.js 16 应用
│   ├── app/                   # App Router 页面
│   │   ├── page.tsx           # 首页
│   │   └── projects/          # 项目库 + 工作流页
│   ├── components/
│   │   ├── layout/            # 顶部导航
│   │   ├── project/           # 项目相关组件
│   │   ├── ui/                # shadcn 基础组件
│   │   └── workflow/          # 工作流相关组件
│   └── lib/
│       ├── api/               # 后端 HTTP 客户端
│       ├── hooks/             # WebSocket hook 等
│       ├── store/             # Zustand stores
│       └── types/             # 类型定义
│
├── backend/                   # FastAPI + Celery
│   └── app/
│       ├── api/               # HTTP / WS 路由
│       ├── core/              # 配置、数据库、Celery
│       ├── models/            # SQLAlchemy ORM
│       ├── schemas/           # Pydantic 模型
│       ├── services/          # 业务服务(MinIO、AI、FFmpeg)
│       ├── tasks/             # Celery 任务
│       ├── workflow/          # 流水线执行器与节点处理器
│       └── utils/
│
└── docker-compose.yml         # 一键启动开发环境
```

---

## 数据模型(简版)

```sql
-- 项目
project(id, name, cover_url, status, created_at)

-- 工作流节点(每个项目固定 11 条)
workflow_node(
  id, project_id, node_type, status,
  config_json, input_json, output_json,
  debug_log, error_message
)

-- 媒体文件(图、视频、字幕、音频、成片)
media_file(id, project_id, file_type, file_url, scene_index)
```

---

## API 速览

```
POST   /api/v1/projects                    # 创建项目
GET    /api/v1/projects                    # 列表
GET    /api/v1/projects/{id}               # 项目详情(含节点)
DELETE /api/v1/projects/{id}               # 删除项目

POST   /api/v1/workflow/{project_id}/run   # 启动流水线
POST   /api/v1/workflow/node/{id}/retry    # 单节点重跑
PATCH  /api/v1/workflow/node/{id}/config   # 更新节点配置
GET    /api/v1/workflow/{project_id}/status

WS     /ws/project/{project_id}            # 实时状态推送
```

---

## 路线图

### ✅ 第一阶段 — MVP(当前)
- 项目管理 / 工作流页 / 节点系统 / 工作流执行器
- Qwen 接入:脚本、分镜、Prompt
- 通义万相图片生成 + 视频生成
- FFmpeg 合成 / 字幕 / 配音
- WebSocket 状态推送 / 重跑机制 / 导出

### 🚧 第二阶段
- 数字人 / AI 主播 / AI 口播
- AI 换背景 / AI 商品试穿
- 批量视频生成
- 多模型路由(OpenAI / Kling / Veo / Runway)

### 💭 第三阶段
- AI 短剧脚本
- 模板市场(预设风格 / 行业模板)
- 分发集成(直接推到小红书 / 抖音)

---

## 屏幕截图

> _截图占位 — 上线后补充_

| 首页 | 项目库 | 工作流 |
| --- | --- | --- |
| `docs/screenshots/home.png` | `docs/screenshots/library.png` | `docs/screenshots/workflow.png` |

---

## 文档

| 文档 | 用途 |
| --- | --- |
| [SETUP.md](./SETUP.md) | 本地运行 / Docker 启动 / 环境变量 / 数据库迁移 / 故障排查 |
| [readme.md](./readme.md) | 项目介绍(本文件) |

---

## 致谢

设计灵感来自 [小红雀](https://xhq.com)、[可灵](https://kling.kuaishou.com)、[即梦](https://jimeng.jianying.com)、[剪映 AI](https://www.capcut.cn)、[Dola AI](https://dola.ai)。
我们感谢这些产品在「商品 → 视频」这个细分领域的探索,PixelFlow 选择更克制的路线:**只做这一件事,把它做透**。

---

## License

MIT © PixelFlow Contributors
