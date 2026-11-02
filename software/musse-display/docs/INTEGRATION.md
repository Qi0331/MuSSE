# 上游集成验证（事件桥最终版）

## 1. 隔离副本

- 路径：`C:\Users\Lenovo\MuSSE-Lab\musse-display-m1\integration\xiaozhi-worktree`
- 固定 commit：`49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`
- `git worktree --detach`；原研究副本保持干净。

## 2. 修改位置

| 文件 | 修改 |
|---|---|
| `main/CMakeLists.txt` | 加入核心与 service 源文件、include 路径 |
| `main/application.cc` | `llm.emotion` → `OnEmotion`；`Alert` → `OnAlertEmotion`；状态变化 → `OnDeviceState`；`DismissAlert` → `OnAlertDismissed` |
| `main/boards/bread-compact-wifi/compact_wifi_board.cc` | 构造函数 `Start()` |
| `main/musse_display/*` | 核心、`FirmwareEventQueue`、`StartGate`、service |
| `main/musse_display/freertos_event_lock.h` | `portMUX` 短临界区锁 |

未修改 `Display`、`Led`、`SingleLed`、`OledDisplay`、`device_state*`、`GetLed()`、`GetDisplay()`。

## 3. 事件调度

```
状态/情绪/Alert/Dismiss/Thinking 回调
  -> FirmwareEventQueue.push（仅任务上下文）
       Emotion/AlertProgress -> 16 槽 FIFO（满丢最旧）
       DeviceState/Thinking/Alert错误/AlertDismiss -> 4 个独立槽位（只留最新，永不丢）
  -> 50 ms 任务：按序列号顺序 pop + applyEvent
  -> DisplayPipeline::render -> NoopSink
```

- 锁：`portENTER_CRITICAL`/`portEXIT_CRITICAL`（反汇编可见 `xPortEnterCriticalTimeout`），不是 `atomic_flag` 自旋。
- 临界区内仅数组复制/索引更新；不渲染、不日志、不做 I/O。
- 仅任务上下文；未注册 ISR 生产者。
- 关键事件洪泛测试与复现场景测试均通过。

## 4. 生命周期

- `StartGate`：NotStarted → Starting → Running；失败 → Failed → 可重试。
- 并发 `Start()`：CAS 单赢家；失败不误报 Running。
- `xTaskCreate` 栈参数在 ESP-IDF 中为**字节**：4096 bytes，优先级 3。
- 队列为成员对象，无动态分配/泄漏。
- `SetEnabled(false)` 暂停渲染但继续排空事件；`SetSink()` 可在启动前或禁用时切换。
- 不提供任务删除（常驻）。

## 5. 构建结果

```powershell
cd integration\xiaozhi-worktree
python scripts/build.py bread-compact-wifi --name bread-compact-wifi
```

- 退出码：**0**
- `xiaozhi.bin`：**2,583,040 字节**（0x276A00）
- 基线：2,577,504 字节；增量 **+5,536**
- SHA-256：`72e985cc521b7e981b2ae70fc6a88199fec5a46b877e058318d1dafb7d662336`
- 无 C++ `warning:` / `error:`

## 6. 证据

- `evidence/elf_symbols.txt`：52 行 MuSSE 符号，含 `BasicEventQueue<FreeRtosCriticalLock>::push`。
- `evidence/call_graph.txt`：状态/情绪/Alert/Dismiss/Start/Run 调用点及临界区调用。
- `evidence/link_map_musse.txt`、`build_summary.md`。

## 7. 未验证

- 未烧录、未真机运行。
- NoopSink 无硬件输出。
- 50 ms 任务对语音任务的影响未实测。
- 真实 LED 电气参数未核验。
