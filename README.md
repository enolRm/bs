## 基于区块链与 RAG 的可信大模型知识库系统

本项目为毕业设计示例工程，实现一个基于「本地私链 + 本地向量库 + DeepSeek 模型 API」的可信知识库 Web 系统，支持：

- 可信知识上链存证与追溯
- 多主体知识投票验证
- 链上已验证知识与向量库同步
- 基于 RAG 的大模型问答（DeepSeek API）

### 项目结构（初稿）

- `contracts/`：Solidity 智能合约与 Hardhat 工程（本地私链）
- `backend/`：Python 后端（FastAPI），负责：
  - 提供 Web API（知识提交、验证、检索、问答等）
  - 与本地私链交互，监听链上事件
  - 维护本地数据库与向量库
  - 调用 DeepSeek 大模型 API
- `frontend/`：前端 Web 应用（暂定 React），提供：
  - 知识提交与查看
  - 知识验证投票
  - 问答页面（RAG + 大模型）
  - 知识追溯与详情展示

### 环境与依赖（后续细化）

- Python 3.10+
- Node.js 18+（用于前端与 Hardhat）
- 本地私链：Hardhat / Ganache（二选一，代码将以 Hardhat 为主）
- 本地向量库：优先使用 `chromadb`（纯 Python，部署简单）

### 合约开发（Hardhat）

在 `contracts/` 目录下：

1. 安装依赖

```bash
npm install
```

2. 启动本地私链节点（保持窗口不关闭）

```bash
npm run node
```

3. 编译合约（生成 ABI/Artifact）

```bash
npx hardhat compile
```

4. 部署合约到本地私链

```bash
npm run deploy
```

部署成功后会输出合约地址。把它写入 `backend/.env`：

- `WEB3_RPC_URL=http://127.0.0.1:8545`
- `CONTRACT_ADDRESS=0x...`（替换为实际地址）

若希望「提交知识」时自动上链并得到链上 ID（便于在验证页进行链上投票），还需配置代签名账户（与 Hardhat 本地节点账户一致即可）：

- `CHAIN_SENDER_ADDRESS=0x...`（本地链第一个账户地址，如 `npx hardhat node` 输出中的 Account #0）
- `CHAIN_SENDER_PRIVATE_KEY=0x...`（该账户私钥）

未配置上述两项时，提交仅保存到本地数据库，不会上链，验证页可使用「通过并入库」简化流程。

后端默认 ABI 路径为：

- `../contracts/artifacts/contracts/KnowledgeStorage.sol/KnowledgeStorage.json`


### 安全说明

- **DeepSeek 的 API Key 不会写入代码仓库**，请在本地使用环境变量或 `.env` 文件配置，例如：
  - Windows PowerShell：
    - `$env:DEEPSEEK_API_KEY="你的实际密钥"`
  - 或在 `backend/.env` 中写入（此文件请勿提交到版本管理）：
    - `DEEPSEEK_API_KEY=你的实际密钥`

后续会在 `backend/` 与 `contracts/` 中给出详细模块说明与接口设计，并逐步完善实现。

