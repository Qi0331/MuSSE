#include "musse/display/start_gate.h"

#include "test_framework.h"

using musse::display::StartGate;

MUSSE_TEST(start_gate_single_winner) {
    StartGate gate;
    CHECK(gate.state() == StartGate::State::NotStarted);
    CHECK(gate.beginStart());
    CHECK(gate.state() == StartGate::State::Starting);
    CHECK(!gate.beginStart());  // concurrent caller loses
    CHECK(!gate.running());
}

MUSSE_TEST(start_gate_success_is_terminal) {
    StartGate gate;
    CHECK(gate.beginStart());
    gate.markRunning();
    CHECK(gate.running());
    CHECK(gate.state() == StartGate::State::Running);
    CHECK(!gate.beginStart());
    CHECK(!gate.beginStart());
}

MUSSE_TEST(start_gate_failure_can_retry) {
    StartGate gate;
    CHECK(gate.beginStart());
    gate.markFailed();
    CHECK(gate.state() == StartGate::State::Failed);
    CHECK(!gate.running());

    CHECK(gate.beginStart());  // retry after failure is allowed
    CHECK(gate.state() == StartGate::State::Starting);
    gate.markRunning();
    CHECK(gate.running());
    CHECK(!gate.beginStart());
}

MUSSE_TEST(start_gate_failed_after_running_is_not_retried) {
    StartGate gate;
    CHECK(gate.beginStart());
    gate.markRunning();
    gate.markFailed();  // e.g. fatal task failure
    CHECK(gate.state() == StartGate::State::Failed);
    CHECK(gate.beginStart());  // explicit failure permits restart
}
