# 上游来源与版本固定

## 已核对的公开来源

- 上游项目：https://github.com/78/xiaozhi-esp32
- 上游许可证：MIT — https://github.com/78/xiaozhi-esp32/blob/v2.5.2/LICENSE
- 当前**候选**版本：`v2.5.2`（发布于 2026-10-11）
- 发布页：https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2
- 当前**候选**变体：`bread-compact-wifi`
- 预期固件包：`v2.5.2_bread-compact-wifi.zip`（**尚未下载、解压、核对文件或 SHA256**）
- 对应源码参考：https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.h

## 正式采用某版之前必须记录

| 项目 | 当前状态 |
| --- | --- |
| 真实板型与 PCB 修订 | 待核验 |
| 固件变体与发布包链接 | 候选，待确认 |
| 发布来源 / SHA256 | 未验证 |
| 实际刷入版本、工具、操作系统 | 尚未执行 |
| 成功启动、联网、播放、录音证据 | 尚无 |
| 自研修改的上游 commit 与补丁 | 尚无 |

## 依赖维护原则

- 在首次硬件闭环之前，不复制整套小智源码进仓库；不要将大体积固件二进制提交普通 Git。
- 需要二次开发时由 Issue 决定是否采用上游 Fork、受控引入源码或独立固件模块，并锁定具体 tag/commit。
- 上游发布新版本不等于自动升级；升级必须有变更评估与回归测试。
- 分发修改的上游源码/二进制时遵守适用 MIT 许可证，保留版权与许可证文件。
