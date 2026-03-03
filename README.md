# 基于区块链与 RAG 的可信大模型知识库系统

本项目是一个基于 **腾讯云 TBAAS (长安链 ChainMaker)** 和 **RAG (Retrieval-Augmented Generation)** 架构的可信知识库系统。它旨在解决大模型在特定垂直领域应用中的「幻觉」问题，同时利用区块链技术确保知识库数据的可信性、不可篡改性和可追溯性。

## 核心功能

- **可信知识存证**：所有知识提交后先经过区块链存证（内容哈希 + 元数据），确保原始数据不可篡改。
- **多方验证与治理**：知识上链后进入验证期，支持多主体（如专家、管理员）进行投票验证，确保知识库的准确性。
- **自动化 RAG 同步**：仅有经过区块链验证通过的知识，才会自动同步至本地向量数据库（ChromaDB），供大模型检索。
- **智能问答（RAG + GLM-4）**：结合检索到的可信知识片段，调用智谱AI GLM-4 模型生成高质量、有据可查的回答。
- **知识追溯与审计**：提供完整的知识更新轨迹和链上投票详情，每一条知识的来源和验证过程均可溯源。

## 技术栈

- **前端**：React + Vite + Tailwind CSS + Lucide Icons + React Router
- **后端**：Python (FastAPI) + SQLAlchemy (SQLite) + ChromaDB (Vector DB) + ZhipuAI SDK
- **区块链**：腾讯云 TBAAS (长安链 ChainMaker 演示环境) + Go 合约开发 (ChainMaker SDK)
- **大模型**：智谱AI GLM-4 / Embedding-2

## 项目结构

```text
.
├── backend/            # FastAPI 后端工程
│   ├── app/            # 应用逻辑（路由、区块链交互、RAG 等）
│   ├── requirements.txt # 后端依赖
│   └── .env            # 环境变量配置（需自行创建）
├── frontend/           # React 前端工程
│   ├── src/            # 前端源码
│   ├── package.json    # 前端依赖与脚本
│   └── index.html      # 入口 HTML
├── contract.go         # 长安链 ChainMaker 合约代码 (Go)
└── README.md           # 项目说明文档
```

## 快速开始

### 1. 前置条件

- Python 3.10+
- Node.js 18+
- 腾讯云 TBAAS 账户（或具备兼容 ChainMaker 的区块链环境）
- 智谱AI API Key ([获取地址](https://bigmodel.cn/))

### 2. 后端配置

1. 进入 `backend` 目录，安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
2. 创建 `.env` 文件，并根据实际情况配置以下变量：
   ```env
   # 智谱AI 配置
   ZHIPUAI_API_KEY=你的实际密钥
   ZHIPUAI_MODEL=glm-4
   ZHIPUAI_EMBED_MODEL=embedding-2

   # TBAAS 腾讯云长安链配置
   TBAAS_SECRET_ID=你的腾讯云SecretID
   TBAAS_SECRET_KEY=你的腾讯云SecretKey
   TBAAS_CLUSTER_ID=chainmaker-demo
   TBAAS_CHAIN_ID=chain_demo
   TBAAS_CONTRACT_NAME=bs

   # 数据库与向量库
   DATABASE_URL=sqlite:///./knowledge.db
   VECTOR_DB_DIR=./vector_store
   ```
3. 启动后端服务：
   ```bash
   uvicorn app.main:app --reload
   ```

### 3. 前端配置

1. 进入 `frontend` 目录，安装依赖：
   ```bash
   npm install
   ```
2. 启动前端开发服务器：
   ```bash
   npm run dev
   ```
3. 访问 `http://localhost:5173` 即可进入系统。

## 核心流程说明

1. **知识提交**：用户提交知识内容，系统生成内容哈希并调用腾讯云 TBAAS API 将元数据存证上链。
2. **知识验证**：在区块链上进行投票治理。管理员或专家在前端「验证列表」中对未入库知识进行审核。
3. **入库同步**：验证通过后，后端 `verification_scheduler.py`（或手动触发）会将链上通过的知识内容拉取并同步到 ChromaDB。
4. **问答检索**：用户提问时，系统首先在 ChromaDB 中检索相关可信知识片段，将其作为 Context 喂给 GLM-4 模型生成最终回答。

## 安全与注意事项

- **敏感信息**：请勿将包含 `ZHIPUAI_API_KEY` 或 `TBAAS_SECRET_KEY` 的 `.env` 文件提交到代码仓库。
- **区块链环境**：本项目目前针对腾讯云 TBAAS 的 ChainMaker 演示环境进行了适配，如需对接其他 Fabric 或长安链环境，请修改 `backend/app/blockchain.py`。
- **向量库持久化**：ChromaDB 默认持久化在 `backend/vector_store`，如需重置，请删除该文件夹。
