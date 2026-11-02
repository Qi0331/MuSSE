#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "musse/display/animation_controller.h"
#include "musse/display/emotion_renderer.h"
#include "musse/display/frame_buffer.h"
#include "musse/display/state_adapter.h"

namespace {

using namespace musse::display;

std::string colorHex(Rgb c) {
    char buffer[8];
    std::snprintf(buffer, sizeof(buffer), "#%02x%02x%02x", c.r, c.g, c.b);
    return buffer;
}

std::string frameJson(const FrameBuffer& frame) {
    std::ostringstream out;
    out << '[';
    for (int i = 0; i < static_cast<int>(FrameBuffer::kPixelCount); ++i) {
        if (i != 0) {
            out << ',';
        }
        out << '"' << colorHex(frame.data()[i]) << '"';
    }
    out << ']';
    return out.str();
}

std::string framesJson(const std::vector<FrameBuffer>& frames) {
    std::ostringstream out;
    out << '[';
    for (std::size_t i = 0; i < frames.size(); ++i) {
        if (i != 0) {
            out << ',';
        }
        out << "\n      " << frameJson(frames[i]);
    }
    out << "\n    ]";
    return out.str();
}

std::vector<FrameBuffer> renderTimeline(StateAdapter& adapter, int frameCount) {
    AnimationController animation;
    std::vector<FrameBuffer> frames;
    frames.reserve(static_cast<std::size_t>(frameCount));
    for (int i = 0; i < frameCount; ++i) {
        const auto now = static_cast<std::uint32_t>(i * 100);
        const Emotion emotion = adapter.resolve(now);
        animation.setEmotion(emotion, now);
        frames.push_back(animation.frame(now));
    }
    return frames;
}

std::vector<FrameBuffer> framesForState(DeviceState state) {
    StateAdapter adapter;
    adapter.onDeviceState(state);
    return renderTimeline(adapter, 40);
}

std::vector<FrameBuffer> framesForEmotion(const char* name) {
    StateAdapter adapter;
    adapter.onEmotionName(name, 0);
    return renderTimeline(adapter, 40);
}

struct Segment {
    Emotion emotion;
    int frames;
};

struct SequenceData {
    std::string framesJson;
    std::string labelsJson;
};

SequenceData buildSequence(const EmotionRenderer& renderer) {
    const Segment segments[] = {
        {Emotion::Idle, 20},
        {Emotion::Listening, 20},
        {Emotion::Thinking, 20},
        {Emotion::Speaking, 20},
        {Emotion::Idle, 20},
    };

    std::ostringstream frames;
    std::ostringstream labels;
    frames << '[';
    labels << '[';
    bool first = true;
    for (const auto& segment : segments) {
        for (int i = 0; i < segment.frames; ++i) {
            const FrameBuffer frame =
                renderer.render(segment.emotion, static_cast<std::uint32_t>(i * 100));
            if (!first) {
                frames << ',';
                labels << ',';
            }
            first = false;
            frames << frameJson(frame);
            labels << '"' << emotionName(segment.emotion) << '"';
        }
    }
    frames << ']';
    labels << ']';
    return {frames.str(), labels.str()};
}

bool writeFile(const std::string& path, const std::string& content) {
    std::ofstream out(path, std::ios::binary);
    if (!out) {
        return false;
    }
    out << content;
    return static_cast<bool>(out);
}

std::string readFile(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    std::ostringstream buffer;
    buffer << in.rdbuf();
    return buffer.str();
}

}  // namespace

int main(int argc, char** argv) {
    const std::string templatePath =
        argc > 1 ? argv[1] : "tools/preview_template.html";
    const std::string outputPath = argc > 2 ? argv[2] : "preview/preview.html";

    const EmotionRenderer renderer;

    std::ostringstream json;
    json << "{\n  \"meta\": {\"width\": 16, \"height\": 16, \"frameMs\": 100, "
            "\"generatedBy\": \"MuSSE C++ EmotionRenderer + StateAdapter\", "
            "\"upstream\": \"78/xiaozhi-esp32 v2.5.2 49b4380b3faa0ceadd28a3e78aaf0f311c46c57e\"},\n  \"emotions\": {\n";

    for (int e = 0; e < kEmotionCount; ++e) {
        const auto emotion = static_cast<Emotion>(e);
        if (e != 0) {
            json << ",\n";
        }
        json << "    \"" << emotionName(emotion) << "\": [\n";
        for (int i = 0; i < 60; ++i) {
            if (i != 0) {
                json << ",\n";
            }
            json << "      " << frameJson(renderer.render(emotion, static_cast<std::uint32_t>(i * 100)));
        }
        json << "\n    ]";
    }
    json << "\n  },\n";

    const SequenceData sequence = buildSequence(renderer);
    json << "  \"sequenceFrames\": " << sequence.framesJson << ",\n";
    json << "  \"sequenceLabels\": " << sequence.labelsJson << ",\n";

    struct StateEntry { const char* name; DeviceState state; };
    const StateEntry states[] = {
        {"Idle", DeviceState::Idle},
        {"Listening", DeviceState::Listening},
        {"Speaking", DeviceState::Speaking},
        {"FatalError", DeviceState::FatalError},
        {"Connecting", DeviceState::Connecting},
    };
    json << "  \"upstreamStates\": {\n";
    for (std::size_t i = 0; i < sizeof(states) / sizeof(states[0]); ++i) {
        if (i != 0) {
            json << ",\n";
        }
        json << "    \"" << states[i].name << "\": " << framesJson(framesForState(states[i].state));
    }
    json << "\n  },\n";

    struct EmotionEntry { const char* name; };
    const EmotionEntry emotions[] = {
        {"neutral"}, {"happy"}, {"thinking"}, {"sad"}, {"unknown-name"},
    };
    json << "  \"upstreamEmotions\": {\n";
    for (std::size_t i = 0; i < sizeof(emotions) / sizeof(emotions[0]); ++i) {
        if (i != 0) {
            json << ",\n";
        }
        json << "    \"" << emotions[i].name << "\": " << framesJson(framesForEmotion(emotions[i].name));
    }
    json << "\n  }\n}\n";

    const std::string placeholder = "__MUSSE_PREVIEW_JSON__";
    std::string html = readFile(templatePath);
    if (html.empty()) {
        std::fprintf(stderr, "cannot read template: %s\n", templatePath.c_str());
        return 2;
    }
    const std::size_t pos = html.find(placeholder);
    if (pos == std::string::npos) {
        std::fprintf(stderr, "placeholder not found in template\n");
        return 3;
    }
    html.replace(pos, placeholder.size(), json.str());

    if (!writeFile(outputPath, html)) {
        std::fprintf(stderr, "cannot write %s\n", outputPath.c_str());
        return 4;
    }

    std::printf("preview written: %s (%zu bytes)\n", outputPath.c_str(), html.size());
    return 0;
}
