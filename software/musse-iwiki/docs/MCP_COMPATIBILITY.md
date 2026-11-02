# iWiki / 小智 MCP 兼容性调查（2026-11-03）

> 证据等级：
> **[已证实]** 公开官方/源码可复核；
> **[未验证]** 有形态或间接证据，但缺少官方文档或授权联调；
> **[不可用]** 当前未授权/无凭证，不能测试。
>
> 本调查未使用任何真实 Token、未访问用户 iWiki 内容、未连接小智账号或接入点。

## 1. 已核对的公开来源

| 来源 | 能证明什么 |
|---|---|
| iWiki 上线公告 <https://ssemarket.cn/2026/07/12/iWiki上线/> | iWiki 是 SSE_MARKET 的“空间 → 文档树”知识库；支持 Markdown 在线编辑、多人保存合并与冲突处理、公开/私密/指定成员权限；**预留 Token** 供 Agent 自动上传/归档 |
| iWiki 登录页 <https://ssemarket.cn/iwiki> | 需要 UniSSO 统一身份认证；公开未登录状态看不到文档或 API 文档 |
| SSE_MARKET 服务端公开仓库（Gitee）`docs/native-forum-mcp.md` | **平台侧** MCP 入口使用 MCP 2025-06-18、Streamable HTTP、`Authorization: Bearer <PAT>`，PAT 形如 `sk_xq_`；工具契约、幂等键、冲突/不确定语义有明确说明。**这些工具属于论坛，不是 iWiki** |
| 同仓库 `docs/身份验证说明.md` | 平台 PAT/身份机制的公开说明（论坛入口，不直接等于 iWiki） |
| xiaozhi-client npm 元数据 | 版本 **2.3.0**，许可证 **MIT**，仓库 `shenjingnan/xiaozhi-client`，Node.js >= 22（推荐 24） |
| xiaozhi-client README | 支持小智官方服务器接入点、聚合多个 MCP Server、ModelScope 远程 MCP、Docker、Web 配置、后台运行；作为普通 MCP Server 集成到 Cursor 等 |
| 小智 v2.5.2 设备端源码（本地固定副本） | 设备端 `McpServer` 是在**设备固件内**注册 MCP 工具，与云端 `wss://api.xiaozhi.me/mcp/` 接入点不是同一层 |

## 2. 逐项回答

### Q1. iWiki 远程 MCP 支持哪种传输协议？

- **[未验证]** 端点形式 `https://ssemarket.cn/iwiki-api/mcp` 表明是 HTTP(S) 路径，但 iWiki 未公开协议文档。
- **[已证实，平台层]** SSE_MARKET 主站原生 MCP 使用 MCP **2025-06-18 / Streamable HTTP**（Go SDK）。这可作为平台技术栈的参考，但**不能直接断言 iWiki 采用同一实现**。
- 结论：**倾向 Streamable HTTP，但需授权后用 `initialize` 确认**。

### Q2. 实际如何鉴权？是否支持 HTTP Authorization 请求头？

- **[已证实，平台层]** 主站论坛 MCP 要求每请求 `Authorization: Bearer <PAT>`，只接受 `sk_xq_` PAT，不接受 JWT、query token 或参数中的 user_id。
- **[未验证，iWiki 层]** iWiki 公告只说“预留 Token”，未公开 Token 类型、请求头或权限范围。
- 实现中按 Bearer 头预留，但**不把论坛 PAT 当作 iWiki Token**。真实 Token 必须由用户放入受控环境，不写入仓库/日志。

### Q3. 官方公开了哪些工具？实际工具名、参数和响应结构？

- **[未验证]** iWiki 没有公开工具清单。
- 公开的是**论坛**工具（`forum_me`、`forum_feed_v2`、`forum_get_post`、`forum_comments_v2`、`forum_replies_v2`、`forum_notifications`、`forum_upload_image`、`forum_publish_v2`、`forum_action_status`），不能用于 iWiki 文档。
- 第三方 `ikeniborn/iwiki-mcp` 面向腾讯内部 iWiki（iwiki.woa.com），与 SSE_MARKET iWiki 不是同一系统，**不可套用其工具名**。
- 因此本批代码没有写死任何“已确认”的 iWiki 工具名；适配器必须从 `tools/list` 或授权后提供的官方文档解析，未确认前拒绝连接。

### Q4. 是否支持搜索、读取、创建和编辑？

- **[未验证]** 公开博客只承诺 Token 用于“自动上传与归档”，暗示创建/上传能力；读取、搜索、编辑未公开承诺。
- 业务代码按最小集合设计：读取/写入两个抽象操作；搜索不在第一批依赖中。
- 不允许在工具名未确认时伪造“创建/编辑成功”。

### Q5. 文档版本、更新冲突和权限错误如何处理？

- **[已证实]** iWiki 公告：多人同时编辑，保存时做合并，冲突有处理路径；权限分公开/私密/指定成员。
- **[未验证]** 是否通过 MCP 暴露版本号/ETag/条件写入，未知。
- 代码策略：
  1. 每次写入前读取当前文档与版本（若提供）；
  2. 写入时尽可能传 `expectedVersion`；
  3. 写入后**重新读取并比对内容**；
  4. 版本不支持或检测到变化时，拒绝覆盖并报 `CONFLICT`；
  5. 权限错误一律报错，不降级为本地存储。

### Q6. 小智 MCP 接入点与普通远程 MCP Server 是什么连接方向？

- **不同角色**：
  - 远程 iWiki MCP 是 **HTTP Server**，等待 MCP 客户端调用（客户端 → 服务端）。
  - 小智控制台接入点 `wss://api.xiaozhi.me/mcp/` 是**小智服务端等待客户端连接**的 WebSocket 接入点；`xiaozhi-client` 作为客户端主动连上去，并把聚合后的 MCP 工具注册给小智。
- 因此**不是“两个 MCP 地址互相直连”**；中间必须有运行中的 MCP 客户端/桥接。

### Q7. 当前小智平台能否直接连接第三方远程 MCP？

- **[未验证，倾向不能]** 公开资料只描述小智控制台提供一个接入点地址，由客户端连接并注册工具；没有公开“填写第三方远程 MCP URL 即自动代理”的配置。
- 需授权后在控制台确认是否有该入口；本批不访问账号，不下结论为“支持”。

### Q8. 如果不能直连，是否有可复用的现成客户端？

- **推荐 `xiaozhi-client` 2.3.0（MIT）**：
  - 连接小智官方接入点；
  - 聚合多个 MCP Server（README 明确“标准方式聚合多个 MCP Server”）；
  - 支持 Docker、Web UI、后台运行；
  - 可作为普通 MCP Server 集成到其他客户端。
- 仍需确认其当前版本支持的具体下游 transport（stdio/SSE/Streamable HTTP）与配置字段；README 未列出细节，必须按版本文档/实测核对，不能凭印象写配置。

### Q9. 桥接客户端停止运行后，小智是否会失去对应工具？

- **会。** 工具由客户端在 WebSocket 会话中注册；客户端退出/断网/Wi-Fi 掉线后，会话结束，工具不可用。这不是持久在线服务。

### Q10. 是否存在不自建持续运行服务器的可靠接入方式？

- **[未验证]** 目前没有发现官方托管“第三方远程 MCP 代理”的公开方案。
- 若必须让机器人始终可查询/修改 iWiki，需要一个持续在线的组件（Windows 常开、Docker 常开主机、NAS/树莓派等）。
- 官方小智控制台的 MCP 接入点本身不是托管桥接；不能声称电脑关机后仍可用。
- 最简单的部署形态：在常开 Linux/Docker 主机运行 `xiaozhi-client` + 本项目的 stdio MCP Server；但本批**不部署**、不采购云服务。

## 3. 结论

1. **已证实**：平台侧 MCP 技术栈（MCP 2025-06-18、Streamable HTTP、Bearer PAT）与 iWiki 的文档/权限/Token 预留存在，但**iWiki 的具体 MCP 工具契约未公开**。
2. **不能证实**：小智接入点可直接连接 iWiki 远程 MCP；不能证实 iWiki 支持搜索/编辑/版本条件写入。
3. **推荐路径**：`xiaozhi-client` 作为桥接，本项目 stdio MCP Server 聚合；Windows 常开时可工作，关机即失效。
4. 真实工具名、参数、鉴权头与错误码必须在获得单独授权后，通过 `initialize` / `tools/list` 和受控账号联调确认；在此之前保持 `UNAVAILABLE`，不伪造成功。

## 4. 写入保护（2026-11-03 审核后）

- **真实远程写入默认关闭**，与“承认工具契约未验证”的开关分离。
- `MUSSE_ALLOW_UNVERIFIED_IWIKI=1` 只允许构造未验证适配器，**不解除写保护**。
- 只有显式设置 `MUSSE_ENABLE_REMOTE_IWIKI_WRITE=1` 才允许写入，且仍要求：
  - 读取成功；
  - 工具结果 `isError !== true`；
  - 写入结果包含明确成功标记（`confirmed`/`ok`/`success`）；
  - 写后读回内容与目标一致。
- 任何一项不满足即报错，不报告成功；`isError=true` 时不会把旧内容相同误判为写入成功。
- 版本条件写入的具体参数仍未验证；在确认前，真实冲突检测不具备可靠性保证。
