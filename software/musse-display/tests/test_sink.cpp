#include "musse/display/display_sink.h"

#include "test_framework.h"

using namespace musse::display;

namespace {

class InvalidMapper final : public PixelMapper {
public:
    int index(int, int) const override { return 9999; }
};

class ReverseMapper final : public PixelMapper {
public:
    int index(int x, int y) const override {
        return (FrameBuffer::kHeight - 1 - y) * FrameBuffer::kWidth +
               (FrameBuffer::kWidth - 1 - x);
    }
};

}  // namespace

MUSSE_TEST(sink_rgb_stores_frames) {
    RgbSink sink;
    FrameBuffer frame;
    frame.setPixel(4, 4, color::Amber);
    CHECK(sink.drawFrame(frame));
    CHECK(sink.frameCount() == 1);
    CHECK(sink.lastFrame().pixel(4, 4) == color::Amber);

    frame.clear(color::Cyan);
    CHECK(sink.drawFrame(frame));
    CHECK(sink.frameCount() == 2);
    CHECK(sink.lastFrame().pixel(0, 0) == color::Cyan);
}

MUSSE_TEST(sink_monochrome_threshold_and_bits) {
    MonochromeSink sink;
    FrameBuffer frame;
    frame.setPixel(0, 0, color::White);
    frame.setPixel(15, 15, Rgb{255, 255, 255});
    frame.setPixel(1, 0, Rgb{30, 30, 30});   // below threshold
    frame.setPixel(2, 0, Rgb{40, 40, 40});   // above threshold

    CHECK(sink.drawFrame(frame));
    CHECK(sink.frameCount() == 1);
    CHECK(sink.bit(0, 0));
    CHECK(sink.bit(15, 15));
    CHECK(!sink.bit(1, 0));
    CHECK(sink.bit(2, 0));
    CHECK(!sink.bit(-1, 0));
    CHECK(!sink.bit(16, 16));
}

MUSSE_TEST(sink_monochrome_uses_pixel_mapper) {
    ReverseMapper mapper;
    MonochromeSink sink(&mapper);
    FrameBuffer frame;
    frame.setPixel(0, 0, color::White);
    CHECK(sink.drawFrame(frame));
    CHECK(sink.bit(0, 0));  // read back through the same mapper
}

MUSSE_TEST(sink_monochrome_rejects_invalid_mapper) {
    InvalidMapper mapper;
    MonochromeSink sink(&mapper);
    FrameBuffer frame;
    frame.setPixel(0, 0, color::White);
    CHECK(!sink.drawFrame(frame));
    CHECK(sink.frameCount() == 0);
}

MUSSE_TEST(sink_mock_counts_and_failures) {
    MockSink sink;
    CHECK(sink.begin());
    CHECK(sink.beginCount() == 1);

    FrameBuffer frame;
    frame.setPixel(1, 1, color::Red);
    CHECK(sink.drawFrame(frame));
    CHECK(sink.frameCount() == 1);
    CHECK(sink.failureCount() == 0);
    CHECK(sink.lastFrame().pixel(1, 1) == color::Red);

    sink.failOnFrame(2);
    CHECK(!sink.drawFrame(frame));
    CHECK(sink.failureCount() == 1);
    CHECK(sink.drawFrame(frame));  // failure does not poison future frames
    CHECK(sink.frameCount() == 3);

    sink.failAlways(true);
    CHECK(!sink.drawFrame(frame));
    CHECK(sink.failureCount() == 2);

    sink.end();
    CHECK(sink.endCount() == 1);
}

MUSSE_TEST(sink_brightness_is_stored) {
    MockSink sink;
    CHECK(sink.brightness() == 255);
    sink.setBrightness(64);
    CHECK(sink.brightness() == 64);
}

MUSSE_TEST(sink_row_and_column_major_indexing) {
    RowMajorMapper row;
    ColumnMajorMapper column;
    CHECK(row.index(0, 0) == 0);
    CHECK(row.index(15, 0) == 15);
    CHECK(row.index(0, 1) == 16);
    CHECK(column.index(0, 0) == 0);
    CHECK(column.index(1, 0) == 16);
    CHECK(column.index(0, 1) == 1);
}
