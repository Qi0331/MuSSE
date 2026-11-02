#include <chrono>
#include <cstdint>
#include <cstdio>

#include "musse/display/emotion_renderer.h"
#include "musse/display/frame_buffer.h"

using namespace musse::display;

int main() {
    constexpr int kIterations = 200000;
    EmotionRenderer renderer;
    FrameBuffer sink;

    std::printf("FrameBuffer sizeof: %zu bytes\n", sizeof(FrameBuffer));
    std::printf("iterations per expression: %d\n", kIterations);

    std::uint64_t checksum = 0;
    for (int e = 0; e < kEmotionCount; ++e) {
        const auto emotion = static_cast<Emotion>(e);
        const auto start = std::chrono::steady_clock::now();
        for (int i = 0; i < kIterations; ++i) {
            sink = renderer.render(emotion, static_cast<std::uint32_t>(i * 16));
            // Consume a value from the frame so the compiler cannot eliminate
            // the render call as dead code.
            checksum += sink.data()[(i * 7) % FrameBuffer::kPixelCount].g;
        }
        const auto end = std::chrono::steady_clock::now();
        const double totalUs =
            std::chrono::duration<double, std::micro>(end - start).count();
        std::printf("%-10s %8.3f us/frame  (%d frames in %.3f s)\n",
                    emotionName(emotion), totalUs / kIterations, kIterations,
                    totalUs / 1000000.0);
    }
    std::printf("checksum: %llu\n", static_cast<unsigned long long>(checksum));
    return 0;
}
