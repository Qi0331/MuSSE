# MuSSE V1 第一批交付报告（审核修复版）

- 日期：2026-11-03
- 本地分支：`feat/iwiki-mcp-v1-batch1`
- 最新基线：`6331049e6a510c92b9b77a57bc8cb4969c4bf404`（已从 GitHub 获取；本地旧基线 `0ae87dd` 是其祖先）
- 运行环境：Windows、Node.js 26.1.0、npm 11.13.0
- 未使用真实 iWiki Token、未连接小智账号、未读写用户真实文档、未烧录硬件

## 1. 本轮审核修复

| 编号 | 问题 | 修复 |
|---|---|---|
| 1 | `tools/call` 返回 `isError=true` 仍可能报告成功 | `IwikiMcpStore.read/write` 检查 `isError`；写入还要求明确成功标记（`confirmed`/`ok`/`success`），否则 `IWIKI_WRITE_UNCONFIRMED`；写后仍读回校验 |
| 2 | 真实远程写入保护不足 | 新增独立 `MUSSE_ENABLE_REMOTE_IWIKI_WRITE`，默认 `0`；`MUSSE_ALLOW_UNVERIFIED_IWIKI=1` 不再解除写保护 |
| 3 | 任务表反斜杠丢失 | 仅 `\\`/`\|` 作为转义，其他反斜杠保留；固定校验 12 列表头名称与顺序 |
| 4 | 空阶段 `- 任务:` 吞入下一行 | 目标字段正则改用 `[ \t]*`，不跨行；空阶段返回 `[]` |
| 5 | goalId/phaseId 引用未校验 | 创建/更新时验证目标文档存在、ID 匹配、阶段存在；拒绝 `/`、`\`、`..`；目标统计校验归属、重复引用、归档口径 |
| 6 | `task_update` 可注入字段/类型 | 白名单仅 8 个可编辑字段；拒绝 status/completedAt/id 等；校验字符串/优先级类型；工具入参统一类型检查 |
| 7 | 笔记可注入标题、同分钟 ID 冲突 | 正文中的 `#` 标题行转义；同一分钟追加 ` #2`、` #3`，返回实际唯一 heading |

## 2. 测试

命令：

```powershell
cd software\musse-iwiki
node --test tests\*.test.ts
```

结果：**29 tests / 29 pass / 0 fail，退出码 0**。

## 2.1 第二轮复审修复（2026-11-03）

| 问题 | 修复 | 回归测试 |
|---|---|---|
| 新建 G-001/P1 任务后目标进度仍为 1/2 | 进度改为按任务表 `goalId + phaseId` 归属统计；文档任务清单仅作诊断（缺失/跨目标/重复/未列出/未分配阶段） | `goal progress counts new task-table ownership without editing the goal doc` |
| `G-OTHER.md` 声明 `目标ID: G-001` 仍可写入 | `recordGoalProgress` 追加前校验文档内 ID 与参数一致，不匹配即失败且不改文档 | `recordGoalProgress rejects a goal document whose ID does not match` |
| 进度说明含 `|`/换行导致截断或注入 | 说明规范化为单行；`\\`、`\\|` 转义并在解析时还原；注入字符串仍作为普通说明往返 | `progress notes round-trip pipes and normalize newlines`、`progress note cannot inject fake table rows` |

新增/更新的反例测试包括：

- `write tool isError=true is never reported as success`
- `write without explicit confirmation is rejected`
- `remote iWiki writes are disabled by default`
- `read tool isError=true is surfaced`
- `task table preserves backslashes and rejects reordered headers`
- `empty phase task line does not swallow the next field`
- `goal references are validated on create and update`
- `goal progress excludes mismatched, duplicate and archived tasks`
- `task_update rejects non-editable fields and wrong types`
- `notes escape headings and assign unique same-minute IDs`

## 3. 验收（对应原 10 项）

1. 解析虚构任务文档：通过。
2. 按 ID 读取/更新：通过。
3. 其他任务不被改写：通过（原文行比对）。
4. 创建/完成/恢复/归档：通过。
5. 逾期查询、完成不算逾期：通过。
6. 目标关联/进度：通过；新增归属/重复/归档校验。
7. 缺失 ID/损坏/冲突：通过；新增 `isError`/未确认写入失败。
8. iWiki 未连接明确不可用：通过。
9. 未配置 Token 不触发真实访问：通过。
10. 配置/日志/ZIP 无凭证：通过；示例配置不含 Token 字段。

## 4. 仍保留的未验证事项

- iWiki 真实工具名、参数、鉴权头、响应结构：**未验证**。
- 版本条件写入/原子冲突行为：**未验证**；真实写入默认关闭。
- 小智控制台是否支持直接第三方远程 MCP：**未证实**。
- `xiaozhi-client` 实际配置 schema、下游 transport：**未核对**，示例仅为占位。
- 真实账号权限、并发、WYSIWYG 格式变化：**未验证**。
- Windows 关机后的持续在线：**不可用**；未部署常驻组件。
- 富文本编辑对 Markdown 表格的影响：未在真实 iWiki 测试。

## 5. 基线处理

- 已获取并检出最新 `main`（`6331049`），从该提交重建本地分支。
- 保留主线已有 D-010、D-011、D-012、M1 显示核心归档与 5V/5A 采购记录。
- 新决策追加为 **D-013**；未删除或改写历史。
- 未 push、未创建 PR；docs 变更为本地草稿，交由 ChatGPT 审核合并。

## 6. 脱敏 ZIP

- 路径：`C:\Users\Lenovo\MuSSE-Lab\musse-iwiki-batch1-review.zip`
- SHA-256：见同目录 `.sha256` 文件（重新打包后生成）
- 包含：`software/musse-iwiki/` 源码、测试、模板、夹具、文档、报告、配置示例、五份仓库文档草稿、文件清单
- 不包含：node_modules、真实 Token、用户数据、Git 历史、二进制、Flash 备份
