# MuSSE S5-G｜受控语音写入离线整合与受控部署前评审（2026-11-04）

> 这是 S5-G 当前阶段的最新结果；S5-F 的真实私人隔离文档写能力仍以 `docs/IWIKI_S5G_NEXT_CHAT_HANDOFF.md` 与 `docs/TEST_LOG.md` T-20261104-22 为准。**已完成离线整合，但未部署、未启用、未对真实任务/笔记写入。**

## 1. 仓库和实证

- 仓库 `Qi0331/MuSSE`；S4 `feat/iwiki-s2a-readonly-contract` / Draft PR #24；S5 `feat/iwiki-s5-guarded-write-design` / Draft PR #25（base 是 S4）。两 PR 均未合并。
- 阶段前 `da4394d` 的 GitHub Actions：完整 Node 套件 **130/130** 通过（run [41816644844](https://github.com/Qi0331/MuSSE/actions/runs/41816644844)），仓库文档检查成功（run [41816644660](https://github.com/Qi0331/MuSSE/actions/runs/41816644660)）。
- S5-G 开发提交 `8e2b320`：写适配器的业务回执/文档 ID 交叉校验、失败状态修正，以及十项跨协议离线测试；完整 CI **140/140** 通过（run [41817549089](https://github.com/Qi0331/MuSSE/actions/runs/41817549089)）。
- S5-G 续提交 `cd88bc9`：从可注入的 stdio 流按 JSON Lines 处理初始化、工具列表、准备和下一轮确认，追加一项真实传输层离线回归。GitHub Node 完整套件 **141/141 pass、0 fail、0 skipped**（run [41817781723](https://github.com/Qi0331/MuSSE/actions/runs/41817781723)），文档检查通过（run [41817781852](https://github.com/Qi0331/MuSSE/actions/runs/41817781852)）。
- 上述最新 141 项测试是 **GitHub Linux CI + 合成 iWiki MCP**，不是用户 Windows 本地或真实 ESP32/小智语音/远程 iWiki 全链路实测。Windows 真实既有证据仍是 `e1f30fc` **128/128**、私人测试页一次 `edit_doc ok:true` 且 `read_doc UPDATED`；不重复运行 S5-F 创建/编辑探针。

## 2. 已接通的 S5-G 离线路径

```text
语音意图（模型解析）
  → musse_write_prepare(intent)                [read_doc; 白名单规划]
  → 返回 operationId、完整改动预览、确认问题    [尚未写入]
  → 用户在下一轮明确说「确认写入 / 确认保存」
  → musse_write_confirm(operationId, spokenText)
  → 重新 read_doc 对比准备时正文                [不同则 CONFLICT，不写]
  → edit_doc({doc_id, content})                 [仅一次整篇 Markdown 更新]
  → 严格业务回执（ok:true、data.doc_id 同目标）
  → read_doc 读回精确比对                     [一致才 VERIFIED]
```

用户说取消时调用 `musse_write_cancel`；含糊回答不能确认，已取消/过期/重复的提案不能重新写。适配器拒绝 `isError:true`、`ok:false`、未知响应、相互矛盾的响应包络和不匹配的 `doc_id`；即使编辑工具回执为 `ok:true`，仍需写后读回确认。

核心文件：`src/write/official-iwiki-best-effort.ts`、`src/write/guarded-write.ts`、`src/write/voice-flow.ts`、`src/mcp/s5-voice-protocol.ts`、`src/mcp/server-s5.ts`；离线端到端测试为 `tests/s5g-voice-integration.test.ts`。

官方实测写参数严格为 `edit_doc` + `doc_id` + `content`；只有在将来用户另外批准时，才能在 Windows 私有配置中使用如下非秘密的**字段名契约**，不能把真实文档映射、账号或 Token 写进 GitHub：

```json
{
  "toolName": "edit_doc",
  "documentIdArgument": "doc_id",
  "contentArgument": "content"
}
```

## 3. 离线验收矩阵

| 场景 | 期望 | 当前离线 CI |
|---|---|---|
| MCP 初始化/工具列表，仅公开 prepare/confirm/cancel | 不泄露额外写工具 | 通过 |
| prepare 预览，含糊语音确认被拒 | 0 次编辑 | 通过 |
| 下一轮「确认写入/确认保存」 | 写前再读、一次 edit_doc、写后读回 | 通过 |
| JSON Lines stdio 两次独立输入、同一提案状态 | 无需私有配置/网络的真实协议分帧 | 通过 |
| 取消、重复确认 | 不再次编辑 | 通过 |
| iWiki 网页在确认前改动 | CONFLICT，0 次编辑 | 通过 |
| 写前 read_doc 失败 | REJECTED；无编辑、允许重新准备 | 通过 |
| 业务 ok:false、未知/矛盾回执、doc_id 不匹配 | S5_WRITE_UNCERTAIN；不盲重试 | 通过 |
| 编辑回执 ok:true 但读回仍未更新 | S5_READBACK_UNCERTAIN；不盲重试 | 通过 |
| 快捷笔记独立文档映射 | prepare/confirm/readback 路径相同 | 通过 |
| 未显式启用 S5 独立服务 | 默认拒绝启动，不读取私有配置 | 已有测试通过 |

写前 `read_doc` 失败时，更新工具尚未被调用，因此是**明确未写入**；之前误标为 UNCERTAIN 会让整个文档在当前进程中无谓地被阻塞，现改为 REJECTED。若已经进入更新调用而响应不明，才保留 UNCERTAIN 并禁止自动重复写入。

## 4. 工程判断与风险边界

**结论：S5-G 离线集成验收通过，可以进入「受控部署前检查/授权评审」；不能直接宣布生产语音写入可用。**

- 已验证：现成核心和 MCP/stdio 业务模拟链；实际私人合成 Markdown 页的官方编辑能力（来自 S5-F，非本次远端测试）。
- 未验证：实际小智语音连续两轮是否遵守工具调用约束；Windows S5 独立 MCP 注册/运行；正式任务总表/笔记对应 iWiki 页的写权限；断线后的现场操作；真实两轮语音写后核验。
- 用户接受的残余风险：最后一次 `read_doc` 与实际 `edit_doc` 之间仍可能发生网页并发编辑；**没有**声称服务端原子 CAS。口头确认由模型转发，也**不是**独立身份认证。进程重启后不承诺短期提案持久化或不确定写入幂等重试。
- 已有 iWiki 是唯一远程持久化数据源。此阶段不新建数据库、不迁云、不动 Windows 现有官方 `iwiki` 与业务 `musse_iwiki_readonly`、桥接、Token/日志安全补丁/防火墙、Muse 人设或 ESP32 固件。

## 5. 下一阶段仅需的受控部署前操作（均须另行批准）

1. **一次性同步与检查**：未来在 Windows 独立 `$HOME\\MuSSE-Lab\\MuSSE-S5F` 获取 S5 最新 HEAD、确认工作树无未提交私有变更，运行 `software/musse-iwiki` 的 `npm test`。不要求重做 S5-F 实写。
2. **私有目标与权限确认**：由用户在 Windows 本机审核任务/笔记的精确 `page-...` 映射和写权限，避免把合成页测试成功误推及生产任务文档；仅保留所需最低写权限，不向 Public GitHub 提交任何值。
3. **显式授权才部署**：用户逐项批准之后，才创建/检查本地私有 `musse-iwiki-write.json`、启用独立 `MUSSE_S5_WRITE_ENABLED=1` 及在 Windows 桥接中注册第三个 S5 MCP；不得替换/关闭 S4 双 MCP。提前保存桥接配置回退方式。
4. **语音侧人工验收**：明确复述预览、等待下一轮真实用户口头确认，确认/拒绝/取消/冲突/不确定响应不得由模型擅自补词。是否安排一次**用户另行许可的受控真实链路试验**在部署阶段单独决定，不能直接写真实任务总表，也不重复创建 S5-F 合成页。
5. **可回滚**：只需撤销独立 S5 MCP 注册或取消启用标志，原 S4 两服务保持不变；恢复时先核对可能处于 UNCERTAIN 的远端文档状态，禁止盲目重放。

现阶段**不得**自行执行第 1–5 步中涉及 Windows 私有环境或远端实写的操作。云端迁移是更后面的独立议题。

## 6. S5-G 补充：下一轮 Windows 本地预检（尚未执行）

为减少 Windows 上重复命令，增加了 `npm run preflight:s5 -- --local-readonly`。它只在用户 Windows 机器上**显式执行**时读取现有桥接与私有映射/写契约 JSON 的格式，在终端输出脱敏状态；不会打印 Token、真实文档 ID、正文或私有路径，也不会访问网络、启动服务、修改文件或启用 S5。无参数只显示帮助，不读私有文件。

它能核对 Node 版本、原官方 iWiki MCP 与 S4 只读 MCP 是否还在、S5 是否已注册、任务/笔记映射格式、当前是否存在符合已实测字段的 `edit_doc/doc_id/content` 私有写契约、当前 shell 是否设置写入开关。**状态检查不代表实际写权限或语音流程成功**；如写契约文件尚未创建，报告 `MISSING` 是当前阶段的正常情况。

接下来的实际验收顺序：用户允许后先在独立 S5 Windows worktree 同步最新分支并跑 `npm test` 与上述只读预检；再经用户单独授权讨论部署第三个 S5 MCP，以只预览/可取消开始，最后才对明确批准且内容结构符合业务规划器的**隔离测试目标**进行两轮语音试写。原 S5-F 合成文档只是写 API 探针，不保证符合任务表或快捷笔记业务模板，不可直接盲目重用作业务写入目标。

在此之前，不能声称 ESP32 / 小智 → Windows 桥接 → S5 → iWiki 真实语音写入已通过，也不应继续堆叠无必要的模拟用例。

## 7. S5-H 实际小智语音预览的安全注册入口（2026-11-04）

为尽快开始真实 ESP32/小智联调，新增可选的 `src/mcp/server-s5-preview.ts`，**只读** iWiki 文档，语音 MCP 只展示准备修改与取消两种工具；即使明确调用隐藏的 `musse_write_confirm` 也返回 `S5_PREVIEW_ONLY`。该服务无需写契约文件、不启用写入环境变量，不能调用 `edit_doc`。它不等价于 S5 真实语音写入功能验收。

Windows 独立 S5 工作区更新最新代码后，在 `software/musse-iwiki` 执行 `node tools/s5-preview-bridge.mjs --install-preview`，为小智配置追加仅一个 `musse_iwiki_s5_preview` stdio 服务，自动备份；原官方 iWiki 和 S4 只读 MCP 保留。**该操作只有用户明确运行命令才发生**，随后重启小智即可测试两轮“语音预览、取消”；如需撤销，执行 `node tools/s5-preview-bridge.mjs --rollback-preview` 并重启。GitHub S5-H [完整测试 148/148](https://github.com/Qi0331/MuSSE/actions/runs/41823641283)，但 Windows 实际安装与小智现场测试未发生。确认预览成功后，再另行考虑仅对批准的合规隔离文档启用写入能力。

## 8. S5-I 用户要求一次性部署的可写语音 MCP（2026-11-04）

用户明确要求跳过 S5-H 只读预览部署步骤，直接允许安装真实可写语音 MCP。代码已提供独立启动器 `src/mcp/server-s5-write.ts` 和 Windows `tools/s5-write-bridge.mjs`，执行 `--install-write` 可一次创建本地已验证 `edit_doc/doc_id/content` 字段契约、启动不访问远端的初始化 smoke、备份私有桥接 JSON 并注册 `musse_iwiki_s5_write`；默认 `server-s5.ts` 仍不自行开启。安装阶段不调用任何 iWiki 读写工具、不修改远端数据；仅用户另行明确口头确认准备好的提案后，才执行写前重新 read_doc → 一次 edit_doc → 写后 read_doc 对比。

回滚是 `node tools/s5-write-bridge.mjs --rollback-write` 并重启小智，只去掉第三个新服务，不恢复远端已有修改；原官方 iWiki 和 S4 只读 MCP 不变。当前真实 Windows 仍未运行安装/实际小智两轮语音；GitHub S5-I [153/153 CI](https://github.com/Qi0331/MuSSE/actions/runs/41824829014)。已知目前 Windows 私人笔记映射未确认，因此写能力首先针对现有的私人任务页 `taskDocId`，可能是真实任务总表；非语音测试专用隔离页。真实权限、文档 Markdown 结构与小智模型能否遵守下一轮确认仍须用现场结果验证。此处不声称服务端原子 CAS 或音频身份认证。
