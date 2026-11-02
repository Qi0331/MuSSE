#pragma once

#include <cstdint>
#include <mutex>

#include "musse/display/event.h"

namespace musse::display {

/**
 * Bounded event queue with a protected "critical" lane.
 *
 * Problem being solved: a flood of ordinary emotion events must never push a
 * critical control event (latest device state, error entry, AlertDismiss,
 * Thinking on/off) out of the queue.
 *
 * Design:
 *  - Ordinary events (Emotion, AlertProgress) go into a 16-entry FIFO ring.
 *    When full, the OLDEST ordinary event is dropped and counted.
 *  - Critical events go into one slot per kind (DeviceState, Thinking,
 *    AlertEmotion, AlertDismiss). A slot always keeps the NEWEST event of its
 *    kind (merge, counted), so it can never be overflowed by ordinary events.
 *  - pop() returns the event with the smallest sequence number across both
 *    lanes, so global arrival order is preserved as closely as possible.
 *    Ties favour the critical event.
 *
 * Locking is a policy template:
 *  - host tests: std::mutex (multi-producer safe, no unbounded spinning);
 *  - firmware: portMUX critical section (short, task context only).
 *
 * ISR producers are NOT supported by this queue; use an ISR-safe queue or
 * defer to a task if that is ever needed.
 */
template <class LockPolicy>
class BasicEventQueue {
public:
    static constexpr int kEmotionCapacity = 16;
    static constexpr int kControlSlotCount = 4;

    BasicEventQueue() = default;
    BasicEventQueue(const BasicEventQueue&) = delete;
    BasicEventQueue& operator=(const BasicEventQueue&) = delete;

    void push(const Event& event) {
        lock_.lock();
        Event stored = event;
        stored.seq = nextSeq_++;
        ++pushed_;

        const int slot = controlSlot(stored.type);
        if (slot >= 0) {
            if (slots_[slot].occupied) {
                ++merged_;
            }
            slots_[slot].event = stored;
            slots_[slot].occupied = true;
            lock_.unlock();
            return;
        }

        if (emotionCount_ == kEmotionCapacity) {
            emotionHead_ = (emotionHead_ + 1) % kEmotionCapacity;
            --emotionCount_;
            ++dropped_;
        }
        emotions_[emotionTail_] = stored;
        emotionTail_ = (emotionTail_ + 1) % kEmotionCapacity;
        ++emotionCount_;
        lock_.unlock();
    }

    bool pop(Event& event) {
        lock_.lock();

        int bestSlot = -1;
        std::uint32_t bestSeq = 0xFFFFFFFFu;
        for (int i = 0; i < kControlSlotCount; ++i) {
            if (slots_[i].occupied && slots_[i].event.seq < bestSeq) {
                bestSeq = slots_[i].event.seq;
                bestSlot = i;
            }
        }

        // Strictly smaller: on an equal sequence, critical wins.
        const bool emotionWins =
            emotionCount_ > 0 && emotions_[emotionHead_].seq < bestSeq;

        if (bestSlot >= 0 && !emotionWins) {
            event = slots_[bestSlot].event;
            slots_[bestSlot].occupied = false;
            lock_.unlock();
            return true;
        }
        if (emotionWins) {
            event = emotions_[emotionHead_];
            emotionHead_ = (emotionHead_ + 1) % kEmotionCapacity;
            --emotionCount_;
            lock_.unlock();
            return true;
        }

        lock_.unlock();
        return false;
    }

    int size() const {
        lock_.lock();
        int size = emotionCount_;
        for (const auto& slot : slots_) {
            if (slot.occupied) {
                ++size;
            }
        }
        lock_.unlock();
        return size;
    }

    std::uint32_t dropped() const {
        lock_.lock();
        const auto value = dropped_;
        lock_.unlock();
        return value;
    }

    std::uint32_t merged() const {
        lock_.lock();
        const auto value = merged_;
        lock_.unlock();
        return value;
    }

    std::uint32_t pushed() const {
        lock_.lock();
        const auto value = pushed_;
        lock_.unlock();
        return value;
    }

private:
    struct Slot {
        Event event{};
        bool occupied = false;
    };

    static int controlSlot(EventType type) {
        switch (type) {
            case EventType::DeviceState: return 0;
            case EventType::Thinking: return 1;
            case EventType::AlertEmotion: return 2;
            case EventType::AlertDismiss: return 3;
            case EventType::Emotion:
            case EventType::AlertProgress:
                return -1;
        }
        return -1;
    }

    mutable LockPolicy lock_;
    Event emotions_[kEmotionCapacity] = {};
    int emotionHead_ = 0;
    int emotionTail_ = 0;
    int emotionCount_ = 0;
    Slot slots_[kControlSlotCount] = {};
    std::uint32_t nextSeq_ = 1;
    std::uint32_t dropped_ = 0;
    std::uint32_t merged_ = 0;
    std::uint32_t pushed_ = 0;
};

/** Host implementation: mutex-protected, no unbounded spinning. */
using EventQueue = BasicEventQueue<std::mutex>;

}  // namespace musse::display
