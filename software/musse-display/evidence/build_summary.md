# Integration build evidence (event-bridge final)

- Date: 2026-11-02
- Upstream: 78/xiaozhi-esp32 v2.5.2 commit 49b4380b3faa0ceadd28a3e78aaf0f311c46c57e
- Board: bread-compact-wifi
- ESP-IDF: v6.1 (xtensa-esp-elf GCC 15.2.0)
- Worktree: integration/xiaozhi-worktree (isolated git worktree)
- Command: python scripts/build.py bread-compact-wifi --name bread-compact-wifi
- Exit code: 0
- Result: Project build complete

## Image

- xiaozhi.bin size: 2,583,040 bytes (0x276A00)
- Baseline (no MuSSE): 2,577,504 bytes
- Delta: +5,536 bytes
- SHA-256 xiaozhi.bin: 72e985cc521b7e981b2ae70fc6a88199fec5a46b877e058318d1dafb7d662336
- ELF: build/xiaozhi.elf
- Link map: build/xiaozhi.map
- App partition: 4,032 KB, 37% free

## Sync and scheduling

- Firmware queue: BasicEventQueue<FreeRtosCriticalLock>
- Lock: portENTER_CRITICAL / portEXIT_CRITICAL (disassembly shows
  xPortEnterCriticalTimeout), not an atomic_flag spin loop.
- Task stack: xTaskCreate stack depth is in BYTES on ESP-IDF; 4096 bytes.
- Critical events (DeviceState, Thinking, Alert error, AlertDismiss) have
  dedicated slots and cannot be dropped by emotion floods.
- Sink is NoopSink; no GPIO / I2C / RMT access.
- Original OLED and single-LED paths are unchanged.

## Evidence files

- elf_symbols.txt: defined MuSSE symbols (52 lines)
- call_graph.txt: real call sites + queue critical-section call
- link_map_musse.txt: link map entries for MuSSE objects/symbols

## Not verified

- No firmware was flashed; this does not prove on-device execution.
