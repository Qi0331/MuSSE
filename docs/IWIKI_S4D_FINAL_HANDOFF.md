# MuSSE iWiki S4-D 最终交接｜2026-11-04

> **新对话唯一优先入口**。优先于历史 `docs/IWIKI_S4_HANDOFF.md` 的 S4 待审规划；请区分用户现场报告与独立日志验证。

## 1. 当前实际状态与证据

**S4-D 任务和日程语音集成：已按用户现场反馈验收通过。**

- Windows 本机运行 `xiaozhi-client@2.3.0`，官方 `iwiki` MCP 与新增 `musse_iwiki_readonly` MCP **均正常**；新业务 MCP **6 个只读工具可见**，用户确认测试时**实际调用新增业务 MCP**。
- MuSSE 设备自然语言场景：任务数量**正常**、今日安排**正常**、近期与逾期任务**正常**、普通聊天**正常**。用户无需念 MCP 名称或工具名。只得到结果摘要，**没有每轮独立原始工具轨迹**，不可虚构调用细节。
- Windows Node.js `v22.23.2` / Git `2.54.0.windows.1`；指定 S4-B/C/D 离线单测 **10/10** 通过。真实官方 `read_doc` 读取 S2-A 纯虚构任务表，统计 **总 3、待办 2、完成 1、归档 0**；新业务 stdio MCP `--smoke`：`tools=6`、`write_blocked=true`、数据同上；`--install` 显示已保留原官方 MCP、已备份原配置、已新增本地服务，`--status` 显示存在。
- **未验证**：目标/笔记的真实读取和语音闭环、原官方远端 MCP 的服务端写权限是否必然被拒绝、长时间稳定运行、完整仓库 `npm test`、逐次原始工具调用轨迹。不能写成“全部 S4 六项工具真实验收通过”。

## 2. 当前架构与代码路径

~~~text
ESP32-S3（小智 v2.5.2 / bread-compact-wifi）
    ↔ 小智云端 MuSSE 智能体（S3-A Muse 角色提示词）
    ↔ Windows xiaozhi-client@2.3.0
       ├─ iwiki（官方远程 MCP）→ iWiki
       └─ musse_iwiki_readonly（本地 stdio MCP）
             → OfficialIwikiReadStore → 官方 iWiki read_doc → iWiki
~~~

**iWiki 是唯一数据持久化来源**；没有第二数据库或 Windows 任务镜像。六项只读工具：`task_query`、`schedule_today`、`schedule_upcoming`、`schedule_overdue`、`goal_query`、`note_query`。新服务是 `software/musse-iwiki/src/mcp/server-readonly.ts`，调用白名单拒绝写工具。**不要运行或部署旧的 `src/mcp/server.ts`（13 个工具，含写入）**。

Windows 私有目录（**不要公开内容**）：
- 桥接及 Token 配置：`$HOME\MuSSE-MCP-Local\musse-bridge\xiaozhi.config.json`
- 私有文档映射：`$HOME\MuSSE-MCP-Local\musse-bridge\musse-iwiki-readonly.json`，**目前仅映射任务表**；不得公开真实 `page-...` ID。
- 业务代码目录：`$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki`

已保留 Windows 本地日志脱敏补丁和 TCP 9999 入站阻止规则；不重新安装客户端、不开放端口、不改 ESP32 固件、不部署云端。不公开 Token、私有接入点、日志、任务正文、备份。

## 3. 运行和回滚

每次 Windows 开机仍需手动启动，电脑须保持运行：

~~~powershell
Set-Location "$HOME\MuSSE-MCP-Local\musse-bridge"
xiaozhi start
~~~

本机管理面板：`http://localhost:9999/dashboard`；检查两个 MCP 服务、新服务六工具。**没有自动开机服务、云端托管或电脑关机仍可查询的保证**。

若新服务异常，先在桥接窗口 `Ctrl+C`，随后：

~~~powershell
Set-Location "$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki"
node tools/s4d-bridge.mjs --rollback
Set-Location "$HOME\MuSSE-MCP-Local\musse-bridge"
xiaozhi start
~~~

`--rollback` 只移除新增本地 MCP 服务项，保留原官方 iWiki 配置；已有私人备份不得上传。

## 4. 仓库与已确定边界

- GitHub：`Qi0331/MuSSE`；功能分支 `feat/iwiki-s2a-readonly-contract`；[PR #24](https://github.com/Qi0331/MuSSE/pull/24) **Draft、未合并 main**。本文件、`docs/STATUS.md`、`docs/TEST_LOG.md`、`docs/HANDOFF.md`、`docs/DECISIONS.md`（D-018）共同作为权威交接。
- Muse 当前 S3-A 角色提示词归档 `docs/IWIKI_S3_PROMPT_CURRENT.md`；用户已在小智控制台使用自然、轻柔台湾腔的版本。此次自然语言工具调用成功，**不需要为了测试结果擅自修改提示词或人格**。
- **S2-B 人工三文档及多轮设备验收明确取消**，勿恢复；当前 S4-C 的目标/笔记只读代码虽然存在，**实际目标/笔记页面映射未配置，也未进行真实验收**。不要把取消验收写成通过。
- **S5 受控语音写入是确定的未来产品目标，但未授权实施**。尤其不能启用旧 13 工具服务、调用远端写工具、修改真实 iWiki、用提示词替代服务端权限控制。写入方案必须考虑逐次确认、最小权限、字段限制、并发冲突、幂等、写后读回、审计脱敏、失败恢复。
- 用户希望减少零碎步骤：以后一次性批量提供操作与脱敏结果，避免不必要的逐项确认。

## 5. 新对话建议下一步（只作为选项，未经授权不执行）

**路线 A：补齐长期目标/快捷笔记只读能力。** 只有用户希望实际使用该能力，才从 iWiki 中已存在的真实目标/笔记文档获取页面 ID，并**仅在 Windows 私有文件里**增加 `goalDocIds` / `notesDocId` 映射，做最小的真实只读和自然语言设备测试。无需新建虚构三文档，不改现有桥接总体架构。

**路线 B：S5 受控语音写入的设计评审。** 先研究官方 iWiki 写权限、可验证的写入和冲突语义，制定逐次确认、幂等与回滚方案；方案审查不等于批准执行真实写入。

也可以维持当前稳定状态，不做新变更。

## 6. 新项目对话开场提示词（复制下面整段）

请接手 MuSSE 项目 iWiki 业务集成的下一阶段。GitHub：`Qi0331/MuSSE`，分支 `feat/iwiki-s2a-readonly-contract`，草稿 PR #24 尚未合并。**第一步请读取并以最新内容为准**：`AGENTS.md`、`docs/STATUS.md`、`docs/IWIKI_S4D_FINAL_HANDOFF.md`、`docs/TEST_LOG.md`、`docs/HANDOFF.md`、`docs/DECISIONS.md`。不要按旧 S4 规划交接文件中的“尚待批准 S4-A”继续。

截至 2026-11-04，**S4-D 的任务/日程自然语言语音集成已按用户现场反馈验收通过**：Windows `xiaozhi-client@2.3.0` 同时连接官方 `iwiki` 与新业务 `musse_iwiki_readonly`；新 MCP 六个只读工具可见、用户确认被实际调用；任务数量、今日安排、近期/逾期、普通聊天均正常，无需用户口述工具名。Windows 指定离线测试 10/10，真实测试任务表读取总 3/待办 2/完成 1/归档 0，本地 MCP 写入拒绝测试通过。未独立拿到逐次完整调用轨迹，不要捏造细节。

**仍未完成**：当前仅映射任务表；`goal_query`、`note_query` 虽可见，真实目标与笔记未映射、未验收。S2-B 繁琐三文档验收已由用户取消，不能恢复。S5 受控语音写入是后续目标，但尚无实施/真实数据写入授权。iWiki 始终为唯一持久化数据源，Windows 保留本地脱敏补丁、防火墙、官方 MCP；ESP32 固件和当前 Muse 人设提示词不变。PR #24 继续 Draft，不合并、不泄露任何 Token、页面 ID、私有配置、日志。

**本新对话请先做**：简要复核当前 GitHub 事实和用户现场证据，给出下一阶段选项（优先考虑真实目标/笔记的最小只读接入，或先评审 S5 安全方案），并说明推荐顺序。等待我选择并明确授权后才进行下一阶段的真实连接、配置、代码修改或部署。后续安排请一次性批量化、减少来回确认。
