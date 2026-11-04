# MuSSE iWiki S4-D：Windows 先离线测试，再审查接入

> 当前仅授权本机开发前检查。以下离线命令不修改现有 `$HOME\MuSSE-MCP-Local\musse-bridge\xiaozhi.config.json`、不连接真实 iWiki、不修改 ESP32/云端、不合并 PR #24。

## 第一步：在新的独立目录获取代码

在普通 Windows PowerShell（无需管理员权限）运行。若 `$HOME\MuSSE-Lab\MuSSE` 已存在，不覆盖它，先告知 ChatGPT。

```powershell
node --version
git --version
New-Item -ItemType Directory -Force "$HOME\MuSSE-Lab" | Out-Null
git clone --depth 1 --branch feat/iwiki-s2a-readonly-contract https://github.com/Qi0331/MuSSE.git "$HOME\MuSSE-Lab\MuSSE"
Set-Location "$HOME\MuSSE-Lab\MuSSE"
git rev-parse --short HEAD
```

必须确认 Node >= 22.18。预期分支最新提交见 PR #24；不要复制私人配置进入 GitHub 工作树。

## 第二步：仅执行离线检查

```powershell
Set-Location "$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki"
node --test tests/s4b-readonly.test.ts tests/s4c-readonly.test.ts tests/s4d-preflight.test.ts
```

三个文件共定义 10 项测试（4 + 4 + 2），结果以真实运行输出为准；此前隔离测试不算这次通过。

可选：回到仓库根目录执行 `python scripts/check_repo.py`，它仅检查文档骨架，不是运行时测试。

## 向 ChatGPT 汇报

只需 Node 版本、`git rev-parse --short HEAD` 结果、`tests`／`pass`／`fail` 三个测试汇总数字和错误类型。**绝不粘贴** `xiaozhi.config.json`、Bearer Token、WSS URL、私人文档 ID、整段终端日志或知识库内容。

## 后续步骤（暂不操作）

- 原 Windows `xiaozhi-client v2.3.0` 保持原状，必须保留本地日志脱敏补丁与 TCP 9999 防火墙规则，不重新安装。
- 未来在桥接配置所在目录新建私有 `musse-iwiki-readonly.json` 存放页面 ID 映射（代码中支持字段 `taskDocId`、`notesDocId`、`goalDocIds`）；该文件 **不得** 上传 GitHub。此时无需创建任何虚构 iWiki 测试文档，不恢复用户取消的 S2-B 验收。
- 待离线检查通过，并另行确认可以修改 Windows 配置与进行真实只读调用后，才添加第二个本地 `stdio` MCP 服务，并以设备语音确认工具实际调用。官方 iWiki MCP 保留，出现故障只移除新增服务项即可回滚。
