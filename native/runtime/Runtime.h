#pragma once
#include <atomic>
#include <cstdint>

namespace kalandra::runtime {
struct Owner;
// One execution unit. Access to a context is exclusive, even if its execution
// later migrates between workers. Backing references can cross contexts.
class Invocation final {
public:
  Invocation() noexcept;
  ~Invocation();
  Invocation(const Invocation &) = delete;
  Invocation &operator=(const Invocation &) = delete;
  void bindCancellation(const std::atomic<bool> *token) noexcept { cancellation_ = token; }
  // Private test probe; its atomic counter must outlive this invocation.
  void watchPolls(std::atomic<std::uint64_t> *counter) noexcept { pollCounter_ = counter; }
  std::int64_t poll() noexcept {
    if (pollCounter_)
      pollCounter_->fetch_add(1, std::memory_order_relaxed);
    const auto code = executionStatus();
    return code ? code : cancellation_ && cancellation_->load(std::memory_order_acquire) ? -1 : 0;
  }
  void *allocate(std::uint64_t bytes) noexcept;
  bool retainFrom(const Invocation &source, void *buffer) noexcept;
  void release(void *buffer) noexcept;
  void fault(std::int64_t code, std::int64_t line = 0, std::int64_t column = 0) noexcept;
  void settle() noexcept;
  void expectedTaskError(std::int64_t kind, std::int64_t code, std::int64_t line,
                         std::int64_t column) noexcept;
  bool hasTaskError() const noexcept { return taskError_ != 0; }
  [[noreturn]] void reportFailure() noexcept; // CLI boundary only, never generated code.
  void failAllocationAt(std::uint64_t attempt) noexcept { failAt_ = attempt; }
  std::int64_t status() const noexcept { return code_; }
  std::int64_t executionStatus() noexcept {
    if (settled_)
      fault(3);
    return code_;
  }
  std::int64_t line() const noexcept { return line_; }
  std::int64_t column() const noexcept { return column_; }
  std::uint64_t live() const noexcept { return live_; }
  std::uint64_t allocations() const noexcept { return allocations_; }
  std::uint64_t releases() const noexcept { return releases_; }

private:
  Owner *head_ = nullptr;
  std::atomic<std::uint64_t> live_{0};
  const std::atomic<bool> *cancellation_ = nullptr;
  std::atomic<std::uint64_t> *pollCounter_ = nullptr;
  std::uint64_t allocations_ = 0, releases_ = 0, attempts_ = 0, failAt_ = 0;
  std::int64_t code_ = 0, line_ = 0, column_ = 0;
  bool settled_ = false;
  std::int64_t taskError_ = 0, expectedCode_ = 0, expectedLine_ = 0, expectedColumn_ = 0;
  bool reserve() noexcept;
  void attach(Owner *owner) noexcept;
  void remove(Owner *owner) noexcept;
};
} // namespace kalandra::runtime

// Revision is encoded in the symbols: mismatched compiler/runtime builds fail
// at link time. No process-global or thread-local current invocation exists.
extern "C" {
bool kalandra_retain_v1(kalandra::runtime::Invocation *, const kalandra::runtime::Invocation *,
                        void *) noexcept;
void kalandra_expected_task_error_v1(kalandra::runtime::Invocation *, std::int64_t, std::int64_t,
                                     std::int64_t, std::int64_t) noexcept;
void *kalandra_alloc_v1(kalandra::runtime::Invocation *, std::uint64_t bytes) noexcept;
void kalandra_free_v1(kalandra::runtime::Invocation *, void *buffer) noexcept;
void kalandra_fault_v1(kalandra::runtime::Invocation *, std::int64_t code, std::int64_t line,
                       std::int64_t column) noexcept;
std::int64_t kalandra_poll_v1(kalandra::runtime::Invocation *) noexcept;
std::int64_t kalandra_status_v1(kalandra::runtime::Invocation *) noexcept;
}
