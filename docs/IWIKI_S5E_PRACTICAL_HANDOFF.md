# MuSSE iWiki S5-E｜实用版语音写入交接（2026-11-04）

> **最新权威口径**。覆盖旧 S5-D/A 文档中“远端必须支持原子 CAS、必须有独立可信审批 UI、必须做跨重启不确定事务持久恢复才能试用”的过严上线前提。旧文档保留为历史方案，实际实现与风险取舍以本文件为准。

## 一、用户确认的工程取舍

用户要求加快进度、避免过度防御性编程。个人低频使用，以功能可靠、结构简单为主。优先考虑 **iWiki 网页与机器人同时编辑**；不增加专门硬件确认、独立身份认证系统、事务数据库或复杂跨重启恢复框架。

保留四件必要的事：**修改预览、明确说出确认、写入前再次读取比对、写入后读取验证**。不在没有证据时把某个工具字段猜成 CAS。

## 二、当前实现（只在 S5 分支，未部署）

GitHub：`Qi0331/MuSSE`，`feat/iwiki-s5-guarded-write-design`，Draft PR #25（base 是原 S4 分支）；PR #24 继续 Draft、未合并。

- `software/musse-iwiki/src/write/guarded-write.ts`：保留既有业务白名单和短期事务；新增**显式选择** `concurrencyMode:"check-before-write"` 的轻量模式。默认 `atomic` 是既有兼容行为；S5 可选服务使用 `check-before-write`。
- `src/write/official-iwiki-best-effort.ts`：用已验证的 `read_doc` 读取 iWiki，使用**由真实 tools/list 确认并在私有文件显式配置的工具名与两个字段名**发起更新。无默认写工具名、不推断 API schema；仅识别明确成功响应，然后由门禁读回比对。
- `src/write/voice-flow.ts`：两轮口头确认；第一轮 `prepare` 返回具体改动预览、操作 ID 和询问语；第二轮用户明确说“确认写入”或“确认保存”后，助手才允许调用 `confirm`；说“取消”则不写。
- `src/mcp/s5-voice-protocol.ts`：仅三个可选工具 `musse_write_prepare`、`musse_write_confirm`、`musse_write_cancel`。不能在一个用户回合内同时自动调用 prepare 和 confirm。
- `src/mcp/server-s5.ts`：**独立、默认关闭的 stdio MCP 入口**。需私有配置及 `MUSSE_S5_WRITE_ENABLED=1` 明确启用。没有注册到 Windows 桥接，不影响现有 `iwiki` 或 `musse_iwiki_readonly` 两个服务。
- `package.json` 添加 `npm run mcp:s5` 和 `npm run inspect:s5-write` 命令入口；代码保留 S4 的全部只读服务、Muse 人设、Windows 日志脱敏补丁、防火墙和 ESP32 固件。

## 三、处理并发的实际方式与残余风险

1. 语音请求到来：读文档，算出改动，播报预览，等用户确认。
2. 提交前：**再次读取**。如果网页端或另一请求在这段时间改过文档，发现正文不同就**拒绝写入**，请机器人重新生成预览。
3. 如果未变化：提交一次，随后**再次读取核实结果**；未确认成功时不自动重复写。
4. 这里不是服务端原子 CAS；在第 2 步读取完、实际写入前的极短窗口，网页端仍有可能修改并被覆盖。**这是接受的低频个人使用风险**，不可以宣称绝对无冲突。
5. 只保留进程内短期状态，不另建本地数据库。若网络结果不明或进程重启，语音回复应要求先查看 iWiki 再决定是否重新操作。不能承诺跨重启准确去重。

**两轮语音确认是一种产品交互约束，不是独立身份认证。** 由于小智给 MCP 的确认短语仍由语言模型转发，服务端无法证明用户确实说出该词；主要防护是清晰预览、明确口述确认、一次只做一项操作及正常的模型工具使用指令。用户已明确偏向此简洁方案，不再开发单独批准 UI。

## 四、自动化证据

- GitHub Actions 独立全量 `iWiki Node tests` 在完整仓库、Node 22.23.4 运行 `npm test`。
- S5-E 完成写前比对/普通更新适配器和两轮语音流程后，新增假 iWiki MCP 适配器、口头确认、MCP 工具协议等离线测试。**以 PR #25 最新的 GitHub CI 日志为最终通过数量**，不要将旧 S5-D 的 84/84 当作全部新代码结果。
- 所有这些测试都不访问或写入真实 iWiki；尚未获取用户 Windows 生产授权，也未验证 SSE_MARKET iWiki 真实更新 API。
- 不能使用网上腾讯企业 iWiki 的 `saveDocument` 等接口名称替代 SSE_MARKET iWiki 的真实工具契约；它们不是同一服务。

## 五、现在唯一实际缺少的外部信息

**官方 iWiki 更新工具的真实名称、入参字段及响应语义**。当前公开文档没有可靠的 SSE_MARKET iWiki 写工具契约；现有 Windows 私人配置不在 GitHub，助手不能代用户读取，也绝不能编造工具名。

在 Windows 的完整 S5 分支检出目录中，可在用户愿意提供此**只读**信息时运行：

```powershell
Set-Location "$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki"
npm run inspect:s5-write -- --live
```

该命令只调用官方 MCP `initialize/tools/list`，不执行 `tools/call`，只打印候选写工具名和参数字段。**返回的字段名不必然等于可用更新语义**；真正配置前需核对该工具是否会替换目标文档且不会新增无关页面。只传脱敏摘要，不传 Token、真实页面 ID 或配置文件。

将来若完成工具契约确认，可在 Windows 本机私有目录增加 `musse-iwiki-write.json`（`toolName`、`documentIdArgument`、`contentArgument`），仍不放到仓库或桥接日志里。快捷笔记写入需已有真实 `notesDocId` 映射；任务写入可复用现有 `taskDocId`。**本轮不编辑这些私人文件，也不修改桥接服务列表或启用写入**。

## 六、下一步与验收边界

- 在获得真实写工具的脱敏 `tools/list` 摘要后，只针对确认的操作完成一次**隔离测试文档上的最小写入验证**（需用户另行授权），确认写入成功包络和读回行为；不恢复已取消的 S2-B 三文档复杂验收。
- 随后由用户决定是否把独立 S5 MCP 服务添加到现有桥接。原官方 MCP 和新只读 MCP 均保留。实际每次写操作先播报再确认。
- PR #24、#25 均保持 Draft，未经授权不合并、不碰真实任务/笔记、ESP32、云端、Muse 提示词或 Windows 安全配置。
