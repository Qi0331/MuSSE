cmake_minimum_required(VERSION 3.16)

project(musse_display_m1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(musse_display STATIC
    src/frame_buffer.cpp
    src/emotion.cpp
    src/emotion_renderer.cpp
    src/animation_controller.cpp
    src/state_adapter.cpp
    src/display_sink.cpp
    src/pipeline.cpp
)
target_include_directories(musse_display PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)

if(MSVC)
    target_compile_options(musse_display PRIVATE /W4)
else()
    target_compile_options(musse_display PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(musse_tests
    tests/main.cpp
    tests/test_frame_buffer.cpp
    tests/test_renderer.cpp
    tests/test_animation.cpp
    tests/test_state_adapter.cpp
    tests/test_sink.cpp
    tests/test_pipeline.cpp
    tests/test_upstream_integration.cpp
    tests/test_event_queue.cpp
    tests/test_start_gate.cpp
    tests/test_stability.cpp
)
target_link_libraries(musse_tests PRIVATE musse_display)
find_package(Threads REQUIRED)
target_link_libraries(musse_tests PRIVATE Threads::Threads)
if(MSVC)
    target_compile_options(musse_tests PRIVATE /W4)
else()
    target_compile_options(musse_tests PRIVATE -Wall -Wextra -Wpedantic)
endif()

enable_testing()
add_test(NAME musse_unit_tests COMMAND musse_tests)

add_executable(musse_preview_gen tools/preview_gen.cpp)
target_link_libraries(musse_preview_gen PRIVATE musse_display)

add_executable(musse_bench tools/bench.cpp)
target_link_libraries(musse_bench PRIVATE musse_display)

add_test(
    NAME musse_preview_generation
    COMMAND musse_preview_gen
            ${CMAKE_CURRENT_SOURCE_DIR}/tools/preview_template.html
            ${CMAKE_CURRENT_SOURCE_DIR}/preview/preview.html
)
