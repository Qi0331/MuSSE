#include "musse/display/animation_controller.h"

namespace musse::display {

void AnimationController::setEmotion(Emotion emotion, std::uint32_t nowMs) {
    if (emotion != emotion_) {
        emotion_ = emotion;
        startMs_ = nowMs;
    }
}

FrameBuffer AnimationController::frame(std::uint32_t nowMs) const {
    return renderer_.render(emotion_, elapsed(nowMs));
}

std::uint32_t AnimationController::elapsed(std::uint32_t nowMs) const {
    return nowMs - startMs_;  // unsigned arithmetic also handles wraparound
}

}  // namespace musse::display
