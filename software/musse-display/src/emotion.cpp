#include "musse/display/emotion.h"

#include <cstring>

namespace musse::display {

const char* emotionName(Emotion emotion) {
    switch (emotion) {
        case Emotion::Idle: return "Idle";
        case Emotion::Listening: return "Listening";
        case Emotion::Thinking: return "Thinking";
        case Emotion::Speaking: return "Speaking";
        case Emotion::Error: return "Error";
    }
    return "Idle";
}

bool parseEmotion(const char* name, Emotion& out) {
    if (name == nullptr) {
        return false;
    }
    if (std::strcmp(name, "Idle") == 0) { out = Emotion::Idle; return true; }
    if (std::strcmp(name, "Listening") == 0) { out = Emotion::Listening; return true; }
    if (std::strcmp(name, "Thinking") == 0) { out = Emotion::Thinking; return true; }
    if (std::strcmp(name, "Speaking") == 0) { out = Emotion::Speaking; return true; }
    if (std::strcmp(name, "Error") == 0) { out = Emotion::Error; return true; }
    return false;
}

}  // namespace musse::display
