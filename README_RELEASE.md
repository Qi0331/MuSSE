# MuSSE M1 离线显示核心归档

来自 Reasonix 第三版审查包。当前归档包含 `software/musse-display` 的 C++ 源码、93 项测试、预览生成工具、脱敏构建证据、补丁参考与设计文档。

基线：xiaozhi-esp32 v2.5.2 (`49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`)、ESP-IDF v6.1。

本仓库不含约 2 MB 的生成 HTML、整个上游 worktree、固件二进制、设备 Flash 备份、Token 或私人资料。

当前仅完成离线与编译级验证，**没有烧录、接线、真机语音闭环或 LED 点亮**。

已知后续风险：运行中切换 sink 的同步、持续事件洪泛对渲染周期的影响、事件序列号回绕、ESP32 真实栈/性能与物理电气参数。
