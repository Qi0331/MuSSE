#pragma once

#include <cstdint>

#include "musse/display/emotion.h"
#include "musse/display/emotion_renderer.h"
#include "musse/display/frame_buffer.h"

namespace musse::display {

/**
 * Drives the renderer with caller-supplied time.
 *
 * The controller resets the animation origin whenever the expression changes,
 * so a transition always starts from frame zero. It never blocks.
 */
class AnimationController {
public:
    void setEmotion(Emotion emotion, std::uint32_t nowMs);
    Emotion emotion() const { return emotion_; }

    FrameBuffer frame(std::uint32_t nowMs) const;
    std::uint32_t elapsed(std::uint32_t nowMs) const;

private:
    EmotionRenderer renderer_;
    Emotion emotion_ = Emotion::Idle;
    std::uint32_t startMs_ = 0;
};

}  // namespace musse::display
