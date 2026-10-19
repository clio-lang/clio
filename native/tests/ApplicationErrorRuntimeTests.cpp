#include "../runtime/String.h"
#include "../runtime/Tasks.h"
#include <array>
#include <cstring>
#include <iostream>
#include <stdexcept>
using namespace kalandra::runtime;
struct Descriptor {
  void *allocated, *data;
  std::int64_t offset, size, stride;
};
struct Error {
  std::int64_t tag;
  StringDescriptor reason;
  Descriptor numbers;
};
struct Result {
  Failure failure;
  std::int64_t value;
  Error error;
};
extern "C" const TaskEntry *const kalandra_task_test_entry;
static void require(bool ok, const char *message) {
  if (!ok)
    throw std::runtime_error(message);
}
static void verify(Invocation &context, const Result &result) {
  require(result.failure.kind == TaskFailure::None && result.error.tag == 2,
          "application error became a task failure or changed variant");
  const auto &text = result.error.reason;
  require(validateString(context, text) && text.byteLength == 6 &&
              !std::memcmp(text.data, "é🙂", 6),
          "application text lost after settlement");
  const auto &numbers = result.error.numbers;
  auto lease = context.lease(numbers.allocated);
  require(lease && numbers.data == numbers.allocated && numbers.offset == 0 && numbers.size == 2 &&
              numbers.stride == 1,
          "application array backing lost");
  std::array<std::int64_t, 2> values{};
  require(lease->bytes().size() == sizeof(values), "application array size changed");
  std::memcpy(values.data(), lease->bytes().data(), sizeof(values));
  require(values[0] == 20 && values[1] == 22, "application payload values changed");
}
int main(int argc, char **argv) {
  try {
    require(argc == 2, "expected worker count");
    TaskLimits limits;
    limits.workers = std::stoul(argv[1]);
    auto core = TaskCore::create(limits);
    require(bool(core), "scheduler creation failed");
    auto *entry = kalandra_task_test_entry;
    require(entry && entry->packetBytes == 0 && entry->result->bytes == sizeof(Result),
            "application result layout mismatch");
    Invocation pending;
    pending.expectedApplicationError("ReadError", "Bad");
    require(pending.hasExpectedError() && pending.hasApplicationError() &&
                !pending.hasTaskError() && !pending.status() && !pending.usable(),
            "application error conflated with a task or execution fault");
    Invocation source, survivor;
    auto group = core->openRoot();
    auto task = core->submit(group, *entry, {entry->packetLayout, nullptr, 0, &source});
    require(task && core->close(group) && core->drain(), "application task did not settle");
    require(core->failure(task).kind == TaskFailure::None,
            "expected application result became execution failure");
    for (unsigned attempt = 1; attempt <= 2; ++attempt) {
      Invocation rejected;
      rejected.failAllocationAt(attempt);
      alignas(Result) std::array<std::byte, sizeof(Result)> output;
      output.fill(std::byte{0x5a});
      const auto before = output;
      require(!core->observe(task, *entry->result, rejected, output.data()) && output == before,
              "partial application retention published output");
      rejected.settle();
      require(!rejected.live() && rejected.allocations() == rejected.releases(),
              "failed application observation leaked");
    }
    Result result{};
    require(core->observe(task, *entry->result, survivor, &result),
            "application observation failed");
    verify(survivor, result);
    for (unsigned mode = 0; mode < 3; ++mode) {
      auto invalid = result;
      if (mode == 0)
        invalid.error.tag = 999;
      if (mode == 1)
        invalid.error.numbers.stride = 2;
      if (mode == 2)
        invalid.error.reason.byteLength = -1;
      Invocation rejected;
      alignas(Result) std::array<std::byte, sizeof(Result)> output;
      output.fill(std::byte{0x5a});
      const auto before = output;
      require(!entry->result->copy(rejected, output.data(), survivor, &invalid) && output == before,
              "malformed application payload published output");
      rejected.settle();
      require(!rejected.live() && rejected.allocations() == rejected.releases(),
              "malformed application retention leaked");
    }
    Result again{};
    require(core->observe(task, *entry->result, survivor, &again),
            "cached application observation failed");
    require(result.error.reason.allocated == again.error.reason.allocated &&
                result.error.numbers.allocated == again.error.numbers.allocated,
            "application backing unexpectedly copied");
    require(core->release(group), "application group release failed");
    const auto stats = core->stats();
    require(!stats.records && !stats.groups && !stats.retainedOwners && !stats.retainedBytes,
            "application scheduler ownership leaked");
    core.reset();
    verify(survivor, result);
    verify(survivor, again);
    survivor.settle();
    require(!survivor.live() && survivor.allocations() == survivor.releases(),
            "surviving application owners leaked");
    std::cout << "Application result: exact payloads, source/scheduler settlement, shared cached "
                 "observations, rejected metadata and partial-retention cleanup passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
