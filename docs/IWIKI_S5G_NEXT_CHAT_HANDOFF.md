# MuSSE S5-G｜新对话交接与本地／云端边界（2026-11-04）

> 本文件是 S5-F 结束后的新对话入口；优先级高于同日 S5-F 过程记录中“编辑未验证”的历史阶段性描述。用户明确要求：将最终结果推送 GitHub、随后新开对话继续工作，并了解未来云端迁移是否只是上传文件。**本次不部署 S5、不改 Windows 配置、不接入真实任务表写入、不迁云。**

## 一、仓库及对话／分支结构

- 仓库：`Qi0331/MuSSE`（Public；源码与脱敏文档已同步 GitHub，真实凭证不得提交）。
- S4：`feat/iwiki-s2a-readonly-contract`，Draft PR #24；Windows 原工作区 `$HOME\MuSSE-Lab\MuSSE`。S4-D 已实际完成任务/日程只读语音联调，现有官方 `iwiki` 与业务 `musse_iwiki_readonly` 两个 MCP 服务仍用。
- S5：`feat/iwiki-s5-guarded-write-design`，**base 为 S4 开发分支**，Draft PR #25；隔离 Windows worktree `$HOME\MuSSE-Lab\MuSSE-S5F`。最新提交应以 GitHub PR #25 head 为准；本地实测工作区停在 `e1f30fc`，后续 GitHub 已增加文档和模拟回归测试，不能声称用户 Windows 已拉到最新。
- **本轮 S5-F 已完成**：官方 iWiki 实写工具在单篇合成私人文档上验证；不是生产任务表、笔记或 ESP32 端到端写入验收。
- **新对话名称建议**：`MuSSE｜S5-G 语音写入链路集成`。继续使用现有 S5 Git 分支和 Draft PR #25，**不需因新开对话自动新建 Git 分支或合并 PR**。未来正式发布另行决策。

## 二、必须保留的实测证据

1. Windows 本地 `npm test` 在 `e1f30fc` 通过 **128/128**。S5-F 收尾后 GitHub 又新增两项模拟回归测试，**尚无最新版本 Windows/CI 完整通过的实际输出**，下阶段先核实。
2. 用户在 iWiki 当前账号可见空间中选择个人空间，首次合成测试在 `create_markdown_doc` 附 `space_name` 后返回业务 `ok:true`，创建标题 `MuSSE S5-F 自动隔离测试 8a6fc40f`，并通过 `read_doc` 校验初始正文。早先一次编辑返回 `ok:false`，具体业务错误未保存，读回 `UNCHANGED`。
3. 用户运行 `npm run probe:s5-existing-edit -- --edit-once`，本地输入空间名，脚本经 `list_spaces → list_docs(space_id) → read_doc` 精确定位原文档，用户再次输入 `EDIT`。真实 `edit_doc` 业务 `ok:true`；`data` 键有 `doc_id, title, new_rev_no, old_chars, new_chars`；`readback:UPDATED`，`outcome:EXISTING_EDIT_VERIFIED`。
4. 真实文档正文现在已经更新为合成测试更新标记。**不要再次运行 `probe:s5-auto` 创建新文档，也不要重复 `probe:s5-existing-edit`**；不需要再在同一文档证明基础写权限。
5. 这只证明当前凭证对特定个人空间 Markdown 页具有创建、读取、编辑能力；并不证明生产任务表、笔记页或其他空间拥有相同写权限，也不证明完整语音流程已部署。
6. 官方 `edit_doc` 契约：`doc_id`（指定目标，可选）、`content`（整篇 Markdown，必填）、`title`（可选）；三路合并保存，需编辑权限，冲突可能返回错误。官方业务回执 `ok:true` 必须结合写后 `read_doc` 判定实际成功；`isError:false` 本身不足以确认。

## 三、S5-G 下一步：做什么，不做什么

- 当前代码：`software/musse-iwiki/src/write/official-iwiki-best-effort.ts` 已是可显式配置 `edit_doc/doc_id/content` 的普通更新适配器；`guarded-write.ts` 有 `check-before-write`（修改前读、提交前重读比较、写后核对，承认读写间残余竞态）；`voice-flow.ts`、`src/mcp/s5-voice-protocol.ts` 已准备 `musse_write_prepare/confirm/cancel` 三工具；`src/mcp/server-s5.ts` 为**独立 stdio MCP**，默认拒绝启动，要求显式 `MUSSE_S5_WRITE_ENABLED=1` 加私有映射与写契约。
- 新对话首先检查最新 GitHub HEAD/PR/CI，核对新增真实 `textJson` `ok:true` 与 `ok:false` 模拟回归通过；再以最少改动做 **S5 语音调用链离线整体验证**：工具列表、prepare 预览、下一轮明确确认、写前冲突比较、写后读取、拒绝/取消、重复/不确定响应处理。
- 按用户选择的轻量方案，不引入与本项目规模不符的新 CAS 强依赖、独立审批系统或跨重启事务数据库；但保留明确确认、写前核对与写后复查。语音确认是对话级，不可声称实现独立身份认证。
- 不直接给生产任务表做试写；不擅自将 S5 MCP 注册到 Windows 桥接，更不擅自启用写入或改私人文档映射。只有用户另外批准的阶段，才讨论私有 `musse-iwiki-write.json` 与服务注册/回滚和真实语音验收。
- 原 S4 双 MCP、`xiaozhi-client` 本地日志脱敏补丁、Windows 防火墙、Token、Muse 人设、ESP32 固件不动。S4 PR #24、S5 PR #25 均留 Draft，不合并。

## 四、哪些在本地，哪些已在云端

| 组成 | 当前实际位置 / 作用 | 迁移含义 |
|---|---|---|
| MuSSE 项目源码、测试、脱敏说明 | **GitHub Public 已有副本**；Windows `MuSSE` 与 `MuSSE-S5F` 为本地 Git worktree | 未来服务器可从仓库部署，**不必把全部本地 worktree 当“服务器文件”整体上传**；但 GitHub 与本机 HEAD 需核对 |
| 小智 AI 智能体、语音对话及 MCP 接入点 | 小智官方云端 | 不必迁移整个小智语音平台；只需云桥接按支持的方式连其 MCP 接入点 |
| iWiki 知识库文档与修订 | SSE_MARKET **远程 iWiki**，官方 MCP `https://ssemarket.cn/iwiki-api/mcp` | 不需要把 iWiki 文档重新上传云端或新建数据库；云服务器按授权使用官方接口 |
| `xiaozhi-client@2.3.0` 桥接运行进程 | **Windows 本地运行**：`$HOME\MuSSE-MCP-Local\musse-bridge` 中执行 `xiaozhi start`；关机/睡眠会中断工具调用 | 云上需重新安装或部署兼容的常驻桥接进程，并验证自动启动、断线恢复与联网能力；不是“上传代码即运行” |
| 现行两个 MCP：官方 `iwiki` 和 `musse_iwiki_readonly` | Windows 本地桥接配置中注册；只读业务服务走 Node stdio 入口、官方 iWiki 走 HTTPS | 云端需重建服务进程/注册和绝对路径；若未来 S5 另需独立开启，仍须获批准 |
| 私有接入点与 iWiki Bearer Token、逻辑文档 ID 映射 | 仅 Windows 私有目录（`xiaozhi.config.json`、`musse-iwiki-readonly.json`；未来 S5 写契约也需私下保存） | 云上只能以保密配置／秘密管理器或严格权限的本地文件配置，**绝不能提交 Public GitHub**；迁移时检查凭证权限、撤销/轮换可行性 |
| Windows 的安全补丁、日志脱敏、TCP 9999 防火墙和手工启动方式 | 与当前 Windows 依赖和安装包关联，不保证可直接带到 Linux 云主机 | 云上需重新核对日志脱敏、端口仅内部访问、访问控制与网络策略，禁止把本地 9999 管理页暴露公网 |
| ESP32 固件、烧录备份与设备调试文件 | 用户实物与电脑本地，部分固件/备份不在 Public 仓库 | 不属于服务器代码迁移；不需要为桥接迁云而刷机，除非新连接架构确实要求 |

**结论**：当前是“云端小智 + 本地 Windows MCP 桥接 + 远程 iWiki”。迁云实际要迁的是**长期运行的桥接及业务 MCP 计算进程**，不是已在远程 iWiki 的数据；步骤包含云主机选择、运行时/依赖、私有凭证安全配置、桥接连接、服务守护/重启、端口与日志防护、功能回归及 Windows 回退。单纯上传文件不够。用户目前**没有授权**云部署、开通付费实例、开放公网端口、移动凭证、关停本地桥接。

## 五、新对话执行准则

1. 优先阅读本文件、`AGENTS.md`、`docs/STATUS.md`、`docs/HANDOFF.md`、`docs/TEST_LOG.md` 的最新段落和 `docs/IWIKI_S5E_PRACTICAL_HANDOFF.md`；不要被旧历史阶段中“真实写入尚未验证”的描述误导。
2. 先核对 GitHub PR #25 最新 head 与运行记录；用户 Windows 当前只知道完成 `e1f30fc` 的 128/128，不得假定随后远端新增回归已经本机验证。
3. 有写入权限的工具只用于仓库开发与经授权的隔离测试；生产文档修改、真实部署、Token 移动、云付费资源都须逐次征求批准。
4. 保持简洁、尽量在 GitHub 直接改代码和文档，不要让用户反复复制大片脚本。Git Windows 网络曾间歇失联，必要时用 `git -c http.version=HTTP/1.1 fetch` 并检查退出码，切勿误用旧 `FETCH_HEAD`。
