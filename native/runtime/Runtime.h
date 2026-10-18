#pragma once
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>

namespace kalandra::runtime {
struct Owner;
struct Backing;
// A read-only retained allocation independent of any invocation's owner list.
// Move-only: shared values retain their enclosing backing, not this lease itself.
class AllocationLease final {
public:
  AllocationLease() = default;
  ~AllocationLease();
  AllocationLease(AllocationLease &&) noexcept;
  AllocationLease &operator=(AllocationLease &&) noexcept;
  AllocationLease(const AllocationLease &) = delete;
  AllocationLease &operator=(const AllocationLease &) = delete;
  explicit operator bool() const noexcept { return backing_ != nullptr; }
  std::span<const std::byte> bytes() const noexcept;

private:
  Backing *backing_ = nullptr;
  explicit AllocationLease(Backing *backing) noexcept : backing_(backing) {}
  friend class Invocation;
};
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
  // Field backing remains invocation-owned across inline aggregate copies.
  // Release only at a scalar CLI boundary; ordinary helpers may return records.
  void *allocateRecord(std::uint64_t bytes) noexcept;
  void releaseRecords() noexcept;
  bool retainFrom(const Invocation &source, void *buffer) noexcept;
  void release(void *buffer) noexcept;
  // Requires exclusive source-context access, like retainFrom. Reject unknown,
  // faulted or settled contexts before acquiring a backing reference.
  bool usable() const noexcept { return !settled_ && !code_ && !taskError_; }
  std::optional<AllocationLease> lease(const void *allocated) const noexcept;
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
void kalandra_record_array_validate_v1(kalandra::runtime::Invocation *, const void *, std::uint64_t,
                                       std::uint64_t) noexcept;
bool kalandra_record_array_retain_v1(kalandra::runtime::Invocation *,
                                     const kalandra::runtime::Invocation *, const void *,
                                     std::uint64_t, std::uint64_t) noexcept;
void *kalandra_record_alloc_v1(kalandra::runtime::Invocation *, std::uint64_t) noexcept;
void kalandra_record_cleanup_v1(kalandra::runtime::Invocation *) noexcept;
void kalandra_record_validate_v1(kalandra::runtime::Invocation *, const void *, std::uint64_t,
                                 std::uint64_t) noexcept;
bool kalandra_record_retain_v1(kalandra::runtime::Invocation *,
                               const kalandra::runtime::Invocation *, const void *, std::uint64_t,
                               std::uint64_t) noexcept;
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
