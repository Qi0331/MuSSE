# musse-iwiki（V1 第一批）

> **S2-A 读取接口续报（2026-11-03）**：用户已在 Windows 用官方 `read_doc` 读取自己创建的测试文档，验证了文本结果块里的 `{ok:boolean,data:{doc_id,title,content}}` 结构。新增严格只读的 [官方 iWiki 存储适配器](src/store/official-iwiki-read.ts) 与 [虚构任务表模板、验收步骤](docs/S2A_TASK_TEST_TEMPLATE.md)。这只是开发与测试通道，**尚未把真实任务查询接入小智语音，现有生产桥接不变、远程写入仍禁用**。


> **S2-A 续报（2026-11-03）**：用户 Windows 实测官方 iWiki `tools/list` 成功，27 个发现工具，六个指定查询工具的 schema 输入字段已确认；不是任务业务的真实读取验收。本分支另有单文档只读响应形状检查器 `tools/probe-read-structure.mjs`（仅当用户主动执行 `--live` 并选定测试文档时请求一次 `read_doc`）。详细步骤见 [S2-A 交接](docs/S2A_READONLY_HANDOFF.md)。


> **S2-A 只读契约检查草案（2026-11-03，尚未实机执行）**：新增 [S2-A 执行与交接](docs/S2A_READONLY_HANDOFF.md) 和 `tools/inspect-readonly.mjs`。默认不读取配置或发请求；显式 `--live` 才在本机使用已有私有配置，仅调用 MCP 初始化和工具发现，输出脱敏的六个查询工具参数名称。它**不是**任务管理已接入 iWiki 的证据，真实写入仍关闭。


> **实际部署状态更新（2026-11-03）**：MuSSE 已通过**独立 Windows `xiaozhi-client` → iWiki 官方远程 MCP** 完成实际知识库读取与设备语音查询，见 [本地桥接运行手册](../../docs/IWIKI_LOCAL_MCP_RUNBOOK.md)。注意：这**不是**运行本目录 `src/mcp/server.ts`；本目录的 29 项离线测试、任务/日程/长期目标/笔记业务层没有因此变成已完成的远程验收。下方「状态」「配置真实 iWiki」描述的是本目录第一批业务实现本身，仍然有效。


MuSSE 的任务 / 日程 / 长期目标 / 快捷笔记逻辑，**iWiki 是唯一持久化数据源**。
本目录不包含 Vue 网页、CloudBase、数据库或独立后端。

## 状态

- 任务/日程/目标/笔记业务逻辑：**已本地实现并通过 29 项离线测试**
- iWiki MCP：**协议层已实现，真实工具契约未验证**；未连接真实 iWiki
- **远程写入默认关闭**；仅 `MUSSE_ALLOW_UNVERIFIED_IWIKI=1` 不足以开启，另需 `MUSSE_ENABLE_REMOTE_IWIKI_WRITE=1`，且只应在授权联调时使用
- 小智接入：**方案与配置示例已给出，未连接真实账号**
- 无凭证时：所有持久化操作返回 `UNAVAILABLE`，不会写本地兜底

## 目录

```
software/musse-iwiki/
├── src/
│   ├── types.ts, date.ts
│   ├── markdown/{tasks,goals,notes}.ts
│   ├── store/{wiki-store,local-store,iwiki-mcp-client,iwiki-store}.ts
│   ├── service/task-service.ts
│   └── mcp/{tools,server}.ts
├── templates/MuSSE 个人管理/      # 人工可读文档模板
├── fixtures/MuSSE 个人管理/       # 合成测试夹具（非生产数据）
├── tests/                          # node:test
├── config/xiaozhi-client.example.json
├── docs/
│   ├── MCP_COMPATIBILITY.md
│   ├── IWIKI_DATA_MODEL.md
│   └── XIAOZHI_INTEGRATION.md
└── reports/BATCH1_REPORT.md
```

## 运行离线验证

要求 Node.js >= 22.18（本机 Node 26.1.0），无需 npm install，无第三方依赖。

```powershell
cd software\musse-iwiki
node --test tests\*.test.ts
```

查看 MCP 工具（fixture 模式，仅离线）：

```powershell
$env:MUSSE_IWIKI_STORE="fixture"
$env:MUSSE_FIXTURE_DIR=(Resolve-Path .\fixtures)
node src\mcp\server.ts
```

## 配置真实 iWiki（当前未授权）

真实适配需要：

- `IWIKI_MCP_URL=https://ssemarket.cn/iwiki-api/mcp`
- `IWIKI_TOOL_READ` / `IWIKI_TOOL_WRITE`（必须从授权后的 `tools/list` 或官方文档确认）
- `MUSSE_ALLOW_UNVERIFIED_IWIKI=1`（显式承认工具契约未验证）
- `MUSSE_ENABLE_REMOTE_IWIKI_WRITE=1`（**独立**写入开关；默认关闭）

`IWIKI_MCP_TOKEN` 必须由受控环境/密钥管理注入到 **运行进程**，不要写进
`config/xiaozhi-client.example.json`、源码、命令行历史或日志。示例配置有意
不包含 Token 字段。

缺少任一必需项都会拒绝连接或拒绝写入，并返回 `UNAVAILABLE`。

## 安全边界

- 不提供删除文档工具。
- 写入前读取、写后读回校验；冲突时拒绝覆盖。
- 未知任务/损坏表格/缺失 ID 一律报错。
- 不把 Token、账号数据、真实文档放入仓库。
