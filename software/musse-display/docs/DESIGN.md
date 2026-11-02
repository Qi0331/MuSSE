# MuSSE 16×16 显示模块设计（F-01..F-06 修复后）

## 1. 分层

```
上游状态 / 情绪 / Alert
        │
        ▼
EventQueue（固定容量、FIFO、满则丢最旧、计数）
        │  applyEvent（宿主测试与固件共用）
        ▼
StateAdapter（状态 + AI 情绪 + Alert 错误/进度 + Thinking + 优先级 + TTL）
        │ Emotion
        ▼
AnimationController（表情切换重置动画，外部时间）
        │
        ▼
EmotionRenderer（纯函数，Emotion + time_ms -> FrameBuffer）
        │
        ▼
DisplaySink（RGB / 单色 / Mock / Noop；begin 失败可停止并可显式重试）
```

## 2. F-01 渲染初始化

- `DisplayPipeline::render()` 在 NotStarted 状态调用 `sink_.begin()`。
- `begin()` 失败：进入 `Failed`，`initFailures_++`，**不调用 `drawFrame()`**，返回 false。
- `Failed` 状态不会自动重试；调用方用 `retrySinkBegin()` 显式回到 NotStarted。
- `begin()` 成功才进入 Running，之后正常渲染。

## 3. F-02 未知情绪

- `onEmotionName(nullptr / "" / 未知名称)` 返回 false，且**完全不改变**当前状态、临时情绪或 TTL。
- 已有效的 Listening/Speaking 不会被覆盖。
- 已知名称才会建立临时表情（默认 TTL 3000 ms）。

## 4. F-03 事件顺序（最终版）

- 统一有界事件队列，按事件类型分流：
  - 普通事件（AI Emotion、AlertProgress）进入 16 槽 FIFO；满时丢最旧并计数。
  - 关键事件（DeviceState、Thinking、Alert 错误、AlertDismiss）进入 4 个独立槽位，每个槽位只保留最新一条（merge 计数），**永不因普通事件洪泛而丢失**。
- `pop()` 比较普通队列头部与各关键槽位的序列号，取最小者；相同序列号优先关键事件。
- 事件携带 `timeMs`，TTL 按事件时间计算，不受消费延迟影响。
- 同步：宿主 `std::mutex`；固件 `portMUX` 短临界区（任务上下文，无 ISR 生产者）。临界区内只做数组复制/索引更新，不渲染、不日志、不做 I/O。
- 队列固定容量、无动态分配；`dropped()`（普通事件）与 `merged()`（关键事件合并）可观测。
- 宿主测试与固件共用同一 `BasicEventQueue` 模板和 `applyEvent()`。

## 5. F-04 生命周期

- `StartGate` 状态：NotStarted → Starting → Running；失败 → Failed → 可重试 Starting。
- 并发 `Start()`：CAS 只有一个赢家；其他调用返回当前是否 Running。
- 任务创建失败：标记 Failed，记录日志；后续 `Start()` 可重试。
- 事件队列是成员对象，无队列创建/泄漏问题。
- `xTaskCreate()` 的栈参数在 ESP-IDF 中以**字节**计量：`kTaskStackBytes = 4096`，任务优先级 3。
- `SetEnabled(false)` 暂停渲染但继续排空事件，保证队列有界且关键状态可恢复；`SetEnabled(true)` 恢复。
- `SetSink()` 允许在启动前或禁用渲染时替换 Noop/真实 sink，会结束旧 sink 并重新 begin 新 sink。
- 不提供任务删除（固件生命周期内常驻）；文档明确该限制。

## 6. F-05 错误与普通情绪

- AI 情绪（llm/emotion）：`sad`、`angry`、`crying`、`shocked`、`embarrassed` → **Idle**，不再当作设备故障。
- `thinking`、`confused`、`surprised` → Thinking。
- 正向表达 → Speaking；neutral/sleepy/relaxed → Idle。
- Alert 情绪：
  - `warning`、`cancel`、`cloud_off`、`error` → 粘性 Error。
  - `download`、`cloud_download`、`link` → 进度提示，不影响表情/不报错。
  - 其他 → 按 AI 情绪映射。
- `DismissAlert()` → 清除粘性错误与临时情绪，恢复设备状态表情。
- `setTimedError(now, ms)` 提供错误超时自动恢复；`setError(true)` 为粘性错误。
- 优先级：错误 > 显式 Thinking > AI 情绪（TTL）> 设备状态。

## 7. F-06 边界安全

- `fillRect`：使用 int64 计算 `x+width`，裁剪到 16×16；极端值不溢出。
- `drawRect`：用裁剪后的水平/垂直线绘制四条边；超大矩形只画可见边。
- `drawLine`：Liang–Barsky 裁剪（double，32 位坐标差可精确表示），带浮点容差；极端坐标不会产生无界循环。
- `fillCircle`：半径平方用 int64；裁剪循环范围；用 `dy2 > r2 - dx2` 避免 `dx2+dy2` 溢出。
- 所有绘图均通过 `setPixel` 做最终边界检查。

## 8. 硬件边界（未变）

- 无 GPIO、I²C、RMT、WS2812 代码。
- 未填写 HT16K33 地址、像素顺序、上拉电压、亮度/电流参数。
- `NoopSink` 只做原子帧计数。
- 真实输出需先完成电气核验。

## 9. 测试性

- 所有时间外部传入，固定输入产生固定帧。
- 事件队列、StartGate、渲染管线均可在 Windows 宿主测试。
- 预览 HTML 的帧数据由同一 C++ 渲染器/适配器生成。
