# S2-A：iWiki 官方 MCP 查询工具契约只读检查

## 2026-11-03 用户 Windows 实测：真实 read_doc 响应结构确认（最新覆盖）

- 用户从本 PR 分支检出 `c60da2c`，新增 `probe-read-structure.test.mjs` 在 Windows Node.js v22.23.2 下 **3/3 通过**。
- 用户在自己新建的非敏感 iWiki 测试文档上执行 `node tools/probe-read-structure.mjs --live`，以网页提供的 `page-...` ID 进行单次 `read_doc` 查询。输出中 `success: true`、`structuredContent: "absent"`；一条 MCP `content` 文本块经 JSON 解析为对象，其中字段为 `ok: boolean`、`data: { doc_id: string, title: string, content: string, ... }`。
- **证据边界**：探针的 `success: true` 仅代表 `isError` 未标记失败；脱敏摘要没有提供内部 `ok` 的实际值，也没有验证正文是否符合任务表 Markdown 规范。完整私人文档正文与真实 ID **未上传 GitHub**。
- 已新增 `src/store/official-iwiki-read.ts`：只有调用方显式提供逻辑文档路径到实际 `page-...` ID 的对应关系，才会调用一次 `read_doc({doc_id})`；按本次发现的 `ok === true` 与 `data.doc_id/data.content` 严格解析，不符合则失败。它**永远拒绝 write()/list()**，不导出远端错误正文，也不声称版本字段可用于并发写入。
- 新增 `tools/probe-task-queries.mjs`：在用户手工向专用测试文档填写虚构 12 列任务表后，**只进行一次远端读取**，在内存中执行已有任务服务的只读统计；仅输出数量而不打印任务名、内容或真实 ID。详见 [测试任务表模板与手工操作](S2A_TASK_TEST_TEMPLATE.md)。
- **验证分级**：用户 Windows 的真实 `read_doc` 响应形状已验证；官方只读存储适配器在隔离 Node.js v22.16.0 下对合成数据 5/5 测试通过（需 `--experimental-strip-types`）；任务汇总工具已提交但尚未完成用户 Windows 运行/业务端到端验收。生产桥接不受影响。


## 2026-11-03 用户 Windows 实测：S2-A 官方 tools/list 查询契约确认

- 环境：Windows PowerShell、Node.js **v22.23.2**；从 `feat/iwiki-s2a-readonly-contract` 独立克隆仓库。
- 用户回传：`node --test tests/inspect-readonly.test.mjs` **3/3 通过**；无参数的检查器只输出帮助；`node tools/inspect-readonly.mjs --live` 成功连接真实 iWiki 官方 MCP，广告工具 **27** 个，目标 **6** 个查询工具均存在。
- 已确认工具输入字段（来自 `tools/list`，**不是调用工具后的运行时验证**）：

| 工具 | 输入字段 | JSON Schema 必填 |
| --- | --- | --- |
| `list_spaces` | `q` | 无 |
| `list_docs` | `space_id`、`parent_id` | `space_id` |
| `list_doc_tree` | 无 | 无 |
| `search_kb` | `query`、`scope`、`space_id`、`limit` | `query` |
| `read_doc` | `doc_id`、`doc_path` | 无（不等于可以两者都省略） |
| `get_doc_outline` | `doc_id` | 无 |

- 本次不读取文档正文，不执行 `tools/call` 或任何写入。该输出没有显示凭证及私人文档正文；只说明输出路径的脱敏情况，不是完整安全审计。
- **阶段判断**：S2-A 的工具发现/输入字段核对已通过；`read_doc` 返回值结构、空间与文档路径映射、任务 Markdown 解析及语音业务调用仍未验证。用户的生产桥接继续保持原样。

## 下一步：自选测试文档的只读响应结构检查（仅显式运行）

本分支新增 `tools/probe-read-structure.mjs`，**默认只打印帮助，不读取私有配置、不联网**。用户如有**自己有权读取的非敏感测试文档**，可以从本分支 `git pull` 更新后，在 `software/musse-iwiki` 目录执行：

```powershell
node --test tests/probe-read-structure.test.mjs
node tools/probe-read-structure.mjs
node tools/probe-read-structure.mjs --live
```

第三条会交互询问使用 `doc_id` 还是 `doc_path`、输入该**测试文档**的标识符，然后要求再次输入大写 `YES` 确认。确认后**恰好只调用一次 `read_doc`**。它会在内存接收文档，但输出中只包含白名单内的通用字段名及其类型，不打印文档文本、ID、Token 或错误正文。如果选错文档，请在确认前退出。终端交互输入可能回显本地标识符，因此**只回传 `SAFE_READ_STRUCTURE_BEGIN` 与 `SAFE_READ_STRUCTURE_END` 之间的摘要**，不发整段终端记录。

没有适合的非敏感文档时**不要执行 `--live`**，可以先人工在 iWiki 确认存在一个可读的测试文档；不要为验收修改生产文档。若读取失败，脚本只返回通用失败原因，不提供可用于推断权限/数据内容的原始响应。此探针不对当前 `xiaozhi-client` 安装或配置进行任何更改，也不执行任务业务工具。

**离线新增校验**：开发侧隔离 Node.js v22.16.0 执行两份 `*.test.mjs`，6/6 通过；第二组 3 项涵盖结果脱敏、错误信息不泄露、只允许一次 `read_doc`。用户 Windows 的第三步**尚未执行**。


> 状态：2026-11-03 工具草案与 3 项脱敏/防越权离线测试完成；**尚未在用户 Windows 执行真实连接**，不代表任务业务 MCP 已联调。用户原有 ESP32 → 小智 → Windows → iWiki 语音知识库查询仍已实测成功。

## 目标及范围

这一步只获取官方 iWiki MCP 的查询工具元数据（`initialize` + `tools/list`），用以确认与任务业务层适配所需的真实工具名及入参字段。

**不做**：调用 `tools/call`、读取任何知识库文档或空间列表、创建/修改/删除 iWiki 内容、连接 MuSSE 任务业务 MCP、部署云端、修改 ESP32、重装 Windows `xiaozhi-client`、改动现有配置。

结果只输出六种已知查询工具是否出现及**参数字段名称、必填字段名称**。不输出完整 schema、描述文本、任何示例值、其他工具名称、URL、Token、私人文档或原始错误响应。字段名仍应在公开转发前人工检查。

## 离线验证（安全，默认不触碰私人文件或网络）

在有 Node.js >= 22.18 的电脑中，从该 GitHub 功能分支进入 `software/musse-iwiki`，执行：

```powershell
node --test tests/inspect-readonly.test.mjs
node tools/inspect-readonly.mjs
```

第二条不带 `--live` 时只打印帮助，不读取本机配置，也不连接网络。现有 `npm test` 已纳入新增测试，但历史 29 项全套回归在此 PR 阶段尚未重新运行。

## 实机只读检查（下一步，须用户在 Windows 明确执行）

保持现有正常工作的小智桥接配置原样，不复制、不改写任何凭证。在单独的 PowerShell 窗口，从该分支仓库的 `software/musse-iwiki` 目录运行：

```powershell
node tools/inspect-readonly.mjs --live
```

脚本默认只在**内存中**读取以下本机私有文件：

`$HOME\MuSSE-MCP-Local\musse-bridge\xiaozhi.config.json`

若本机路径不同，可传入 `--config <私有配置文件本地路径>`。该参数是**文件路径而不是 Token**；不要把凭证放到命令行参数里。脚本严格要求 `mcpServers.iwiki.url` 为 `https://ssemarket.cn/iwiki-api/mcp`，且使用本机既有 Bearer 凭证。

输出示例（以下完全为合成结构，不代表真实工具参数）：

```json
{
  "inspection": "S2-A tools/list only; no documents read and no write tools called",
  "totalAdvertisedTools": 27,
  "queries": [
    {"name":"list_spaces","present":true,"fields":[],"required":[]}
  ]
}
```

**注意**：这是结构示意；实际运行输出会包含六种查询工具，参数名称以实测为准。`totalAdvertisedTools` 仅统计当前 `tools/list` 响应的工具数；如果服务端采用分页，当前客户端尚未处理后续游标，不能据此断言全量。

失败时只输出通用信息，不打印原始 HTTP 响应。这个检查不保证 MCP 客户端的其他日志路径全部安全，也不能替代写权限服务端拒写的独立验收。

## 下一阶段的决策门槛

1. 获取上述**脱敏摘要**，确认工具名和真实参数字段；不需要用户提供 Token。
2. 判断能否利用 `list_docs` / `read_doc` 满足任务、日程、目标、笔记只读查询；**优先复用官方 MCP**，不要默认增加第二个运行中的业务服务。
3. 如确实需要把 iWiki 文档映射到 `WikiStore.read(path)`，另行实现**显式参数映射**与响应解析，不猜测空间 ID / 文档 ID / 内容字段的形态。
4. 后续仅用**虚构的、用户指定的测试文档**做读取验收，并在报告中只记录通过/失败及结构性信息，不记录真实文档文本。
5. 业务写入继续关闭；任何真实 iWiki 写入、权限负向测试均需要单独明确授权。

对应架构决策为 D-013 / D-014；当前已完成的通用语音查询见 [运行手册](../../../docs/IWIKI_LOCAL_MCP_RUNBOOK.md)。
