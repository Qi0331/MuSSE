# MuSSE 贡献与协作指南

## 建议工作流

1. 打开/领取 GitHub Issue，写清验收标准。
2. 从 `main` 拉出功能分支：`feat/issue-编号-描述`、`docs/issue-编号-描述` 或 `fix/issue-编号-描述`。
3. 做小而可检查的改动；提交前运行 `python scripts/check_repo.py`。
4. 创建 PR；填写更改、检查结果、未验证部分、关联 Issue。
5. 由至少另一位组员复查重要硬件/数据安全改动后合并；保护规则尚未设置时也遵守此约定。

## 提交规范（推荐）

- `docs: ...` 仅文档
- `chore: ...` 工程配置/维护
- `feat: ...` 新功能
- `fix: ...` 修复
- `test: ...` 测试

## 必须同步的项目档案

- 状态变化：`docs/STATUS.md`
- 执行过硬件/固件/服务测试：`docs/TEST_LOG.md`
- 架构、上游版本或引脚重要决定：`docs/DECISIONS.md`
- 任务交接：`docs/HANDOFF.md`

## 公共仓库

所有 PR / Issue / 附件默认可能被所有人看到，严禁上传密钥、私人订单、未脱敏校园数据。不要将未运行的示例标注为“验证通过”。
