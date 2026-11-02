#include "musse/display/emotion_renderer.h"

#include "test_framework.h"

using namespace musse::display;

namespace {

int litPixels(const FrameBuffer& frame) {
    int count = 0;
    for (int y = 0; y < FrameBuffer::kHeight; ++y) {
        for (int x = 0; x < FrameBuffer::kWidth; ++x) {
            if (frame.pixel(x, y) != color::Black) {
                ++count;
            }
        }
    }
    return count;
}

}  // namespace

MUSSE_TEST(renderer_all_expressions_non_empty) {
    EmotionRenderer renderer;
    for (int i = 0; i < kEmotionCount; ++i) {
        const auto emotion = static_cast<Emotion>(i);
        const FrameBuffer frame = renderer.render(emotion, 500);
        CHECK(litPixels(frame) > 10);
    }
}

MUSSE_TEST(renderer_expressions_are_visually_distinct) {
    EmotionRenderer renderer;
    FrameBuffer frames[kEmotionCount];
    for (int i = 0; i < kEmotionCount; ++i) {
        frames[i] = renderer.render(static_cast<Emotion>(i), 500);
    }
    for (int i = 0; i < kEmotionCount; ++i) {
        for (int j = i + 1; j < kEmotionCount; ++j) {
            CHECK(frames[i] != frames[j]);
        }
    }
}

MUSSE_TEST(renderer_idle_blinks) {
    EmotionRenderer renderer;
    const FrameBuffer open = renderer.render(Emotion::Idle, 500);
    const FrameBuffer blink = renderer.render(Emotion::Idle, 0);
    CHECK(open != blink);
    CHECK(open.pixel(3, 5) == color::Cyan);
    CHECK(blink.pixel(3, 5) == color::Black);
    CHECK(blink.pixel(3, 7) == color::Cyan);
}

MUSSE_TEST(renderer_listening_bars_move) {
    EmotionRenderer renderer;
    const FrameBuffer low = renderer.render(Emotion::Listening, 0);
    const FrameBuffer high = renderer.render(Emotion::Listening, 600);
    CHECK(low != high);
    CHECK(low.pixel(1, 8) == color::Green);
    CHECK(high.pixel(1, 3) == color::Green);
    CHECK(low.pixel(1, 3) == color::Black);
}

MUSSE_TEST(renderer_thinking_dots_cycle) {
    EmotionRenderer renderer;
    const FrameBuffer first = renderer.render(Emotion::Thinking, 0);
    const FrameBuffer second = renderer.render(Emotion::Thinking, 600);
    CHECK(first != second);
    CHECK(first.pixel(5, 1) == color::Amber);
    CHECK(second.pixel(8, 1) == color::Amber);
    CHECK(second.pixel(5, 1) == color::Black);
}

MUSSE_TEST(renderer_speaking_mouth_moves) {
    EmotionRenderer renderer;
    const FrameBuffer open = renderer.render(Emotion::Speaking, 0);
    const FrameBuffer closed = renderer.render(Emotion::Speaking, 150);
    CHECK(open != closed);
    CHECK(open.pixel(5, 12) == color::Orange);
    CHECK(closed.pixel(5, 12) == color::Black);
}

MUSSE_TEST(renderer_error_border_flashes) {
    EmotionRenderer renderer;
    const FrameBuffer bright = renderer.render(Emotion::Error, 0);
    const FrameBuffer dim = renderer.render(Emotion::Error, 400);
    CHECK(bright != dim);
    CHECK(bright.pixel(0, 0) == color::Red);
    CHECK(dim.pixel(0, 0) == color::DimRed);
    CHECK(bright.pixel(3, 5) == color::Red);  // X eye
}

MUSSE_TEST(renderer_is_deterministic) {
    EmotionRenderer renderer;
    for (int i = 0; i < kEmotionCount; ++i) {
        const auto emotion = static_cast<Emotion>(i);
        for (std::uint32_t t = 0; t < 4000; t += 137) {
            CHECK(renderer.render(emotion, t) == renderer.render(emotion, t));
        }
    }
}

MUSSE_TEST(emotion_names_round_trip) {
    for (int i = 0; i < kEmotionCount; ++i) {
        const auto emotion = static_cast<Emotion>(i);
        Emotion parsed = Emotion::Error;
        CHECK(parseEmotion(emotionName(emotion), parsed));
        CHECK(parsed == emotion);
    }
    Emotion parsed = Emotion::Error;
    CHECK(!parseEmotion("nonsense", parsed));
    CHECK(!parseEmotion(nullptr, parsed));
}
