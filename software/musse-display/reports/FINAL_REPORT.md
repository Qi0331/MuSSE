# MuSSE M1 事件桥最终修复与交付报告

- 日期：2026-11-02
- 工程：`C:\Users\Lenovo\MuSSE-Lab\musse-display-m1`
- 上游：`78/xiaozhi-esp32` v2.5.2，commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`
- 宿主：MinGW g++ 15.2.0、CMake 4.0.3、Ninja 1.12.1
- 固件：ESP-IDF v6.1、xtensa-esp-elf GCC 15.2.0

## A. 本轮修复

### 1. 嵌入式事件队列锁

- 移除 `std::atomic_flag` 无界自旋。
- 队列改为锁策略模板 `BasicEventQueue<LockPolicy>`：
  - 宿主：`EventQueue = BasicEventQueue<std::mutex>`（多生产者安全）。
  - 固件：`FirmwareEventQueue = BasicEventQueue<FreeRtosCriticalLock>`。
- 固件锁使用 `portENTER_CRITICAL`/`portEXIT_CRITICAL` 短临界区；反汇编确认调用 `xPortEnterCriticalTimeout`。
- 临界区内只做数组复制/索引更新，不渲染、不日志、不做 I/O。
- 生产者均为任务上下文；未注册 ISR 生产者，文档明确 ISR 不支持。

### 2. 关键事件不被情绪洪泛淹没

- 普通事件（Emotion、AlertProgress）：16 槽 FIFO，满时丢最旧并计数。
- 关键事件独立槽位（每类只留最新，merge 计数）：
  - 最新 DeviceState
  - Thinking 开/关
  - Alert 错误（warning/cancel/cloud_off/error）
  - AlertDismiss
- `pop()` 按全局序列号排序；相同序列号优先关键事件。
- 复现场景（Error → Dismiss → 16 情绪）现在正确恢复；另有 64 条洪泛、Thinking 洪泛、禁用渲染下恢复等测试。
- 代价：同类关键事件的中间状态可能合并，最新状态优先；已记录。

### 3. 生命周期与栈

- `kTaskStackWords` 改为 `kTaskStackBytes = 4096`，注释说明 ESP-IDF `xTaskCreate` 栈参数单位为字节。
- `StartGate` 失败可重试；失败不会标记 Running；并发 Start 只有一个赢家。
- 队列为成员对象，无动态分配/创建失败/泄漏。
- `SetEnabled(false)` 暂停渲染但继续排空事件；`SetSink()` 支持切换 Noop/硬件 sink（启动前或禁用时）。

### 4. 其他清理

- 删除冗余 `MusseLed`，统一为 `MusseDisplayService`。
- `AlertEmotion` 与 `AlertProgress` 分流，避免进度提示被当作错误。
- 保留 F-01、F-02、F-05、F-06 已通过的核心修复。

## B. 测试结果

| 项目 | 结果 |
|---|---|
| 宿主构建 | 退出码 **0**，无警告 |
| 单元测试 | **93 个用例，0 失败，0 断言失败** |
| CTest | **2/2 通过** |
| 新增关键测试 | 9 项（关键事件保留、Dismiss 复现、Thinking 洪泛、状态合并、多生产者、禁用渲染恢复、sink 切换等） |
| 多生产者 | 4 个 `std::thread` × 500 情绪 + 关键状态，无崩溃/无关键事件丢失 |
| 稳定性 | 12,000 帧 × 50 ms（20 fps）**加速模拟**，0 失败、0 丢弃 |
| Sanitizer | 本机 MinGW 缺少 `libubsan`，**本地未执行**；上一轮外部复审在 GNU 14.2.0 的 ASan/UBSan 结果不冒充本地证据 |

性能（Windows 宿主，200,000 帧/表情，带 checksum）：0.032–0.089 µs/帧；`sizeof(FrameBuffer)` = 768 字节。

## C. 固件构建

- 命令：`python scripts/build.py bread-compact-wifi --name bread-compact-wifi`
- 退出码：**0**
- `xiaozhi.bin`：**2,583,040 字节**（基线 2,577,504，**+5,536**）
- SHA-256：`72e985cc521b7e981b2ae70fc6a88199fec5a46b877e058318d1dafb7d662336`
- ELF：52 行 MuSSE 符号；`BasicEventQueue<FreeRtosCriticalLock>::push` 存在
- 反汇编确认状态/情绪/Alert/Dismiss/Start/Run 调用点与 `xPortEnterCriticalTimeout`
- 无 C++ 警告/错误

## D. 离线预览

- `C:\Users\Lenovo\MuSSE-Lab\musse-display-m1\preview\preview.html`
- 2,065,563 字节
- SHA-256：`e8b7adc4f9f0447f0887ddf1ffd2b7e9628b7413e4c2f25b8c965d023181910d`
- 五种表情、上游状态/情绪模拟、RGB/单色、播放控制均已浏览器验证

## E. 审核 ZIP

- 路径：`C:\Users\Lenovo\MuSSE-Lab\musse-display-m1-review.zip`
- 大小与 SHA-256：见同目录 `musse-display-m1-review.zip.sha256`
- 内容：源码、测试、CMake、README、预览、工具、补丁、文档、报告、证据、文件清单
- 排除：上游 worktree、build、固件镜像、Flash 备份、账号凭证

## F. 仍未验证 / 风险

1. 未烧录、未真机运行；只证明编译/链接/调用关系。
2. NoopSink 无 GPIO/I²C/RMT 输出；HT16K33 参数未核验。
3. 50 ms 渲染任务对语音任务的实际时序影响未实测。
4. 稳定性为加速模拟，不是真实 10 分钟 wall-clock。
5. 本地无 sanitizer 运行时。
6. 同类关键事件合并会跳过中间状态（设计取舍）。
7. 仅任务上下文生产者；ISR 场景未支持。
8. ESP32-S3 渲染/I²C 性能未测。

## G. 权限确认

- 原始上游研究副本 `git status` 干净，未修改。
- 未烧录、擦除、修改 eFuse。
- 未接线、未给 LED 上电。
- 未调用云端、未 GitHub push/PR。
- 未升级上游或工具链；`hello_world` 未修改。

## H. 下一步

1. 用经电气核验的 HT16K33 sink 替换 NoopSink，并实现实测像素映射。
2. 在宿主做真实 10 分钟 wall-clock 稳定性测试（非加速）。
3. 核验 LED 矩阵供电/上拉/地址/电流后，单独授权首次真机点亮。
4. 语音配件到货后，单独授权配网、绑定与语音闭环。
