#include "musse/display/frame_buffer.h"

#include <climits>

#include "test_framework.h"

using namespace musse::display;

MUSSE_TEST(frame_buffer_initial_state) {
    FrameBuffer frame;
    CHECK(frame.data() != nullptr);
    for (int y = 0; y < FrameBuffer::kHeight; ++y) {
        for (int x = 0; x < FrameBuffer::kWidth; ++x) {
            CHECK(frame.pixel(x, y) == color::Black);
        }
    }
}

MUSSE_TEST(frame_buffer_pixel_rgb_channels) {
    FrameBuffer frame;
    CHECK(frame.setPixel(0, 0, Rgb{1, 2, 3}));
    CHECK(frame.setPixel(15, 15, Rgb{200, 100, 50}));
    CHECK(frame.pixel(0, 0) == (Rgb{1, 2, 3}));
    CHECK(frame.pixel(15, 15) == (Rgb{200, 100, 50}));
    CHECK(frame.pixel(0, 0).r == 1);
    CHECK(frame.pixel(0, 0).g == 2);
    CHECK(frame.pixel(0, 0).b == 3);
}

MUSSE_TEST(frame_buffer_out_of_bounds) {
    FrameBuffer frame;
    const Rgb before = frame.pixel(0, 0);
    CHECK(!frame.setPixel(-1, 0, color::Red));
    CHECK(!frame.setPixel(0, -1, color::Red));
    CHECK(!frame.setPixel(16, 0, color::Red));
    CHECK(!frame.setPixel(0, 16, color::Red));
    CHECK(!frame.setPixel(9999, -9999, color::Red));
    CHECK(frame.pixel(-1, 0) == color::Black);
    CHECK(frame.pixel(16, 16) == color::Black);
    CHECK(frame.pixel(0, 0) == before);
}

MUSSE_TEST(frame_buffer_clear) {
    FrameBuffer frame;
    frame.clear(color::Green);
    for (int y = 0; y < FrameBuffer::kHeight; ++y) {
        for (int x = 0; x < FrameBuffer::kWidth; ++x) {
            CHECK(frame.pixel(x, y) == color::Green);
        }
    }
    frame.clear();
    CHECK(frame.pixel(7, 7) == color::Black);
}

MUSSE_TEST(frame_buffer_fill_rect_clipping) {
    FrameBuffer frame;
    CHECK(frame.fillRect(-2, -2, 4, 4, color::Red));
    CHECK(frame.pixel(0, 0) == color::Red);
    CHECK(frame.pixel(1, 1) == color::Red);
    CHECK(frame.pixel(2, 0) == color::Black);
    CHECK(frame.pixel(0, 2) == color::Black);

    frame.clear();
    CHECK(frame.fillRect(15, 15, 5, 5, color::Cyan));
    CHECK(frame.pixel(15, 15) == color::Cyan);

    CHECK(!frame.fillRect(20, 20, 3, 3, color::Red));
    CHECK(!frame.fillRect(5, 5, 0, 3, color::Red));
    CHECK(!frame.fillRect(5, 5, 3, -1, color::Red));
}

MUSSE_TEST(frame_buffer_draw_rect_and_line) {
    FrameBuffer frame;
    CHECK(frame.drawRect(2, 2, 4, 4, color::White));
    CHECK(frame.pixel(2, 2) == color::White);
    CHECK(frame.pixel(5, 5) == color::White);
    CHECK(frame.pixel(3, 3) == color::Black);

    frame.clear();
    CHECK(frame.drawLine(0, 0, 3, 3, color::Amber));
    CHECK(frame.pixel(0, 0) == color::Amber);
    CHECK(frame.pixel(1, 1) == color::Amber);
    CHECK(frame.pixel(2, 2) == color::Amber);
    CHECK(frame.pixel(3, 3) == color::Amber);
    CHECK(!frame.drawLine(-100, -100, -50, -50, color::Red));
}

MUSSE_TEST(frame_buffer_fill_circle) {
    FrameBuffer frame;
    CHECK(frame.fillCircle(8, 8, 3, color::Orange));
    CHECK(frame.pixel(8, 8) == color::Orange);
    CHECK(frame.pixel(8, 5) == color::Orange);
    CHECK(frame.pixel(11, 8) == color::Orange);
    CHECK(frame.pixel(8, 12) == color::Black);
    CHECK(frame.fillCircle(100, 100, 2, color::Red) == false);
    CHECK(!frame.fillCircle(8, 8, -1, color::Red));
}

MUSSE_TEST(frame_buffer_extreme_rect_values) {
    FrameBuffer frame;
    // x + width would overflow 32-bit; 64-bit math must handle it safely.
    CHECK(!frame.fillRect(INT_MAX - 1, 0, INT_MAX, INT_MAX, color::Red));
    CHECK(!frame.fillRect(INT_MIN, 0, INT_MAX, 1, color::Red));
    CHECK(!frame.fillRect(INT_MAX, INT_MAX, INT_MAX, INT_MAX, color::Red));

    CHECK(frame.fillRect(0, 0, INT_MAX, INT_MAX, color::Black));
    CHECK(frame.pixel(0, 0) == color::Black);  // filled with black explicitly
    frame.clear();
    CHECK(frame.fillRect(0, 0, INT_MAX, INT_MAX, color::Cyan));
    CHECK(frame.pixel(0, 0) == color::Cyan);
    CHECK(frame.pixel(15, 15) == color::Cyan);

    frame.clear();
    CHECK(!frame.drawRect(INT_MIN, INT_MIN, INT_MAX, INT_MAX, color::Red));
    frame.clear();
    CHECK(frame.drawRect(0, 0, INT_MAX, INT_MAX, color::Red));
    CHECK(frame.pixel(0, 0) == color::Red);
    // With a rect far larger than the screen, only the top/left edges are
    // visible; the bottom/right edges lie outside the buffer.
    CHECK(frame.pixel(15, 0) == color::Red);
    CHECK(frame.pixel(0, 15) == color::Red);
}

MUSSE_TEST(frame_buffer_extreme_line_and_circle) {
    FrameBuffer frame;
    CHECK(frame.drawLine(INT_MIN, INT_MIN, INT_MAX, INT_MAX, color::Amber));
    CHECK(frame.pixel(0, 0) == color::Amber);
    CHECK(frame.pixel(15, 15) == color::Amber);

    frame.clear();
    CHECK(frame.drawLine(INT_MIN, INT_MAX, INT_MAX, INT_MIN, color::Amber));
    // The anti-diagonal crosses the screen, so it must terminate and draw.

    frame.clear();
    CHECK(!frame.fillCircle(INT_MAX, INT_MAX, INT_MAX, color::Red));
    CHECK(frame.fillCircle(0, 0, INT_MAX, color::Cyan));
    CHECK(frame.pixel(0, 0) == color::Cyan);
}
