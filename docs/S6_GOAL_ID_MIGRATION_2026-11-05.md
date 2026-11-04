# S6 长期目标编号 Gxxx 一次性迁移

## 已提交代码，不等于远端数据已经改变

2026-11-05：S6 分支源码和测试已统一采用 G001、G998、G999（目标 ID 的正则表达式为 ^G[0-9]{3,6}$）。不接受旧 G-001 格式；不在本轮开发模糊搜索。Windows 设备还需要同步代码，真实 iWiki 的 G-998 和 G-999 必须迁移后才能运行新版 S6。

迁移只涉及固定的「长期目标」空间中现存的 G-998、G-999 两篇目标，和任务总表中如有的相关目标ID引用。原文档 doc_id、描述、阶段、进度历史、任务ID、其他知识库必须保持原样；不得创建/删除文档，不动 S4/S5 配置。

## Windows 操作顺序

1. 暂时关闭运行中的 xiaozhi start（设备语音桥接），迁移期间不发起目标工具调用，保持之前成功访问官方 iWiki 的网络模式。
2. 打开 PowerShell，依次执行（不要把 Windows 的私有配置发给任何人）。**本机 S6 可能有未推送的运行环境提交，因此使用正常三方合并保留本地历史，而非仅允许快进；若发生冲突则停止，不强制重置**：

    cd "$HOME\MuSSE-Lab\MuSSE-S6\software\musse-iwiki"
    git status --short
    git -c http.version=HTTP/1.1 fetch --no-tags origin feat/iwiki-s6-document-discovery
    if ($LASTEXITCODE -ne 0) { throw "Git fetch 失败，停止" }
    git merge --no-edit FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "本地提交与远端更改冲突，请停止；不得 reset --hard 或覆盖本地提交" }
    npm test
    if ($LASTEXITCODE -ne 0) { throw "测试失败，停止" }
    npm run migrate:s6-ids -- --plan
    if ($LASTEXITCODE -ne 0) { throw "只读预检失败，停止" }

3. 预检对远端完全只读；同时在 Windows 私有目录中先保存一次 G-998/G-999 和任务表的原始快照，确保即使后面需要网页手动改标题，也有迁移前备份。预检会打印 renameToolVerified、目标数、任务引用数及不涉密备份文件名，不泄露私人 ID、正文或 Token。

   A. 如果 renameToolVerified 为 true：执行

    npm run migrate:s6-ids -- --apply

   B. 如果 renameToolVerified 为 false：说明官方 MCP 没提供经过元数据验证的独立重命名工具。**先在 iWiki 网页把原来的两个页面标题分别改成 G998、G999，暂时保持正文中的「目标ID: G-998/G-999」不动**。不能复制新建，不得改变 doc_id，然后执行

    npm run migrate:s6-ids -- --manual-title --apply

4. 无论 A/B，执行模式都会重新检查精确作用域、标题、正文、任务表，并要求在终端独立输入完整确认文字：

    确认迁移 G998 G999

   脚本在任何远端写入前先将两篇原始正文和任务总表私有备份到 Windows 本机 musse-bridge 下 s6-goal-id-backup-*.json（不得上传）。之后逐项修改和读回，两篇目标最终名称、正文 ID 必须一致；只修改任务总表第九列中确实存在的旧目标引用。网络、读回或业务回执不明时立即停止，不盲目重试。

5. 只有执行返回 status: VERIFIED 后，再运行

    npm run migrate:s6-ids -- --verify

   只有再次返回 VERIFIED，才恢复 xiaozhi start 和 S6 语音功能。语音说“查询长期目标 G998”，核实后台传参为 G998，名称和进度历史正确。

## 任何失败的处理

- 如果在 --apply 开始之后超时、中断或出现错误，**不要重跑 --apply**，先在网页核对两篇目标的标题、正文目标ID及任务表实际状态，必要时依据 Windows 私有备份处理。网页重命名使 doc_id 改变时立即停止。
- --manual-title 模式只用于两个标题已经在网页手动改为新格式、而正文仍是旧编号的情形；其他混合状态必须停下核对。
- 完成过的真实写入验收脚本 accept:s6、recover:s6-progress 已在新版代码里退休，禁止重复执行。
- S4/S5、原有进度历史和固定映射不能被改写。模糊搜索留到下一阶段。

## 涉及源码

- src/goals/s6-goal-discovery.ts：Gxxx 格式、知识库全量扫描与严格核对
- src/goals/s6-official-port.ts：创建文档时的 Gxxx 严格校验
- src/mcp/s6-goal-protocol.ts：向语音模型公布新编号提示
- tools/s6-migrate-goal-ids-once.mjs：只读计划、带本机备份的单次迁移、只读验收
- tests/s6-*.test.*：回归测试、新格式拒绝旧格式和迁移模拟

**GitHub 上保存的只有迁移逻辑和说明，没有用户私有数据。**
