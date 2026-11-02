# MuSSE 最新交接（2026-11-02 晚间）

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