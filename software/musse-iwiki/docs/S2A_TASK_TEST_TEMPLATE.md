# MuSSE S2-A 测试任务表（完全虚构的数据）

> **仅用于用户在自己创建的 iWiki 测试文档中手动粘贴**。不得将私人任务、账号信息或本文件替换成生产数据后上传 GitHub。
>
> 建议在 iWiki 的 Markdown 编辑模式粘贴以下完整内容，保存后从网页确认表格有 12 列。你可以覆盖此前创建的**专用测试文档**，不要覆盖任何已有真实资料。此操作是用户本人在网页中手动完成，不是 MCP 写入测试。

```markdown
# MuSSE 测试任务总表

| ID | 名称 | 说明 | 分类 | 优先级 | 状态 | 截止日期 | 截止时间 | 目标ID | 阶段ID | 创建时间 | 完成时间 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-20261103-A101 | 虚构逾期任务 | 测试逾期判断 | 测试 | P1 | todo | 2026-11-02 |  |  |  | 2026-11-01 09:00 |  |
| T-20261103-A102 | 虚构未来任务 | 测试未来七天 | 测试 | P2 | todo | 2026-11-06 |  |  |  | 2026-11-03 10:00 |  |
| T-20261103-A103 | 虚构已完成任务 | 测试完成状态 | 测试 | P3 | done | 2026-11-01 |  |  |  | 2026-11-01 09:00 | 2026-11-01 12:00 |
```

## 安全验证命令

在先前克隆的 `$HOME\MuSSE-S2A-Check\software\musse-iwiki` 下：

```powershell
git pull
node --test tests/official-iwiki-read.test.mjs tests/probe-task-queries.test.mjs
node tools/probe-task-queries.mjs
node tools/probe-task-queries.mjs --live
```

前三条不使用真实凭证；第四条才会交互要求输入**测试文档**的 `page-...` ID、键入大写 `YES`，之后使用本机既有只读 Token 请求**一次** `read_doc`。随后在内存中运行已有 `TaskService` 的查询逻辑，最终只返回汇总数量，不打印任务名称、文档 ID、正文、Token 或原始错误。

在 **2026-11-03 北京时间** 且已正确保存上述三条虚构任务时，期望汇总：`taskCount=3`、`todoCount=2`、`doneCount=1`、`archivedCount=0`、`todayCount=0`、`upcoming7DaysCount=1`、`overdueCount=1`。如果稍后执行，日期相关数量应按实际北京时间重新计算。

只回传 `SAFE_TASK_SUMMARY_BEGIN` 与 `SAFE_TASK_SUMMARY_END` 之间的内容。失败时仅回传通用错误信息，不复制任何私人日志或完整交互记录。

## 本测试不能证明什么

- 尚未验证长期目标和快捷笔记业务文档的结构；
- 尚未验证 MuSSE 设备在语音中调用 `task_query`、`schedule_today` 等业务工具；
- 未开放真实 iWiki 文档写入；现有只读适配器 `write()` / `list()` 均拒绝；
- 尚未核实后端写操作的权限拒绝或真实版本冲突机制。

本模板用于 S2-A 的安全读验证，不代表已完成 S2-B 语音业务闭环。
