# MuSSE

**MuSSE** 是一个基于 ESP32-S3 和小智 AI（xiaozhi-esp32）的软硬件结合式 AI 陪伴机器人项目。

> **当前状态：M0（硬件核验与首次烧录准备）。** 截至 2026-11-02，尚无已验证运行的 MuSSE 固件、硬件接线或语音对话测试。最新事实见 [项目状态](docs/STATUS.md)。

## 项目目标

1. **基础语音交互**：复用小智的语音输入、音频播放及网络对话能力。
2. **实体交互**：OLED、按键；后续拟增加 LED 灯阵和扭动开关。
3. **软件扩展（规划）**：经合法授权后接入校园资源检索、快捷记录、长期记忆和主动提醒。

这是自主的 MuSSE 工程仓库，**不是**小智上游的官方仓库。当前先记录硬件、技术决策与实验，不急于直接复制整个上游固件源码。

## 新成员 / 新 Agent 从哪里开始

| 对象 | 阅读顺序 |
| --- | --- |
| 新组员 | README → [STATUS](docs/STATUS.md) → [HARDWARE](docs/HARDWARE.md) → [Issues](https://github.com/Qi0331/MuSSE/issues) |
| 编程 Agent | **[AGENTS.md](AGENTS.md)** → STATUS → 指派的 Issue → 相关代码或文档 |
| 负责固件 | [UPSTREAM](docs/UPSTREAM.md) → HARDWARE → [TEST_LOG](docs/TEST_LOG.md) |
| 负责规划 | [ROADMAP](docs/ROADMAP.md) → [DECISIONS](docs/DECISIONS.md) → [HANDOFF](docs/HANDOFF.md) |

## 当前已知硬件（来源：套装商品清单，尚未实物核验）

- ESP32-S3 N16R8 开发板
- INMP441 数字麦克风、MAX98357 音频功放、扬声器
- 0.91 英寸四针 OLED、三个轻触开关
- 面包板、跳线、USB 数据线

**候选**固件是小智 v2.5.2 的 `bread-compact-wifi`。具体板型、引脚、电压、外设兼容性以及是否能刷写，均以实物和测试为准。

下一步：提供开发板正反面及丝印照片；核验后先仅连接 USB，在 Windows 上确认设备识别情况，再安排外设接线与烧录。

## 文档索引

- [项目状态](docs/STATUS.md)（唯一权威进展记录）
- [硬件档案](docs/HARDWARE.md)
- [上游依赖](docs/UPSTREAM.md)
- [系统架构草案](docs/ARCHITECTURE.md)
- [路线图](docs/ROADMAP.md)
- [决策记录](docs/DECISIONS.md)
- [测试记录](docs/TEST_LOG.md)
- [交接记录](docs/HANDOFF.md)
- [贡献指南](CONTRIBUTING.md)
- [安全说明](SECURITY.md)

## 参考资料

- 小智上游：https://github.com/78/xiaozhi-esp32
- 候选发布：https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2
- 小智社区文档（非上游官方）：https://xiaozhi.dev/docs/

## 公开仓库提醒

本仓库按团队决定保持 **Public（公开）**。**不要提交 Wi-Fi 密码、API Token、设备凭证、私人订单、未经授权的校园资料或个人信息。** Git 历史中的泄露内容并不会因为删除文件而自动消失。

本仓库自身许可证尚未确定；引入小智上游代码时须保留适用的 MIT 许可证和版权声明。
