# 离线预览

HTML 预览是由 C++ `musse_preview_gen` 基于 `tools/preview_template.html` 构建得到的自动生成文件。
约 2 MB 的 `preview.html` 不进入 Git 仓库；运行 `cmake --build build` 后再执行 `ctest --test-dir build --output-on-failure` 可生成。
此处只有模拟预览，不代表 LED 真机点亮或语音运行验证。
