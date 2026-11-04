# MuSSE iWiki S5-F｜官方写工具发现与隔离探针（2026-11-04）

> 最新 S5-F 事实记录。沿用 S5-E 的轻量写前复读、二轮语音确认、写后复核方案；不另引入原子 CAS、批准 UI 或跨重启数据库。

## 用户 Windows 实测：只读 tools/list 成功

- S5 独立 worktree：`$HOME\MuSSE-Lab\MuSSE-S5F`，原 S4 工作目录未切分支。
- `git fetch` 与 `git worktree add --detach ... FETCH_HEAD` 成功，检查时 HEAD 为 `508e908`。
- 在 `software/musse-iwiki` 运行 `npm run inspect:s5-write -- --live`，官方 SSE_MARKET iWiki MCP 返回 `advertisedToolCount: 27`。
- 工具发现脚本只执行 `initialize` 和 `tools/list`，未进行 `tools/call`，没有读取或写入真实 iWiki 文档。
- 用户只提交了工具字段的脱敏摘要；没有提供 Token、文档 ID、私有配置或日志。

| 工具名 | tools/list 暴露的字段 | 必填字段 |
| --- | --- | --- |
| `write_note` | `title, content, space_id, source_refs` | `title, content` |
| `create_markdown_doc` | `title, content, space_id, space_name, parent_id` | `title, content` |
| `create_doc` | `title, content, space_id, space_name, parent_id` | `title, content` |
| `append_to_doc` | `doc_id, content` | `content` |
| `edit_doc` | `doc_id, content, title` | `content` |
| `edit_page_config` | `doc_id, config, title` | `config` |

所有六个候选 `hasVersionNamedField: false`。这只说明列表无类似 version/etag 的命名参数，不构成完整版本控制或服务端权限证明。

## S5-F 决策范围

1. **已有任务文档的更新**：优先考察 `edit_doc`，显式传 `doc_id` 与 `content`，不传可选的 `title`。尚未确认 `content` 的替换语义、保留其他文档元素的行为、成功响应结构和账号写入权限。
2. **快捷笔记**：`append_to_doc` 看似合适，但在没有真实笔记文档映射及追加语义验证前，不改变当前 S5 规划器的整篇快照行为；`write_note` 不自动等同于“追加到现有快捷笔记总表”。
3. **创建工具、页面配置工具**：本次不调用。现有私有映射仍只有任务总表，不能推断笔记或目标页面 ID。
4. **剩余不可从 tools/list 得知**：写响应包络 `ok/success`、失败响应、整篇替换还是局部编辑、网页侧保存后的 Markdown 规范化。需要经用户单独授权后，在一篇隔离测试文档上进行一次实际调用。

## 新增一次性隔离写入探针（仅代码，未执行真实写入）

- `software/musse-iwiki/tools/s5-probe-edit-doc.mjs`，默认无参数只显示帮助。
- 用户在 iWiki 网页手工创建**一篇新的隔离页面**，标题任意但应明确为 S5-F 测试用途；页面正文必须仅为一行 `MUSSE_S5F_ORIGINAL`，不得使用现有任务总表。
- 页面 ID 只放在 Windows PowerShell 当前会话环境变量 `MUSSE_S5_TEST_DOC_ID`；不写入仓库或桥接配置，不要求传给 ChatGPT。
- **仅在用户以后明确授权一次真实测试写入后**，才执行 `npm run probe:s5-edit -- --write-test`。
- 探针先调用 `read_doc` 校验该页面正文（trim 后）严格等于测试标记。否则停止，不调用写工具。
- 通过校验后仅调用一次 `edit_doc`，参数仅为测试页面的 `doc_id` 与 `content: "MUSSE_S5F_UPDATED"`；再读取一次，输出脱敏响应字段名、布尔状态及 `UPDATED/UNCHANGED/DIFFERENT/FAILED`。
- 超时或不确定响应也不重试；若结果不明确或读回异常，人工查看测试页后再决定，不能虚报成功。
- 不更改原 S4 工作目录、两个已有 MCP、Windows 桥接私有配置、Token、原有日志补丁/防火墙、Muse 人设、ESP32 固件或 PR Draft 状态。

## 后续验收（分层，不混淆）

- **代码与 CI**：探针及模拟测试在 PR #25 开发分支上；以本次提交的 GitHub Actions 最新结果为准。
- **Windows tools/list**：已由用户真实执行成功。
- **真实 edit_doc**：尚未执行、尚未取得本次独立写入授权。
- **生产语音写入**：尚未部署启用。隔离测试成功也不自动构成生产开启授权。

未来正式适配仍需根据真实 `edit_doc` 成功响应修正 `official-iwiki-best-effort.ts` 的确认逻辑；不是仅凭 tools/list 就宣称现有适配器可用。
