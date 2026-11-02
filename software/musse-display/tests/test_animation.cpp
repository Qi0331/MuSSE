#include "musse/display/animation_controller.h"

#include "test_framework.h"

using namespace musse::display;

MUSSE_TEST(animation_resets_on_emotion_change) {
    AnimationController controller;
    controller.setEmotion(Emotion::Speaking, 1000);
    EmotionRenderer renderer;
    CHECK(controller.frame(1000) == renderer.render(Emotion::Speaking, 0));
    CHECK(controller.elapsed(1000) == 0);
}

MUSSE_TEST(animation_uses_external_time) {
    AnimationController controller;
    controller.setEmotion(Emotion::Listening, 100);
    EmotionRenderer renderer;
    CHECK(controller.frame(350) == renderer.render(Emotion::Listening, 250));
    CHECK(controller.elapsed(350) == 250);
}

MUSSE_TEST(animation_switch_resets_origin) {
    AnimationController controller;
    controller.setEmotion(Emotion::Idle, 0);
    controller.setEmotion(Emotion::Listening, 2500);
    EmotionRenderer renderer;
    CHECK(controller.frame(2500) == renderer.render(Emotion::Listening, 0));
    CHECK(controller.frame(3000) == renderer.render(Emotion::Listening, 500));
}

MUSSE_TEST(animation_does_not_reset_same_emotion) {
    AnimationController controller;
    controller.setEmotion(Emotion::Idle, 0);
    controller.setEmotion(Emotion::Idle, 500);
    EmotionRenderer renderer;
    CHECK(controller.frame(1000) == renderer.render(Emotion::Idle, 1000));
}

MUSSE_TEST(animation_periodic_frames_repeat) {
    AnimationController controller;
    controller.setEmotion(Emotion::Speaking, 0);
    CHECK(controller.frame(0) == controller.frame(250));
    CHECK(controller.frame(75) == controller.frame(325));

    controller.setEmotion(Emotion::Idle, 0);
    CHECK(controller.frame(0) == controller.frame(3000));
    CHECK(controller.frame(1234) == controller.frame(4234));
}

MUSSE_TEST(animation_handles_clock_wraparound) {
    AnimationController controller;
    const std::uint32_t start = 0xFFFFFFF0u;  // near UINT32_MAX
    controller.setEmotion(Emotion::Idle, start);
    const std::uint32_t elapsed = 20u - start;  // 36
    CHECK(elapsed == 36u);
    EmotionRenderer renderer;
    CHECK(controller.frame(20u) == renderer.render(Emotion::Idle, 36));
}

MUSSE_TEST(animation_many_switches_are_stable) {
    AnimationController controller;
    EmotionRenderer renderer;
    for (int i = 0; i < 1000; ++i) {
        const auto emotion = static_cast<Emotion>(i % kEmotionCount);
        const std::uint32_t now = static_cast<std::uint32_t>(i * 13);
        controller.setEmotion(emotion, now);
        CHECK(controller.frame(now) == renderer.render(emotion, 0));
    }
}
