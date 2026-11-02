# 小智接入方案

## 1. 结论摘要

- 没有公开证据表明小智控制台能直接填写 iWiki 远程 MCP URL 并代理工具。
- 推荐用 **`xiaozhi-client` 2.3.0（MIT）** 作为桥接：它连接小智接入点，聚合本项目的 stdio MCP Server。
- **Windows 常开** 时：语音查询/修改 iWiki 可工作（前提是真实 iWiki 适配已授权并验证）。
- **Windows 关机/休眠/断网**：桥接停止，小智失去工具；机器人无法查询或修改 iWiki。
- 若需电脑关机后仍可用，必须有持续在线组件（NAS/树莓派/常开 Docker 主机）。本批不部署、不采购。

## 2. 选项对比

| 方案 | 可行性 | 说明 |
|---|---|---|
| A. 小智直连 iWiki 远程 MCP | **未证实** | 控制台只公开一个接入点；未发现填写第三方 MCP URL 的官方入口 |
| B. xiaozhi-client 桥接 | **推荐** | 成熟 MIT 客户端，支持聚合多 MCP、Docker、Web 配置、后台运行；需核对其当前配置 schema |
| C. 自写桥接 | 兜底 | 仅当 B 不满足协议/权限需求时；成本与维护风险更高 |

## 3. 最小配置示例

见 `config/xiaozhi-client.example.json`。说明：

- `mcpEndpoint` 必须从**你自己的**小智控制台获取，不要提交真实值。
- `type: "stdio"`、`command`、`args`、`env` 字段需按所用 xiaozhi-client 版本的文档核对；README 未公开完整 schema。
- `MUSSE_ALLOW_UNVERIFIED_IWIKI` 默认为 `0`，即**拒绝连接**；只有在真实工具名/参数经授权确认后才设为 `1`。
- `MUSSE_ENABLE_REMOTE_IWIKI_WRITE` 默认为 `0`，即**禁止远程写入**；它是独立开关，不能被前一个开关替代。
- `IWIKI_MCP_TOKEN` **不要写入 JSON**：由操作系统环境变量或密钥管理在启动 xiaozhi-client 的父进程中注入，避免进入配置文件、源码、命令行历史和日志。

启动（在配置好且已授权后）：

```powershell
# 示例，具体命令以 xiaozhi-client 当前版本为准
xiaozhi start
```

本项目的 MCP Server 可单独运行用于检查：

```powershell
$env:MUSSE_IWIKI_STORE="fixture"
$env:MUSSE_FIXTURE_DIR="C:\Users\Lenovo\MuSSE-Lab\musse-readonly\software\musse-iwiki\fixtures"
node src\mcp\server.ts
```

未配置 iWiki 时，工具调用返回 `UNAVAILABLE`，不会读写本地文件或伪造成功。

## 4. 工具范围

暴露 13 个业务工具：任务创建/查询/更新/完成/归档/恢复、今天/未来/逾期日程、目标查询/记录进度、笔记创建/查询。

- 不提供删除文档、任意文档全文写入、批量覆盖。
- 目标不明确或格式损坏时返回错误，由调用方确认。

## 5. 运行依赖与失效条件

| 条件 | 结果 |
|---|---|
| Windows 开机、xiaozhi-client + MCP Server 运行、网络正常 | 小智可调用工具（真实 iWiki 适配验证后） |
| Windows 睡眠/关机 | 桥接断开，工具不可用 |
| iWiki 不可用/Token 失效 | 工具返回错误；不会写本地兜底 |
| MCP 工具名未确认 | 适配器拒绝构造，返回 `UNAVAILABLE` |

## 6. 持续在线的最简形态（未来，不在本批）

- 在常开 Linux 主机 / NAS / 树莓派上用 Docker 运行 `xiaozhi-client`，容器内挂载本 MCP Server。
- 仍需网络、电源、Token 管理与升级维护；不是“无服务器”。
- 不存在官方托管的第三方 MCP 桥接承诺（截至公开资料）。
