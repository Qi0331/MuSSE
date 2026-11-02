#include "musse/display/emotion_renderer.h"

namespace musse::display {
namespace {

std::uint32_t phase(std::uint32_t timeMs, std::uint32_t periodMs) {
    return periodMs == 0 ? 0 : (timeMs % periodMs);
}

void eyes(FrameBuffer& frame, int lx, int ly, int lw, int lh,
          int rx, int ry, int rw, int rh, Rgb color) {
    frame.fillRect(lx, ly, lw, lh, color);
    frame.fillRect(rx, ry, rw, rh, color);
}

}  // namespace

FrameBuffer EmotionRenderer::render(Emotion emotion, std::uint32_t timeMs) const {
    FrameBuffer frame;

    switch (emotion) {
        case Emotion::Idle: {
            const Rgb c = color::Cyan;
            const bool blinking = phase(timeMs, 3000) < 160;
            if (blinking) {
                eyes(frame, 3, 7, 3, 1, 10, 7, 3, 1, c);
            } else {
                eyes(frame, 3, 5, 3, 3, 10, 5, 3, 3, c);
            }
            frame.fillRect(6, 11, 4, 1, c);  // neutral mouth
            break;
        }

        case Emotion::Listening: {
            const Rgb c = color::Green;
            eyes(frame, 3, 4, 3, 4, 10, 4, 3, 4, c);
            frame.fillRect(7, 10, 2, 2, c);  // small mouth
            const std::uint32_t p = phase(timeMs, 1200);
            const int level = p < 600 ? static_cast<int>(p * 5 / 600)
                                      : static_cast<int>((1200 - p) * 5 / 600);
            frame.fillRect(1, 8 - level, 1, 2 + level, c);
            frame.fillRect(14, 8 - level, 1, 2 + level, c);
            break;
        }

        case Emotion::Thinking: {
            const Rgb c = color::Amber;
            eyes(frame, 3, 6, 2, 2, 11, 4, 2, 2, c);  // looking up/aside
            frame.fillRect(8, 11, 1, 1, c);            // small mouth
            const int active = static_cast<int>(phase(timeMs, 1500) / 500);
            for (int i = 0; i < 3; ++i) {
                if (i == active) {
                    frame.fillRect(5 + i * 3, 1, 2, 2, c);
                } else {
                    frame.fillRect(5 + i * 3, 2, 1, 1, c);
                }
            }
            break;
        }

        case Emotion::Speaking: {
            const Rgb c = color::Orange;
            eyes(frame, 3, 5, 2, 3, 11, 5, 2, 3, c);
            const int mouthHeight = phase(timeMs, 250) < 125 ? 3 : 1;
            frame.fillRect(5, 10, 6, mouthHeight, c);
            break;
        }

        case Emotion::Error: {
            const Rgb c = color::Red;
            frame.drawLine(3, 5, 5, 7, c);
            frame.drawLine(3, 7, 5, 5, c);
            frame.drawLine(10, 5, 12, 7, c);
            frame.drawLine(10, 7, 12, 5, c);
            frame.setPixel(5, 12, c);
            frame.setPixel(6, 11, c);
            frame.setPixel(7, 11, c);
            frame.setPixel(8, 11, c);
            frame.setPixel(9, 12, c);
            const Rgb border = phase(timeMs, 600) < 300 ? color::Red : color::DimRed;
            frame.drawRect(0, 0, FrameBuffer::kWidth, FrameBuffer::kHeight, border);
            break;
        }
    }

    return frame;
}

}  // namespace musse::display
