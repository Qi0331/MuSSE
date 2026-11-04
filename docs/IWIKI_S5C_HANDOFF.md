# MuSSE iWiki S5-C 交接｜2026-11-04

## 本批结果

- **分支**：`feat/iwiki-s5-guarded-write-design`；**PR #25 为 Draft，base 为 S4 分支**；原 PR #24 仍 Draft、未合并。
- **核心新增/修正**：
  - `src/write/guarded-write.ts`：准备阶段并发容量占用、预览摘要绑定、短期成功回执缓存、重复提交防护；不连接生产写入端口。
  - `src/write/plan-write.ts`：创建/更新任务及笔记的用户批准预览展示具体完整值；当预览超限时，由门禁拒绝，而不是偷偷截断后接受确认；拒绝将笔记追加到标题不符合现有格式的文档。
  - `tools/s5-inspect-write-contract.mjs`：默认只打印帮助；用户在本机显式指定 `--live` 才会读取既有私有配置并对官方 iWiki 执行 MCP `initialize` / `tools/list`；**绝不执行 `tools/call`**。只输出疑似写工具名称、参数字段名称、必填字段，过滤工具描述/参数示例/实际参数值/令牌。字段名称含 `version` 等只是候选信号，不能证明并发安全。
  - `tests/s5-inspect-write-contract.test.mjs` 和两份增强的 S5 测试。

## 验证证据及局限

- **开发侧实际运行**：Linux Node.js 22.16.0（低于项目要求 >=22.18），命令：
  `node --experimental-strip-types --test tests/s5-guarded-write.test.ts tests/s5-plan-write.test.ts tests/s5-inspect-write-contract.test.mjs`
  **26 tests / 26 pass / 0 fail**。
- S5 六个代码/测试文件的 Node 语法检查：**6/6 通过**。
- 开发侧为离线运行，把仓库中涉及的解析/日期/类型模块按可见源码暂存于隔离目录，**并非完整 Git 检出**；上述结果严格限定为专项离线验证，不能宣称完整仓库原样回归通过。
- GitHub 上这六个 S5 源码/测试文件的 blob SHA 已逐一与本地 `git hash-object` 对照，**6/6 一致**。
- PR #25 此次最新提交所关联的 GitHub Actions `Repository checks` / `validate-docs` 成功，但该工作流只验证文档骨架，**不等于 `npm test`、真实 Windows MCP、设备或远端 iWiki 测试**。
- **未执行**：完整 `npm test`、完整仓库 `python scripts/check_repo.py`（开发侧）、Windows Node >=22.18、设备语音写入、官方远端写权限负测、任何真实 iWiki 修改。

## S5 仍然不能生产写入的原因

1. 已验证的官方读取 `read_doc` 只返回文档文本，当前 `OfficialIwikiReadStore` 版本令牌为空；**未确认官方有原子条件写入（CAS）/可靠幂等工具**。写前读取再比较哈希无法防止其他客户端在检查与写入之间修改文档。缺少原子语义时，整篇任务表和笔记文档写回都必须拒绝。
2. `createS5Gate` 提供 `trusted.approve` 能力接口，但**尚无可信用户动作渠道**与之绑定。模型/语音助手传入 `confirmed:true` 或重复用户语音不能自动等于服务端可信授权。
3. 即使对 `tools/list` 的写候选字段检查成功，它也**不能证明权限、参数实际响应或原子性**；必须进一步获得厂商文档或专门经批准的隔离测试证据。

## 下次一次性批量操作建议

在用户 Windows **完整仓库** Node 22.23.2 环境，用同一批只读/离线命令跑：
```powershell
Set-Location "$HOME\MuSSE-Lab\MuSSE"
git status --short
Set-Location "software\musse-iwiki"
node --experimental-strip-types --test tests/s5-guarded-write.test.ts tests/s5-plan-write.test.ts tests/s5-inspect-write-contract.test.mjs
npm test
Set-Location "..\.."
python scripts/check_repo.py
```
以上不会调用生产写入，**但执行前须确认本机分支已更新并检出到 S5 分支**，避免误在 S4-D 目录运行找不到新文件。暂不要求用户现在执行。
如果用户明确授权从其 Windows 既有只读连接做**只发现、不调用**的契约检查，可另在 S5 工作区运行：
```powershell
node tools/s5-inspect-write-contract.mjs --live
```
这一步只枚举 MCP 工具，不等于生产写入授权。回传只能是审查过的脱敏字段摘要，严禁原始私有配置、完整日志和内容。

## 安全保持

iWiki 唯一持久化；官方 `iwiki` / 新 `musse_iwiki_readonly` 双服务不变；Muse 角色提示词、Windows 日志脱敏补丁、TCP 9999 防火墙规则、固件和云端配置不改；绝不启用旧 13 工具写入服务器，不合并 PR #24/#25。
