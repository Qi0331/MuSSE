# MuSSE iWiki S5-D 正式交接｜2026-11-04

> 最新优先级：本文件高于 S5-C/B/A 的测试结果说明；早期文件保留作为历史，不覆盖本阶段实际 GitHub CI 证据。

## 一、结论

**S5-D 完成“完整仓库持续集成（CI） + 过期/未知结果隔离加固”，但不是正式启用生产写入。**

- 分支：`feat/iwiki-s5-guarded-write-design`；Draft PR #25，base=`feat/iwiki-s2a-readonly-contract`。原 S4 Draft PR #24 保持原状，不合并。
- 为 `software/musse-iwiki` 添加 `.github/workflows/iwiki-node-tests.yml`；仅 `contents: read` 权限，无任何仓库/云端/私人密钥、部署或外部写入步骤。
- **实际 GitHub Actions 全仓库检出回归**：`iWiki Node tests` run ID `41784910123`、job ID `126424728412`，Node.js **v22.23.4**，`npm test` → **84 tests, 84 pass, 0 fail**。此前首轮 `80/81` 因旧测试把笔记日期硬编码为 2026-11-03；现已改为调用前后分别读取上海日期窗口，跨午夜不受固定日期影响。
- GitHub `Repository checks` 已在此前版本通过 `validate-docs`，只验证文档骨架而非 Node 测试；独立 Node CI 现在为正式的完整包测试证据。
- 安全专项由 S5-C 26 项增至 **29 项**（新增 3 项，全部在完整 CI 中通过）：提交进行中跨有效期仍保留并禁止同文档新准备；远端返回不确定保持 `UNCERTAIN` 并阻止同文档新准备；会被 Markdown 表格序列化改变含义的任务字段换行被拒绝。
- 重要：**84/84 是项目测试通过（含模拟 CAS 写适配器）**，不是 iWiki 真实写入、用户确认设备、生产权限或长期稳定性测试。

## 二、关键修复和对应测试

1. `software/musse-iwiki/tests/service.test.ts`：过去旧用例要求 `note.createdAt` 固定以 `2026-11-03` 开头。现使用 `shanghaiNow(new Date()).date` 在调用前后分别读取日期，允许极端跨日，但仍检验实际上海日期。
2. `software/musse-iwiki/src/write/guarded-write.ts`：
   - `COMMITTING` 不被确认 TTL 或新提案的过期清理误删，避免长操作失去在途状态。
   - `UNCERTAIN` 不自动转为 `EXPIRED`，保留其“可能已远端生效”的语义；同一文档存在 `COMMITTING/UNCERTAIN` 时拒绝新提案，避免不知结果再追加/创建。
   - 任务单行字段禁止回车换行，避免 Markdown 序列化将其静默折叠，而用户批准摘要对应的是另一段文字。
3. `software/musse-iwiki/tests/s5-guarded-write.test.ts` 新增上述三类离线回归，S5 29 项专项测试含在 `npm test` 的 84 项中。
4. `.github/workflows/iwiki-node-tests.yml`：独立包测试，`on: push / pull_request / workflow_dispatch`，`contents: read`，无凭证或写操作。

## 三、S5 真实写入尚未解决的硬阻塞

### 1. 官方 iWiki 原子条件写入

当前已证实的 `OfficialIwikiReadStore` 只能执行官方 `read_doc`，并返回空版本值；旧 `IwikiMcpStore` 写映射和结果形状未被真实契约确认。尚无足够证据证明 iWiki 官方支持原子条件更新（Compare-and-Swap，CAS）或原子追加、稳定操作 ID 幂等。**只读 tools/list 中看到 `version` 字段也不等于服务端原子校验。**没有真实契约就不能连接生产整篇 Markdown 写回。

### 2. 独立可信的真人批准通道

`createS5Gate` 分离 `untrusted.prepare/commit/status` 与 `trusted.approve/reject`，但没有可信 UI、物理确认或者已验证的客户端授权回调。**不能让模型或云端工具自己发送 `confirmed: true` 代替人类确认**。任何生产接入前须有明确 UI/通道设计、绑定摘要和单次授权证据。

### 3. 进程重启与不确定结果的耐久恢复

当前门禁只在进程内保存短期事务、回执及不确定标记。进程重启仍会遗失 `UNCERTAIN` 保护，不能把“内存里不重试”误宣称为跨重启幂等。生产接入前需通过 iWiki 内稳定业务 ID / 已证明的远端幂等协议 / 经明确批准的可审计恢复流程解决；iWiki 仍是唯一持久化数据源。

### 4. 其他现状

- S4-E 目标/笔记额外人工验收已按用户指示取消，勿恢复 S2-B 三文档人工验收。
- 快捷笔记真实文档映射未验证时，`note_create` 不可凭猜测接入；目标进度写入未列入当前 S5 受控白名单。
- 旧 `src/mcp/server.ts` 13 工具入口不可连接生产；官方 `iwiki` 与新 `musse_iwiki_readonly` 两现有 MCP 保持不变，Windows 日志脱敏补丁、防火墙、Muse 原角色提示词、ESP32 固件、云端和私有配置都未修改。

## 四、下一阶段 S5-E 推荐动作（无需重复 S4 验收）

- 优先获得**非敏感、只读的官方写工具契约证据**：可以基于现有 `tools/s5-inspect-write-contract.mjs`，在用户明确允许的 Windows 本地环境仅做 `initialize/tools/list`，且输出只包含脱敏字段摘要。若没有 CAS/原子追加的书面规范或安全隔离验证证据，直接维持生产写入禁用，而不是通过猜测硬接。
- 设计并离线验证真正独立的人类批准通道。无需为此修改现有双 MCP 或 Muse 风格；生产启用必须再确认。
- 为重启后 `UNCERTAIN` 恢复定义 iWiki 唯一持久化的处理契约。任何真实修改均需要独立明确授权。
- 持续通过 Draft PR #25 的全量 Node CI 与 docs 检查验证新改动。

## 五、安全声明

本批操作只修改 GitHub S5 分支源码、测试、CI 和说明文档；未访问或写入真实 iWiki 文档，未改 Windows/ESP32/云端/凭证/防火墙/日志。PR #24 和 #25 均保持 Draft、未合并。
