#define main generated_main
#include "host.cpp"
#undef main
#include <chrono>
#include <thread>
#define CHECK(x)                                                                                   \
  do {                                                                                             \
    if (!(x)) {                                                                                    \
      std::fprintf(stderr, "Tensor result assertion %d: %s\n", __LINE__, #x);                      \
      std::abort();                                                                                \
    }                                                                                              \
  } while (false)
std::uint64_t failureAttempt = 0;
bool injectedConstruct(Invocation &context, void *frame, const Packet &packet) {
  context.failAllocationAt(failureAttempt);
  return construct(context, frame, packet);
}
void empty(m::Runtime &runtime) {
  auto s = runtime.stats();
  CHECK(!s.bytes && !s.metalBuffers && !s.hostBackings && !s.deviceBackings && !s.inFlight &&
        !s.stagingBuffers);
}
void retire(TaskCore &core, GroupHandle group) {
  CHECK(core.close(group));
  CHECK(core.drain());
  CHECK(core.release(group));
  auto s = core.stats();
  CHECK(!s.records && !s.groups && !s.retainedBytes && !s.retainedOwners && !s.externalPending);
}
m::Buffer observe(TaskCore &core, TaskHandle task) {
  Invocation context;
  alignas(m::Buffer) std::byte slot[sizeof(m::Buffer)];
  CHECK(core.observe(task, m::Runtime::bufferLayout(), context, slot));
  auto *value = std::launder(reinterpret_cast<m::Buffer *>(slot));
  auto result = *value;
  value->~Buffer();
  return result;
}
void verify(const m::Buffer &value) {
  CHECK(!value.onDevice() && value.shape().size() == 1 && value.shape()[0] == 3);
  auto bytes = value.hostBytes();
  CHECK(bytes && bytes->size() == 12);
  std::array<std::uint32_t, 3> bits{};
  std::memcpy(bits.data(), bytes->data(), 12);
  CHECK((bits == std::array<std::uint32_t, 3>{0x40a00000u, 0x41400000u, 0x41a80000u}));
}
template <class F> void until(TaskCore &core, F condition) {
  auto end = std::chrono::steady_clock::now() + std::chrono::seconds(10);
  while (!condition()) {
    core.step();
    CHECK(std::chrono::steady_clock::now() < end);
    std::this_thread::yield();
  }
}
int main(int argc, char **argv) {
  CHECK(argc == 2 && generated_main(argc, argv) == 0);
  auto made = m::Runtime::create();
  CHECK(made);
  auto runtime = std::move(*made);
  for (unsigned workers : {1u, 2u, 4u}) {
    bool success = false;
    unsigned failures = 0;
    for (std::uint64_t fail = 1; fail <= 128; ++fail) {
      failureAttempt = fail;
      TaskLimits limits;
      limits.workers = workers;
      auto core = TaskCore::create(limits);
      CHECK(core);
      auto group = core->openRoot();
      PacketData packet{runtime.get(), argv[1]};
      auto injected = entry;
      injected.construct = injectedConstruct;
      auto task = core->submit(group, injected, {entry.packetLayout, &packet, sizeof(packet)});
      CHECK(task && core->drain());
      auto failure = core->failure(task);
      if (failure.kind == TaskFailure::None) {
        auto first = observe(*core, task), second = observe(*core, task);
        CHECK(first.hostBytes()->data() == second.hostBytes()->data());
        // Returned CPU backing survives the invocation, scheduler and all GPU intermediates.
        retire(*core, group);
        core.reset();
        verify(first);
        verify(second);
        first = {};
        second = {};
        success = true;
      } else {
        CHECK(failure.kind == TaskFailure::Fault && failure.code == 2);
        retire(*core, group);
        ++failures;
      }
      empty(*runtime);
      if (success)
        break;
    }
    CHECK(success && failures >= 8);
    std::printf("%u workers: %u CPU allocation failures unwound\n", workers, failures);
  }
  failureAttempt = 0;
  // Include CPU-result lease construction in the Metal allocation failure sweep.
  runtime->failAllocationAt(0);
  auto run = [&](bool succeeds) {
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    PacketData packet{runtime.get(), argv[1]};
    auto task = core->submit(group, entry, {entry.packetLayout, &packet, sizeof(packet)});
    CHECK(task && core->drain());
    if (succeeds) {
      CHECK(core->failure(task).kind == TaskFailure::None);
      verify(observe(*core, task));
    } else
      CHECK(core->failure(task).kind != TaskFailure::None);
    retire(*core, group);
    empty(*runtime);
  };
  run(true);
  auto attempts = runtime->stats().attempts;
  CHECK(attempts > 0);
  for (std::uint64_t fail = 1; fail <= attempts; ++fail) {
    runtime->failAllocationAt(fail);
    run(false);
  }
  runtime->failAllocationAt(0);
  for (unsigned scenario : {0u, 1u, 2u}) {
    auto core = TaskCore::create();
    CHECK(core);
    auto group = core->openRoot();
    PacketData packet{runtime.get(), argv[1]};
    auto before = runtime->stats().completions, submissions = runtime->stats().submissions;
    auto task = core->submit(group, entry, {entry.packetLayout, &packet, sizeof(packet)});
    CHECK(task);
    until(*core, [&] { return runtime->stats().completions >= before + 2; });
    runtime->holdCompletions(true);
    if (scenario == 2)
      runtime->failNextCompletion();
    until(*core, [&] {
      return runtime->stats().submissions == submissions + 3 && core->stats().externalPending == 1;
    });
    if (scenario < 2)
      CHECK(core->cancel(group, scenario == 1));
    runtime->holdCompletions(false);
    CHECK(core->drain());
    CHECK(core->failure(task).kind != TaskFailure::None);
    retire(*core, group);
    empty(*runtime);
  }
  // The retained CPU results share the registry budget with transfers and GPU work.
  auto limited = m::Runtime::create({.maxBytes = 16});
  CHECK(limited);
  auto core = TaskCore::create();
  CHECK(core);
  auto group = core->openRoot();
  PacketData packet{limited->get(), argv[1]};
  auto task = core->submit(group, entry, {entry.packetLayout, &packet, sizeof(packet)});
  CHECK(task && core->drain());
  CHECK(core->failure(task).kind == TaskFailure::Fault &&
        core->failure(task).code == std::int64_t(m::Error::Budget));
  retire(*core, group);
  empty(**limited);
  std::puts(
      "CPU tensor return ownership, cached results, failure cleanup and GPU cancellation passed");
}
