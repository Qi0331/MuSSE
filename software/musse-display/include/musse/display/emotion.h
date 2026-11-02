#pragma once

#include <cstdint>

namespace musse::display {

/** Logical expressions rendered by MuSSE on the 16x16 matrix. */
enum class Emotion : std::uint8_t {
    Idle = 0,
    Listening,
    Thinking,
    Speaking,
    Error,
};

constexpr int kEmotionCount = 5;

const char* emotionName(Emotion emotion);
/** Parses a MuSSE expression name; returns false when unknown. */
bool parseEmotion(const char* name, Emotion& out);

}  // namespace musse::display
