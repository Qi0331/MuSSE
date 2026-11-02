#pragma once

#include <cstdint>

#include "musse/display/emotion.h"
#include "musse/display/frame_buffer.h"

namespace musse::display {

/**
 * Stateless expression renderer.
 *
 * The renderer only depends on the expression and an externally supplied
 * millisecond clock. It performs no sleeping, allocation or I/O, so identical
 * inputs always produce identical frames (deterministic for tests/preview).
 *
 * Animation periods (ms):
 *   Idle      3000 (blink 160 ms at the start of each period)
 *   Listening 1200 (sound-level bars)
 *   Thinking  1500 (three dots, 500 ms per dot)
 *   Speaking   250 (mouth open/close)
 *   Error      600 (border flash)
 */
class EmotionRenderer {
public:
    FrameBuffer render(Emotion emotion, std::uint32_t timeMs) const;
};

}  // namespace musse::display
