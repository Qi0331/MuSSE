# 小七 S6｜独立长期目标知识库发现与受控写入（2026-11-04）

> **状态（2026-11-04）**：用户已在 iWiki 完成「小七个人管理」页面目录，截图中《任务总表》是 12 列、4 行任务；《长期目标》是**单独的知识库**，不是已证实的普通子文件夹。Windows S6 worktree 已安装只读诊断并返回：45 个可见空间，精确唯一《长期目标》，该知识库 `docs=[]`、`total=0`、省略 `has_more`，无下一页游标；写入次数为 0。仓库现支持显式知识库范围模式 `{ "mode":"space", "spaceId":"..." }`，但**真实非空文档元数据、创建后的读回和语音写入尚未验收**。原 S5 成功不受影响。

## 1. 建议的实际个人空间

```text
个人 iWiki 空间/
└── 小七个人管理/
    ├── 任务总表                 ← 保留现有《测试》全部任务，固定 ID
    ├── 快捷笔记                 ← 固定 ID；原 notesDocId 仍待确认
    ├── 长期目标索引             ← 可选人工导航，无状态权威性
    ├── 长期目标（独立知识库）  ← 通过唯一知识库 ID 绑定，非 folderId
    ├── 历史归档                 ← 可选
    └── 使用说明                 ← 可选
```

所有待办仍放 **同一个** 12 列任务总表（真实状态来源）；目标页保存说明、阶段和进度历史，阶段关联任务按任务总表的 `目标ID + 阶段ID` 计算，不另建第二状态库。当前 S5 任务创建未自动填写目标 ID，目标任务关联编辑是后续独立能力；本次不修改 S5 行为。

## 2. 用户手工迁移《测试》——不能直接代为远程修改

1. 已有《任务总表》截图显示 12 列及 4 条记录；仍应由用户在本机核对原《测试》迁移前后的 doc_id 和全部记录，保留已有备份。
2. 用户已在个人 iWiki 下建立 `小七个人管理`，并建立页面显示为「知识库」的 `长期目标`；不要将界面上的知识库无证据地等同于 API 的 `parent_id` 文件夹。
3. 截图已出现《任务总表》和旧 S5 写入记录；尚未独立证明迁移保持了相同 doc_id。**不要**直接创建空《任务总表》取代旧页。
4. 在浏览器本机确认：迁移前后 `doc_id` 一致；12 列表头及历史任务行完整；再次从页面读取原记录。备份保留。
5. 如 ID 变化、目录错误或正文异常，**停止小七对任务表的写入**；只在核实新页面真实 ID 后，在 Windows 原本的私有 `musse-iwiki-readonly.json` 内更新 **`taskDocId` 一处**，避免继续写旧文档。不要把原始 JSON 解析错误/配置文件打印到聊天。

注意：移动操作是否保留 ID 必须现场验证，不能靠猜；Windows 私有文件与令牌不由 S6 GitHub 提交修改。

## 3. S6 设计与契约边界

新源码（实际 S6 根知识库模式）：

- `src/goals/s6-goal-discovery.ts`：支持 **`mode:"space" + spaceId` 的专属知识库范围**，旧 `spaceId + folderId` 模式仍可复用；仅允许标题为 `G-001` 等规范 ID 的文档；逐篇读取并检查正文 `目标ID`、重复标题/文档 ID、阶段 ID。
- `src/goals/s6-goal-flow.ts`：三种允许操作 `goal_create`、`goal_update`（标题、说明、新增阶段）、`goal_record_progress`（百分比只按固定任务表计算）。预览→下一轮用户明确确认→写前再次扫描/比对→最多一次写入→再扫描读回。
- `src/goals/s6-official-port.ts`：与官方 `list_docs` / `read_doc` / `create_markdown_doc` / `edit_doc` 的隔离适配。根知识库模式创建时只传明确 `space_id`、不虚构 `parent_id`；文件夹模式仍传 `space_id + parent_id`，编辑只按验证过的 `doc_id`。错误/不确定回执不自动重试。
- `src/mcp/s6-goal-protocol.ts`、`server-s6-write.ts`：**独立**的四工具 MCP，不复用或改装已部署的 S4/S5 服务。
- `tools/s6-inspect-directory.mjs`：新增**一次性只读**检查，输出字段存在性、数目及是否有完整性标记；不输出私人空间/页面 ID、标题、正文、令牌或原始响应。

**尚未被真实现场证实**：目标知识库非空时 `list_docs` 每篇文档的 `space_id`、`page_type`、`doc_id` 等字段和分页完整性，以及真实 `create_markdown_doc(space_id)` 创建后能否被列表发现；因此写入尚未部署。S5 隔离探针证实过单页创建/编辑，但不构成上述列表字段保证。因此正式适配器现在要求 `data.docs`、`data.total`、明示的 `space_id` 和 `parent_id`；响应不符合就拒绝写入，不能伪装为“没有同名文档”。此约束需通过本次新增的**一次只读**现场字段核验，再根据实证决定是否调整。绝不凭 `search_kb` 相关度直接编辑。

## 4. 私人配置（暂不需要修改；迁移完成且核实字段后再做）

既有任务映射 `musse-iwiki-readonly.json` 继续保留。S6 仅新增本机独立文件，默认与桥接配置放在同一目录，文件名 `musse-iwiki-s6-scope.json`；**以下只是字段格式示意，不能把占位值用于正式环境**：

```json
{
  "spaceId": "<仅本机填写真实私有空间 ID>",
  "folderId": "<仅本机填写长期目标目录真实父级 ID>"
}
```

S6 不需要在配置中列出每一个 `G-xxx` 文档 ID。目录锚点必须由用户从真实 iWiki 页面/只读元数据确认；不使用显示名猜测它。**不保存真实账号配置到 GitHub。**

已改进只读检查工具：**即使尚未配置 `musse-iwiki-s6-scope.json`，也可先调用 `list_spaces`，按《长期目标》精确名称寻找唯一候选，然后对该候选调用一次 `list_docs`**。只打印匿名字段形状、条目数、匹配数，不打印空间 ID、标题、正文或令牌；名称不唯一或返回结构不匹配时不猜测目标空间。可在**本机**运行一次：

```powershell
cd $HOME\MuSSE-Lab\MuSSE-S5F\software\musse-iwiki
npm run inspect:s6-dir -- --read-only
```

该路径是历史 S5 工作区的示意，实际需要先有包含 S6 的独立工作区；**不要在旧 S5 detached HEAD 上误以为直接就能运行新脚本**。如果私有 scope 文件不存在，运行的是只读 bootstrap 诊断；它**不会生成 scope 文件**、创建/编辑文档或安装 MCP。只传递脱敏后的结构摘要，不分享原始日志。即使识别到唯一同名空间，也不能替代真实的层级/分页验证。尚未核实返回结构时，不安装 S6 写入 MCP。

正式入口（**仅代码已存在，未安装**）：`MUSSE_S6_WRITE_ENABLED=1 npm run mcp:s6`，还要求私人连接配置、原 `taskDocId` 和有效 `scope`。运行时仍非原子条件写入；口头确认不是独立说话人鉴权，必须确保平台仅在用户**下一轮真实确认**后调用确认工具。绝不可先运行写服务，再回头核实目录。

## 5. S6 最小验收与边界

- 代码层：新功能模拟单测，重点检查歧义、跨目录、错误 ID、重复、无效确认、取消、写前冲突、远程不确定、读回不一致。原 S5 任务链路保留不动。
- Windows 本机：仅在用户迁移完成后，核实一次字段形状与正确文件夹归属；没有结构证据则停止。
- 真实语音：另行获得明确远程**创建/编辑某个指定目标**的授权后，只做一次预览/取消和一次明确授权写入/读回，不重跑 S5-F。
- 不动旧 S4 双服务、已上线 S5 服务配置、Token、ESP32、云服务器或其他 PR。所有 GitHub PR 保持 Draft。需尽快在相应平台轮换先前日志泄露的小智 MCP 令牌和 iWiki Bearer Token；轮换后仅本机改配置，不要贴回聊天。

已知限制：`list_docs` 当前响应契约尚需验证；非原子写有外部浏览器编辑竞态；未实现主动通知/调度；断进程后不持久保存不确定提案阻塞状态。以上限制不应被软件模拟测试的通过掩盖。


## 6. 已验证的知识库模式与最短后续步骤

2026-11-04 用户的本地只读运行明确返回：

- `list_spaces`：45 个可见知识库，`长期目标` 精确匹配 1 个且有 ID。
- `list_docs(space_id)`：`docs=[]`、`total=0`、无下一页游标，`has_more` 字段省略。
- `create_markdown_doc` 工具元数据声明支持 `title`、`content`、`space_id`、`space_name`、`parent_id`；仅 `title` 和 `content` 为必填。
- `list_doc_tree` 不声明 `space_id`，因此暂不调用它，也不根据不存在的 `folderId` 写入。

一次性本地作用域固定命令（由用户明确执行，**仅创建** Windows 私有 `musse-iwiki-s6-scope.json`，不修改原 `xiaozhi.config.json`、`musse-iwiki-readonly.json` 或远端 iWiki；若文件已存在则拒绝覆盖）：

```powershell
cd "$HOME\MuSSE-Lab\MuSSE-S6\software\musse-iwiki"
git -c http.version=HTTP/1.1 fetch --no-tags origin feat/iwiki-s6-document-discovery
if ($LASTEXITCODE -ne 0) { throw "更新失败，停止后续命令" }
git merge --ff-only FETCH_HEAD
npm run pin:s6-scope -- --pin-local
npm run verify:s6 -- --read-only
```

该命令重新以只读方式核实唯一同名、空知识库及总数，成功输出 `S6_LOCAL_SCOPE_PINNED`，不打印任何私人 ID。保留 scope 文件，后续不再重复固定。**知识库归属由用户在其 iWiki 网页确认**，仅同名唯一不是写入授权。

下一阶段：必须先有一个用户主动创建或明确授权创建的实际 `G-xxx` 目标页，单次只读检查非空列表的父目录/空间字段、类型和分页，再针对真实字段调整官方适配器。之后才考虑 S6 的受控预览、取消、确认及读回；**不提前运行 `mcp:s6`，不重复 S5 已通过的语音写入探针**。


## 7. 只读迁移核验

`npm run verify:s6 -- --read-only` 使用刚刚固定的 `mode:"space"` 作用域，实际检查目标知识库列表，并通过当前 Windows **原有** `musse-iwiki-readonly.json` 的 `taskDocId` 读取原《任务总表》：

- 检查返回的真实 `doc_id` 与 Windows 本地任务映射一致，标题确为 `任务总表`；
- 使用已有 `parseTaskTable` 严格解析 12 列结构和任务行，输出任务数而不是私人正文或 ID；
- 目标文档数仅统计经过完整范围检查的结果；当前独立知识库应为 0；
- 即使这一步通过，仍明确输出 `readyForWrite:false`，不会启用受控写入或擅自新建测试目标。

用户贴回仅 `S6_LOCAL_READ_ONLY_VERIFICATION` 匿名结构；如失败不得输出私有 JSON、令牌或完整报错。


## 8. 非空长期目标知识库实测（2026-11-04）

用户在《长期目标》独立知识库中手工创建隔离页 `G-999`，S6 只读诊断返回：固定作用域已生效；`list_docs(space_id)` 的 `docs` 数量为 1、`total` 为 1、没有继续分页游标；未提供 `has_more`、`parent_id`、`page_type`、`kind`；返回的页面含 `doc_id`、`title`、`space_id`。实际写入次数仍为 0。

因此在已绑定的专用知识库模式中，允许上述经过实测的非空格式，但只有在 `total===docs.length`、无分页继续标记、列表不满 100 条、每个 `space_id` 与绑定值一致时才接受。省略的文档类型标记为 `unverified`，之后逐页通过 `read_doc` 和 `parseGoal` 检验真实目标内容及一致的目标 ID；其他类型、跨空间、重复、计数不匹配等仍然拒绝。

已知限制：在大量文档、分页边界时 `total` 的正式语义尚未现场验证；这里采用不足 100 条的保守边界，而非宣称 iWiki 的全局分页契约已证实。

下一步在 S6 工作区先同步最新提交，再执行 `npm run verify:s6 -- --read-only`，预计 `goalDocumentCount=1`、`taskCount=4`、`readyForReadOnly=true`、`readyForWrite=false`、`writesAttempted=0`。这会完整读取和验证 `G-999`，不会修改目标页或任务表。真实 S6 写入仍需单独明确授权。
