# MuSSE 最新交接（2026-11-02 晚间）

## 2026-11-03 追加：iWiki 单数据源 V1 第一批（审核修复版）

- 基线已更新为最新 `main`（`6331049`）；本地分支 `feat/iwiki-mcp-v1-batch1`，未推送。
- 新代码：`software/musse-iwiki/`；D-013 覆盖原 B+C 实施方向，D-010/011/012 与 M1 显示核心、5V/5A 采购记录保留。
- 已完成：任务/日程/目标/笔记逻辑、模板、25 项离线测试、MCP stdio、iWiki 协议客户端与默认只读适配、小智桥接方案。
- 未完成（需授权）：真实 iWiki `initialize/tools/list`、读写/权限/冲突；小智与 `xiaozhi-client` 联调；持续在线部署。
- 安全：真实远程写入默认关闭；Token 不进入配置文件/源码/日志；无凭证时 `UNAVAILABLE`，不回退本地。
- 本批不改变 M0/M1 硬件与显示状态。

## 本轮结论与工作方向

**M0 的最小可复现真机闭环已完成**：ESP-IDF v6.1 Hello World 由 Reasonix 报告烧录与哈希验证通过，115200 CH343 串口 5 次正常启动、4 次软件自动复位；原厂 `led_strip` 已保存 16 MiB 私有 Flash 备份。新建的 `gpio_button` 本地工程已编译，但默认 GPIO 全禁用，**未烧录也未实测按钮**。

**M1 准备有实质进展**：小智 `v2.5.2` / `bread-compact-wifi` 已在 Windows 使用 ESP-IDF v6.1 本地完整构建成功（Reasonix 报告，未独立校验本机二进制）。上游源码 commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`；研究报告在 `C:\Users\Lenovo\MuSSE-Lab\reports\xiaozhi-v2.5.2-analysis.md`，未上传仓库。本次 GitHub 仅同步脱敏结果和进度，不上传本地实验源码、上游 clone、镜像或原 Flash。权威状态见 [STATUS](STATUS.md)，真实记录见 [TEST_LOG](TEST_LOG.md)。

## 新对话优先任务

1. **优先开发功能而非继续堆基础板测试**。先在独立 MuSSE 模块中实现硬件无关的 `16×16` 帧缓冲、`Idle/Listening/Thinking/Speaking/Error` 表情帧/动画、状态映射、PC 离线渲染与单测。之后再评估小智 `DeviceStateMachine::AddStateChangeListener` / `Led::OnStateChanged()` / `Display::SetEmotion()` 的最小适配方式。不要立即修改锁定上游源码。
2. **两块不同矩阵不可混淆**：已持有的创乐博 I²C 16×16、2×HT16K33A（5V、地址/上拉未知），另有用户新购商品图中的 **5V WS2812B 16×16 RGB**（256 颗、单数据线、可能有高峰值电流，实物未核验）。两者底层驱动、供电、映射与效果都不同。BSS138 四路模块计划用于 **I²C** 电平转换，不能默认用于 WS2812B 高速数据。两块灯板都暂不接 ESP32、不上电。
3. **供电**：用户选择长期 USB 5V 有线桌面方案，取消当前电池双供电设计。用户提供了标称 5V/3A 适配器与 14500 电池模块的购买截图，但非已核验实物；不将 14500 模块接入 MuSSE。需按 LED + 功放峰值电流核定供电，注意 USB 调试和外部电源反灌风险。
4. **待到货**：INMP441、MAX98357、扬声器、OLED 此前均未到货；是否已到货以用户新照片/确认更新，不先验判为已拥有。

## 本地开发环境、路径与证据

- PowerShell + ESP-IDF `C:\esp\v6.1\esp-idf`；激活脚本 `C:\Espressif\tools\Microsoft.v6.1.PowerShell_profile.ps1`。Windows CH343 通常 COM6，执行前应重新确认；勿用 Git Bash/MSYS 运行 `idf.py`。
- `C:\Users\Lenovo\MuSSE-Lab\hello_world`：官方 Hello World 已真机成功。
- `C:\Users\Lenovo\MuSSE-Lab\gpio_button`：按钮/输出均默认关闭，独立编译成功，尚未烧录。
- `C:\Users\Lenovo\MuSSE-Lab\xiaozhi-esp32-v2.5.2`：上游只读研究副本，`git status` 干净；构建成功但未烧录。
- `C:\Users\Lenovo\MuSSE-Lab\musse-readonly`：Reasonix 本地阅读 GitHub 仓库副本。
- `C:\Users\Lenovo\MuSSE-Lab\reports\xiaozhi-v2.5.2-analysis.md`：本机研究报告。
- **禁止上传**：`C:\Users\Lenovo\MuSSE-Private-Backups\esp32s3_factory_20261102.bin`（完整原 Flash）以及可能带设备标识的原始串口日志。备份 16,777,216 字节、SHA-256 `cd0f30ac9491da499eaf2167f07b5accf23cf6779c506110431aa766f346273e`。
- 上游构建：`python scripts/build.py bread-compact-wifi --name bread-compact-wifi`，报告退出码 0；`xiaozhi.bin` 2,577,504 字节，SHA-256 `3c77df039b71f03de25dca21bcd49d91fe8bf591ff7fd8259685feb1d94c7e12`。
- 小智构建分区包含 bootloader 0x0、分区表 0x8000、OTA data 0xD000、应用 0x20000、assets 0x800000；**切勿将它与 Hello World 的单应用分区/0x10000 应用烧录混用**。

## 已识别上游软件接口（Reasonix 源码审查报告）

- 状态：`main/device_state.h`、`main/device_state_machine.{h,cc}`；`AddStateChangeListener(callback)` 可观察状态切换；`Application::SetDeviceState()` 触发 UI/LED 变化。
- 显示：`Display::SetEmotion(const char*)`；灯光：`Led::OnStateChanged()`；`Board::GetLed()` 按板型提供灯驱动。
- 建议先做独立硬件无关表情逻辑，不在未确认两块矩阵驱动与供电前把 HT16K33A 或 WS2812B 写死为唯一实现；保留 5 个核心状态表情。

## 协作与权限

用户将完整提示词交 Reasonix CLI，在另一台 Windows 电脑执行并回传报告；ChatGPT 制定方案、验收并记录。相关只读查询与本地编译可批量推进，不必每个命令停一次；**烧录、擦除、危险接线、远程对外发布和敏感信息必须按授权执行**。常规代码/文档经功能分支与 PR 合入；尽量阶段末集中更新。无用户明确要求不得擅自刷入小智、接电池或外设。

当前问题入口：[Issue #1](https://github.com/Qi0331/MuSSE/issues/1)、[#4](https://github.com/Qi0331/MuSSE/issues/4)、[#10](https://github.com/Qi0331/MuSSE/issues/10)、[#11](https://github.com/Qi0331/MuSSE/issues/11)。社区外部评论涉及 GPIO、WS2812 与 HT16K33A 的安全事项，仅作调研线索。

## 2026-11-02 追加交接：官方平台与 M1 执行方案调整（以本节为最新）

- 用户已登录小智官方控制台 2.0，创建 `MuSSE` 智能体（未绑定，0 台设备）。截图观察：小智 Lite、记忆已开但 0 条、天气/笑话/音乐/新闻/知识库服务勾选、知识库内测空白测试库 0 文档且智能体未使用、MCP 接入点可见但状态“加载中”、云端编译历史为空。所有这些仅属于**用户界面观察**，没有发出真实 MCP、记忆或设备测试。详见 [XIAOZHI_PLATFORM.md](XIAOZHI_PLATFORM.md)。
- 重新评价源码复用：小智 v2.5.2 已有音频/AI/情绪/显示接口，后续 MuSSE 不应从零复制语音/对话系统。优先核对上游 SetEmotion 与状态机事件，独立开发必要的 16×16 像素转换、动画与可替换 Sink，保持 HT16K33A/WS2812B 底层分离。
- **最新 Reasonix 工作包**：单次批量完成上游接口真实调用路径核验、Windows 本地 C++ 实现/单测、真实 C++ 帧驱动的离线预览、隔离副本的最小侵入集成可行性与编译验证、脱敏交付报告；不得烧录/接线/云端提交。不要覆盖原研究副本，也不要自行推送 GitHub（本次文档同步由 ChatGPT 另行完成）。
- M3/M4 待办、主动提醒、个人长期记忆追踪延后；MCP 只作为候选接入能力，不能把“页面有接入点”当成调度、数据库或消息主动推送已存在。后续优先考虑复用现有提醒事项管理流程，先证明权限与接口可用。
- 本段不改变原有 M0 真机实测证据：Hello World 与小智本地构建是两种不同阶段；小智未上板、语音/PSRAM/LED 仍未验证。

## 2026-11-02 最新交接：M1 源码已归档（覆盖此前“代码仍只在本地”的记录）

- **正式软件入口**：`software/musse-display/`；以其 `README.md`、`docs/INTEGRATION.md`、`reports/FINAL_REPORT.md` 为当前 M1 软件细节依据。
- **软件已完成**：16×16 RGB888 五种表情、动画、状态/情绪桥接、含关键事件保留的有限队列、NoopSink、C++ 单测共 93 项、离线预览 C++ 生成器；隔离上游 `v2.5.2/bread-compact-wifi` 编译级验证（Reasonix 报告）。补丁归档但**未刷写 ESP32**，本仓库不含整个小智上游副本。
- **当前风险**：运行时切换 Sink 同步、长期事件序列号回绕、持续事件洪泛负载、实际 FreeRTOS 任务栈/性能、LED 电平/供电/像素排列和语音闭环均尚未经过真机验证。
- **下一轮 Reasonix 工作包**：只在 Windows 本地批量开发 HT16K33A、WS2812B 的抽象输出适配、Mock 总线/数据流测试、亮度与电流保守估算、双矩阵 C++ 预览、上游隔离编译，并修复上述稳定性风险；默认仍保留 NoopSink，禁止烧录、接线或上传私密信息。完成后打包脱敏 ZIP 给 ChatGPT 审核和 GitHub 归档。
- **云端工作**：小智智能体记忆/MCP/知识库只做过控制台观察；日常待办、定时提醒、长期追踪延至后续阶段，不能声称已有持续提醒服务。

## 2026-11-03 当前交接覆盖项：B+C 软件优先

- 本轮已明确的**当前开发优先级**是 [PRODUCT_V1.md](PRODUCT_V1.md) 的网页待办 + 长期目标 + 快捷笔记 + iWiki 接入，不再将 LED M2 适配/未到货语音硬件作为软件 V1 开工前置条件。
- 页面应能在用户 Windows 电脑关闭后通过手机访问：优先国产托管，当前候选腾讯云开发 CloudBase；暂未开通、部署或选择具体数据库类型。iWiki 官方远程 MCP `https://ssemarket.cn/iwiki-api/mcp` 可作为知识库适配入口，实际权限与接口未实测，Token 不能传到前端或公开仓库。
- **用户明确本期不做主动提醒**：只展示截止/逾期，暂不实施推送、定时任务、消息队列和自动播报。
- **执行要求**：Reasonix 直接开发正式可运行的业务页面和持久化接口；无须独立 Mock 阶段，外部服务未开通时仅做最小可替换的本地测试；完成后仅处理真实功能、安全和数据问题，避免无限测试或重构。
- 用户新购标称 **5V/5A 可充电电源**，当前仅“已购买、未核验”，不代表到货或足够整机供电，也不自动改变桌面有线供电决定。见 [HARDWARE](HARDWARE.md)。
- **此前外部 Issue 技术建议暂缓**：本轮不评论、不关闭/修改 Issue，也不因评论立即增改硬件或固件代码。
- M1 的 93 项单元测试、NoopSink/表情引擎软件归档继续有效；小智语音、双矩阵、GPIO/按钮及电源真机未验证。当前文档更新不等于新软件已开发。
