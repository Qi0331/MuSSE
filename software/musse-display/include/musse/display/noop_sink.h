#pragma once

#include <atomic>

#include "musse/display/display_sink.h"

namespace musse::display {

/**
 * Sink used when no electrically verified LED hardware is available.
 *
 * It only counts frames; it never touches GPIO, I2C, RMT or any hardware.
 * The counter is atomic because the firmware render task and diagnostics may
 * read it from different tasks.
 */
class NoopSink final : public DisplaySink {
public:
    bool drawFrame(const FrameBuffer& frame) override {
        (void)frame;
        frames_.fetch_add(1, std::memory_order_relaxed);
        return true;
    }

    int frames() const { return frames_.load(std::memory_order_relaxed); }

private:
    std::atomic<int> frames_{0};
};

}  // namespace musse::display
