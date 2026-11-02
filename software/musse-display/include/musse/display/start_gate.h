#pragma once

#include <atomic>
#include <cstdint>

namespace musse::display {

/**
 * One-shot start gate with explicit failure/retry semantics.
 *
 * States:
 *   NotStarted -> Starting -> Running
 *                        \-> Failed -> Starting (retry allowed)
 *
 * Concurrent callers: exactly one CAS winner moves to Starting; other callers
 * return false until the winner marks Running or Failed.
 */
class StartGate {
public:
    enum class State : int {
        NotStarted = 0,
        Starting,
        Running,
        Failed,
    };

    bool beginStart() {
        State expected = state_.load(std::memory_order_acquire);
        while (expected == State::NotStarted || expected == State::Failed) {
            if (state_.compare_exchange_weak(expected, State::Starting,
                                             std::memory_order_acq_rel,
                                             std::memory_order_acquire)) {
                return true;
            }
        }
        return false;
    }

    void markRunning() { state_.store(State::Running, std::memory_order_release); }
    void markFailed() { state_.store(State::Failed, std::memory_order_release); }

    State state() const { return state_.load(std::memory_order_acquire); }
    bool running() const { return state() == State::Running; }

private:
    std::atomic<State> state_{State::NotStarted};
};

}  // namespace musse::display
