#include "Runtime.h"
#include <atomic>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <new>
#include <utility>

namespace kalandra::runtime {
struct Backing;
struct Owner {
  Owner *next = nullptr;
  Owner *previous = nullptr;
  Backing *backing;
  bool embedded;
};
struct alignas(std::max_align_t) Backing {
  std::atomic<std::uint64_t> references{1};
  Owner initial{nullptr, nullptr, this, true};
  std::uint64_t bytes = 0;
};
namespace {
void releaseBacking(Backing *backing) noexcept {
  if (backing && backing->references.fetch_sub(1, std::memory_order_acq_rel) == 1) {
    backing->~Backing();
    std::free(backing);
  }
}
} // namespace
AllocationLease::~AllocationLease() { releaseBacking(backing_); }
AllocationLease::AllocationLease(AllocationLease &&other) noexcept
    : backing_(std::exchange(other.backing_, nullptr)) {}
AllocationLease &AllocationLease::operator=(AllocationLease &&other) noexcept {
  if (this != &other) {
    releaseBacking(backing_);
    backing_ = std::exchange(other.backing_, nullptr);
  }
  return *this;
}
std::span<const std::byte> AllocationLease::bytes() const noexcept {
  return backing_ ? std::span<const std::byte>(reinterpret_cast<const std::byte *>(backing_ + 1),
                                               backing_->bytes)
                  : std::span<const std::byte>{};
}
std::optional<AllocationLease> Invocation::lease(const void *allocated) const noexcept {
  if (!usable() || !allocated)
    return {};
  auto *owner = head_;
  while (owner && owner->backing + 1 != allocated)
    owner = owner->next;
  if (!owner)
    return {};
  auto *backing = owner->backing;
  auto references = backing->references.load(std::memory_order_relaxed);
  do {
    if (references == std::numeric_limits<std::uint64_t>::max())
      return {};
  } while (!backing->references.compare_exchange_weak(references, references + 1,
                                                      std::memory_order_relaxed));
  return AllocationLease(backing);
}
Invocation::Invocation() noexcept {
  if (const auto *text = std::getenv("KALANDRA_TEST_FAIL_ALLOC_AT")) {
    char *end = nullptr;
    const auto failure = std::strtoull(text, &end, 10);
    if (end != text && *end == '\0')
      failAt_ = failure;
  }
}
Invocation::~Invocation() { settle(); }
void Invocation::fault(std::int64_t code, std::int64_t line, std::int64_t column) noexcept {
  if (!code_) {
    code_ = code ? code : 3;
    line_ = line;
    column_ = column;
  }
}
bool Invocation::reserve() noexcept {
  if (settled_)
    fault(3);
  if (code_)
    return false;
  if (++attempts_ == failAt_) {
    fault(2);
    return false;
  }
  return true;
}
void Invocation::attach(Owner *owner) noexcept {
  owner->next = head_;
  owner->previous = nullptr;
  if (head_)
    head_->previous = owner;
  head_ = owner;
  ++live_;
  ++allocations_;
}
void Invocation::remove(Owner *owner) noexcept {
  if (owner->previous)
    owner->previous->next = owner->next;
  else
    head_ = owner->next;
  if (owner->next)
    owner->next->previous = owner->previous;
  auto *backing = owner->backing;
  if (!owner->embedded) {
    owner->~Owner();
    std::free(owner);
  }
  releaseBacking(backing);
  --live_;
  ++releases_;
}
void *Invocation::allocate(std::uint64_t bytes) noexcept {
  if (!reserve())
    return nullptr;
  if (bytes > std::numeric_limits<std::size_t>::max() - sizeof(Backing)) {
    fault(2);
    return nullptr;
  }
  auto *storage = std::malloc(static_cast<std::size_t>(bytes) + sizeof(Backing));
  if (!storage) {
    fault(2);
    return nullptr;
  }
  auto *backing = new (storage) Backing;
  backing->bytes = bytes;
  attach(&backing->initial);
  return backing + 1;
}
bool Invocation::retainFrom(const Invocation &source, void *buffer) noexcept {
  if (!reserve())
    return false;
  auto *existing = source.head_;
  while (existing && existing->backing + 1 != buffer)
    existing = existing->next;
  if (!existing) {
    fault(3);
    return false;
  }
  auto *storage = std::malloc(sizeof(Owner));
  if (!storage) {
    fault(2);
    return false;
  }
  auto *backing = existing->backing;
  // Source context access is exclusive during packet construction. Its owner
  // keeps this backing alive until the new reference has been established.
  auto references = backing->references.load(std::memory_order_relaxed);
  do {
    if (references == std::numeric_limits<std::uint64_t>::max()) {
      std::free(storage);
      fault(3);
      return false;
    }
  } while (!backing->references.compare_exchange_weak(references, references + 1,
                                                      std::memory_order_relaxed));
  attach(new (storage) Owner{nullptr, nullptr, backing, false});
  return true;
}
void Invocation::release(void *buffer) noexcept {
  auto *owner = head_;
  while (owner && owner->backing + 1 != buffer)
    owner = owner->next;
  if (!owner) {
    fault(3);
    return;
  }
  remove(owner);
}
void Invocation::settle() noexcept {
  while (head_)
    remove(head_);
  settled_ = true;
}
void Invocation::expectedTaskError(std::int64_t kind, std::int64_t code, std::int64_t line,
                                   std::int64_t column) noexcept {
  if (!taskError_ && !code_) {
    taskError_ = kind;
    expectedCode_ = code;
    expectedLine_ = line;
    expectedColumn_ = column;
  }
}
[[noreturn]] void Invocation::reportFailure() noexcept {
  if (!code_ && !taskError_)
    fault(3);
  const char *name = code_ == 1 ? "ShapeFault" : code_ == 2 ? "AllocationFault" : "RuntimeFault";
  if (taskError_)
    name = taskError_ == 1   ? "TaskError.Fault"
           : taskError_ == 2 ? "TaskError.Cancelled"
           : taskError_ == 3 ? "TaskError.DeadlineExceeded"
                             : "TaskError.AdmissionRejected";
  std::fprintf(stderr, "%s at source %lld:%lld\n", name,
               static_cast<long long>(taskError_ ? expectedLine_ : line_),
               static_cast<long long>(taskError_ ? expectedColumn_ : column_));
  settle();
  if (std::getenv("KALANDRA_TEST_REPORT_CLEANUP"))
    std::fprintf(stderr, "cleanup: live=%llu allocations=%llu releases=%llu\n",
                 static_cast<unsigned long long>(live_.load()),
                 static_cast<unsigned long long>(allocations_),
                 static_cast<unsigned long long>(releases_));
  std::exit(taskError_ ? 88 : code_ == 1 ? 87 : 86);
}
} // namespace kalandra::runtime
extern "C" void *kalandra_alloc_v1(kalandra::runtime::Invocation *context,
                                   std::uint64_t bytes) noexcept {
  return context->allocate(bytes);
}
extern "C" void kalandra_free_v1(kalandra::runtime::Invocation *context, void *buffer) noexcept {
  context->release(buffer);
}
extern "C" void kalandra_fault_v1(kalandra::runtime::Invocation *context, std::int64_t code,
                                  std::int64_t line, std::int64_t column) noexcept {
  context->fault(code, line, column);
}
extern "C" std::int64_t kalandra_status_v1(kalandra::runtime::Invocation *context) noexcept {
  return context->executionStatus();
}

extern "C" bool kalandra_retain_v1(kalandra::runtime::Invocation *destination,
                                   const kalandra::runtime::Invocation *source,
                                   void *buffer) noexcept {
  return source && destination->retainFrom(*source, buffer);
}
extern "C" void kalandra_expected_task_error_v1(kalandra::runtime::Invocation *context,
                                                std::int64_t kind, std::int64_t code,
                                                std::int64_t line, std::int64_t column) noexcept {
  context->expectedTaskError(kind, code, line, column);
}

extern "C" std::int64_t kalandra_poll_v1(kalandra::runtime::Invocation *context) noexcept {
  return context->poll();
}
