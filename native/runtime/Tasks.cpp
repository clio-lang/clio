#include "Tasks.h"
#include <algorithm>
#include <cstdlib>
#include <limits>
#include <new>
#include <utility>

namespace kalandra::runtime {
namespace {
enum class State {
  Free,
  Prepared,
  Runnable,
  Running,
  WaitingTask,
  WaitingGroup,
  Settling,
  Settled
};
struct Record {
  std::uint64_t generation = 1;
  State state = State::Free;
  GroupHandle group;
  const TaskEntry *entry = nullptr;
  void *frame = nullptr, *value = nullptr;
  bool initialized = false, valueInitialized = false, observed = false, queued = false;
  bool cancel = false, counted = false;
  Invocation execution, outcome;
  Failure failure;
  TaskHandle dependency;
  GroupHandle groupDependency;
};
struct Group {
  std::uint64_t generation = 1;
  bool used = false, closed = false, settled = false, observed = false;
  TaskHandle owner;
  GroupHandle parent;
  std::uint32_t depth = 0, outstanding = 0;
  Failure failure;
};
bool aligned(const void *pointer, std::size_t alignment) {
  return pointer && reinterpret_cast<std::uintptr_t>(pointer) % alignment == 0;
}
bool validAlignment(std::size_t alignment) {
  return alignment && !(alignment & (alignment - 1)) && alignment <= alignof(std::max_align_t);
}
Failure invocationFailure(const Invocation &context) {
  return {TaskFailure::Fault, context.status() ? context.status() : 3, context.line(),
          context.column()};
}
} // namespace
struct TaskCore::Impl {
  TaskLimits limits;
  TaskStats stats;
  std::unique_ptr<Record[]> tasks;
  std::unique_ptr<Group[]> groups;
  std::unique_ptr<TaskHandle[]> queue;
  std::uint32_t queueHead = 0, queueCount = 0, cursor = 0;
  std::uint64_t attempts = 0, failAt = 0;
  bool stepping = false;
  explicit Impl(TaskLimits l)
      : limits(l), tasks(std::make_unique<Record[]>(std::size_t(l.records) + l.groups)),
        groups(std::make_unique<Group[]>(l.groups)),
        queue(std::make_unique<TaskHandle[]>(l.ready)) {}
  TaskHandle handle(std::uint32_t index) const { return {index, tasks[index].generation}; }
  GroupHandle groupHandle(std::uint32_t index) const { return {index, groups[index].generation}; }
  Record *get(TaskHandle h) const {
    if (h.slot >= std::size_t(limits.records) + limits.groups)
      return nullptr;
    auto &record = tasks[h.slot];
    return record.state != State::Free && record.generation == h.generation ? &record : nullptr;
  }
  Group *get(GroupHandle h) const {
    if (h.slot >= limits.groups)
      return nullptr;
    auto &group = groups[h.slot];
    return group.used && group.generation == h.generation ? &group : nullptr;
  }
  void freeBytes(void *&pointer, std::size_t bytes) {
    if (pointer) {
      std::free(pointer);
      pointer = nullptr;
      stats.retainedBytes -= bytes;
    }
  }
  void *allocate(std::size_t bytes) {
    if (++attempts == failAt || bytes > limits.bytes - stats.retainedBytes)
      return nullptr;
    auto *pointer = std::malloc(std::max(std::size_t(1), bytes));
    if (pointer) {
      stats.retainedBytes += bytes;
      stats.peakBytes = std::max(stats.peakBytes, stats.retainedBytes);
    }
    return pointer;
  }
  void enqueue(std::uint32_t index) {
    auto &record = tasks[index];
    if (!record.queued && record.state == State::Runnable && queueCount < limits.ready) {
      queue[(queueHead + queueCount) % limits.ready] = handle(index);
      ++queueCount;
      record.queued = true;
    }
  }
  void wake(std::uint32_t index) {
    auto &record = tasks[index];
    if (record.state == State::WaitingTask || record.state == State::WaitingGroup) {
      record.state = State::Runnable;
      record.dependency = {};
      record.groupDependency = {};
    }
    enqueue(index);
  }
  GroupHandle open(TaskHandle owner, GroupHandle lexical = {}) {
    std::uint32_t depth = 0;
    GroupHandle parent;
    if (owner) {
      auto *task = get(owner);
      if (!task || task->state != State::Running)
        return {};
      parent = lexical ? lexical : task->group;
      if (!get(parent) || (lexical && get(parent)->owner != owner)) {
        task->execution.fault(3);
        return {};
      }
      depth = get(parent)->depth + 1;
      if (depth > limits.depth) {
        failGroup(task->group, {TaskFailure::AdmissionRejected});
        return {};
      }
    }
    for (std::uint32_t i = 0; i < limits.groups; ++i) {
      auto &group = groups[i];
      if (!group.used) {
        group.used = true;
        group.owner = owner;
        group.parent = parent;
        if (auto *ancestor = get(parent); ancestor && ancestor->failure.kind != TaskFailure::None) {
          group.failure = {TaskFailure::Cancelled};
          group.closed = true;
        }
        group.depth = depth;
        ++stats.groups;
        return groupHandle(i);
      }
    }
    if (auto *task = get(owner))
      task->execution.fault(2);
    return {};
  }
  void failGroup(GroupHandle h, Failure failure) {
    auto *group = get(h);
    if (!group || group->settled)
      return;
    if (group->failure.kind == TaskFailure::None)
      group->failure = failure;
    group->closed = true;
    // Mark descendants iteratively. No recursion proportional to nesting depth.
    bool changed;
    do {
      changed = false;
      for (std::uint32_t i = 0; i < limits.records; ++i) {
        auto &task = tasks[i];
        auto *parent = get(task.group);
        if (task.state != State::Free && task.state != State::Settled && parent &&
            parent->failure.kind != TaskFailure::None && !task.cancel) {
          task.cancel = true;
          wake(i);
          changed = true;
        }
      }
      for (std::uint32_t i = 0; i < limits.groups; ++i) {
        auto &nested = groups[i];
        auto *owner = get(nested.owner);
        auto *parent = get(nested.parent);
        if (nested.used && !nested.settled &&
            ((owner && owner->cancel) || (parent && parent->failure.kind != TaskFailure::None)) &&
            nested.failure.kind == TaskFailure::None) {
          nested.failure = {TaskFailure::Cancelled};
          nested.closed = true;
          changed = true;
        }
      }
    } while (changed);
  }
  TaskHandle rejected(GroupHandle h, Failure failure) {
    auto &record = tasks[limits.records + h.slot];
    if (record.state == State::Free) {
      record.state = State::Settled;
      record.group = h;
      record.failure = failure;
      ++stats.records;
      ++stats.publications;
    }
    failGroup(h, failure);
    return handle(limits.records + h.slot);
  }
  TaskHandle submit(GroupHandle h, const TaskEntry &entry, Packet packet, TaskHandle owner) {
    auto *group = get(h);
    if (!group || group->owner != owner || group->settled)
      return {};
    if (group->closed || group->failure.kind != TaskFailure::None)
      return rejected(h, group->failure.kind == TaskFailure::None
                             ? Failure{TaskFailure::AdmissionRejected}
                             : group->failure);
    if (entry.revision != 1 || !entry.result || !entry.construct || !entry.destroy ||
        !entry.resume || !entry.result->copy || !entry.result->destroy || !entry.result->identity ||
        !entry.frameBytes || !entry.result->bytes || !validAlignment(entry.frameAlignment) ||
        !validAlignment(entry.packetAlignment) || !validAlignment(entry.result->alignment) ||
        packet.layout != entry.packetLayout || packet.bytes != entry.packetBytes ||
        (packet.bytes && !aligned(packet.data, entry.packetAlignment)) ||
        entry.frameBytes > limits.bytes || entry.result->bytes > limits.bytes - entry.frameBytes)
      return rejected(h, {TaskFailure::AdmissionRejected});
    if (stats.unfinished == limits.inFlight || queueCount == limits.ready ||
        entry.frameBytes + entry.result->bytes > limits.bytes - stats.retainedBytes)
      return rejected(h, {TaskFailure::AdmissionRejected});
    std::uint32_t slot = 0;
    while (slot < limits.records && tasks[slot].state != State::Free)
      ++slot;
    if (slot == limits.records)
      return rejected(h, {TaskFailure::AdmissionRejected});
    auto &task = tasks[slot];
    task.state = State::Prepared;
    task.group = h;
    task.entry = &entry;
    task.counted = true;
    ++group->outstanding;
    ++stats.unfinished;
    ++stats.records;
    task.value = allocate(entry.result->bytes);
    if (task.value)
      task.frame = allocate(entry.frameBytes);
    if (!task.value || !task.frame)
      task.execution.fault(2);
    else {
      try {
        task.initialized = entry.construct(task.execution, task.frame, packet);
      } catch (...) {
        task.execution.fault(3);
      }
      if (!task.initialized)
        task.execution.fault(3);
    }
    if (task.execution.status()) {
      task.failure = invocationFailure(task.execution);
      task.state = State::Settling;
      failGroup(h, task.failure);
    } else {
      task.state = State::Runnable;
      enqueue(slot);
    }
    return handle(slot);
  }
  bool owned(GroupHandle h, TaskHandle owner) const {
    auto *group = get(h);
    return group && group->owner == owner;
  }
  bool close(GroupHandle h, TaskHandle owner) {
    auto *group = get(h);
    if (!group || group->owner != owner)
      return false;
    group->closed = true;
    return true;
  }
  bool read(TaskHandle h, const ValueLayout &layout, Invocation &destination, void *output,
            TaskHandle owner) {
    auto *task = get(h);
    if (destination.executionStatus() || !task || !owned(task->group, owner) ||
        task->state != State::Settled || task->failure.kind != TaskFailure::None ||
        !task->valueInitialized || &layout != task->entry->result ||
        !aligned(output, layout.alignment)) {
      destination.fault(3);
      return false;
    }
    task->observed = true;
    if (!layout.copy(destination, output, task->outcome, task->value)) {
      destination.fault(3);
      return false;
    }
    return true;
  }
  bool dispose(GroupHandle h) {
    auto *group = get(h);
    if (!group || !group->settled)
      return false;
    for (std::uint32_t i = 0; i < limits.records + limits.groups; ++i) {
      auto &task = tasks[i];
      if (task.state == State::Free || task.group != h)
        continue;
      if (task.valueInitialized)
        task.entry->result->destroy(task.value);
      if (task.entry)
        freeBytes(task.value, task.entry->result->bytes);
      task.outcome.settle();
      const auto generation = task.generation + 1;
      task.~Record();
      new (&task) Record;
      task.generation = generation;
      --stats.records;
    }
    const auto generation = group->generation + 1;
    *group = Group{};
    group->generation = generation;
    --stats.groups;
    return true;
  }
  void maintain() {
    bool changed;
    do {
      changed = false;
      for (std::uint32_t i = 0; i < limits.groups; ++i) {
        auto &group = groups[i];
        if (!group.used || !group.closed || group.settled || group.outstanding)
          continue;
        bool pendingNested = false;
        for (std::uint32_t j = 0; j < limits.groups; ++j)
          pendingNested |=
              groups[j].used && groups[j].parent == groupHandle(i) && !groups[j].settled;
        if (pendingNested)
          continue;
        if (group.failure.kind == TaskFailure::None)
          for (std::uint32_t j = 0; j < limits.records + limits.groups; ++j)
            if (tasks[j].state != State::Free && tasks[j].group == groupHandle(i) &&
                !tasks[j].observed) {
              group.failure = {TaskFailure::Fault, 3};
              break;
            }
        group.settled = true;
        changed = true;
      }
      for (std::uint32_t i = 0; i < limits.records; ++i) {
        auto &task = tasks[i];
        if (task.state == State::WaitingTask) {
          auto *dependency = get(task.dependency);
          if (dependency && dependency->state == State::Settled) {
            wake(i);
            changed = true;
          }
        } else if (task.state == State::WaitingGroup) {
          auto *dependency = get(task.groupDependency);
          if (dependency && dependency->settled) {
            wake(i);
            changed = true;
          }
        }
        if (task.state != State::Settling)
          continue;
        bool pending = false;
        for (std::uint32_t j = 0; j < limits.groups; ++j) {
          auto &nested = groups[j];
          if (!nested.used || nested.owner != handle(i))
            continue;
          if (!nested.closed) {
            if (task.failure.kind == TaskFailure::None)
              task.failure = {TaskFailure::Fault, 3};
            failGroup(groupHandle(j), {TaskFailure::Cancelled});
          }
          pending |= !nested.settled;
          if (nested.settled && !nested.observed && task.failure.kind == TaskFailure::None)
            task.failure = nested.failure.kind == TaskFailure::None ? Failure{TaskFailure::Fault, 3}
                                                                    : nested.failure;
        }
        if (pending)
          continue;
        if (task.failure.kind != TaskFailure::None) {
          if (task.valueInitialized) {
            task.entry->result->destroy(task.value);
            task.valueInitialized = false;
          }
          task.outcome.settle();
        }
        if (task.initialized) {
          task.entry->destroy(task.frame);
          task.initialized = false;
        }
        freeBytes(task.frame, task.entry->frameBytes);
        for (std::uint32_t j = 0; j < limits.groups; ++j)
          if (groups[j].used && groups[j].owner == handle(i))
            dispose(groupHandle(j));
        task.execution.settle();
        task.state = State::Settled;
        if (task.counted) {
          --get(task.group)->outstanding;
          --stats.unfinished;
          task.counted = false;
        }
        ++stats.publications;
        if (task.failure.kind != TaskFailure::None)
          failGroup(task.group, task.failure);
        changed = true;
      }
    } while (changed);
  }
  void finish(std::uint32_t slot, Failure failure) {
    auto &task = tasks[slot];
    task.failure = failure;
    task.state = State::Settling;
    if (failure.kind != TaskFailure::None) {
      failGroup(task.group, failure);
      for (std::uint32_t i = 0; i < limits.groups; ++i)
        if (groups[i].used && groups[i].owner == handle(slot))
          failGroup(groupHandle(i), {TaskFailure::Cancelled});
    }
  }
  bool step() {
    if (stepping)
      return false;
    maintain();
    for (std::uint32_t n = 0; n < limits.records; ++n) {
      auto i = (cursor + n) % limits.records;
      enqueue(i);
    }
    if (!queueCount)
      return false;
    const auto h = queue[queueHead];
    queueHead = (queueHead + 1) % limits.ready;
    --queueCount;
    auto *record = get(h);
    if (!record)
      return true;
    record->queued = false;
    cursor = (h.slot + 1) % limits.records;
    record->state = State::Running;
    stepping = true;
    if (record->cancel)
      finish(h.slot, {TaskFailure::Cancelled});
    else {
      Task task(*this, h.slot);
      ++stats.resumes;
      try {
        record->entry->resume(task);
      } catch (...) {
        record->execution.fault(3);
      }
      if (record->execution.status())
        finish(h.slot, invocationFailure(record->execution));
      else if (record->cancel && record->state != State::Settling)
        finish(h.slot, {TaskFailure::Cancelled});
      else if (record->state == State::Running)
        finish(h.slot, {TaskFailure::Fault, 3});
    }
    stepping = false;
    maintain();
    return true;
  }
};
std::unique_ptr<TaskCore> TaskCore::create(TaskLimits limits) noexcept {
  if (!limits.records || !limits.groups || !limits.ready || !limits.inFlight ||
      std::uint64_t(limits.records) + limits.groups >= UINT32_MAX || !limits.bytes)
    return {};
  try {
    return std::unique_ptr<TaskCore>(new TaskCore(std::make_unique<Impl>(limits)));
  } catch (...) {
    return {};
  }
}
TaskCore::TaskCore(std::unique_ptr<Impl> impl) noexcept : impl_(std::move(impl)) {}
TaskCore::~TaskCore() {
  for (std::uint32_t i = 0; i < impl_->limits.groups; ++i)
    if (impl_->groups[i].used)
      impl_->failGroup(impl_->groupHandle(i), {TaskFailure::Cancelled});
  while (impl_->step()) {
  }
  for (std::uint32_t i = 0; i < impl_->limits.groups; ++i)
    if (impl_->groups[i].used)
      impl_->dispose(impl_->groupHandle(i));
}
GroupHandle TaskCore::openRoot() noexcept { return impl_->open({}); }
TaskHandle TaskCore::submit(GroupHandle group, const TaskEntry &entry, Packet packet) noexcept {
  return impl_->submit(group, entry, packet, {});
}
bool TaskCore::close(GroupHandle group) noexcept { return impl_->close(group, {}); }
bool TaskCore::cancel(GroupHandle group, bool deadline) noexcept {
  if (!impl_->owned(group, {}))
    return false;
  impl_->failGroup(group, {deadline ? TaskFailure::DeadlineExceeded : TaskFailure::Cancelled});
  return true;
}
bool TaskCore::settled(GroupHandle h) const noexcept {
  auto *group = impl_->get(h);
  return group && group->settled;
}
Failure TaskCore::failure(GroupHandle h) const noexcept {
  auto *group = impl_->get(h);
  return group ? group->failure : Failure{TaskFailure::Fault, 3};
}
bool TaskCore::settled(TaskHandle h) const noexcept {
  auto *task = impl_->get(h);
  return task && task->state == State::Settled;
}
Failure TaskCore::failure(TaskHandle h) const noexcept {
  auto *task = impl_->get(h);
  return task ? task->failure : Failure{TaskFailure::Fault, 3};
}
bool TaskCore::observe(TaskHandle h, const ValueLayout &layout, Invocation &context,
                       void *output) noexcept {
  return impl_->read(h, layout, context, output, {});
}
bool TaskCore::release(GroupHandle group) noexcept {
  return impl_->owned(group, {}) && impl_->dispose(group);
}
bool TaskCore::step() noexcept { return impl_->step(); }
bool TaskCore::drain(std::size_t steps) noexcept {
  while (steps-- && impl_->step()) {
  }
  return !impl_->stats.unfinished;
}
TaskStats TaskCore::stats() const noexcept {
  auto stats = impl_->stats;
  for (std::uint32_t i = 0; i < impl_->limits.records + impl_->limits.groups; ++i)
    stats.retainedOwners += impl_->tasks[i].execution.live() + impl_->tasks[i].outcome.live();
  return stats;
}
void TaskCore::failAllocationAt(std::uint64_t attempt) noexcept {
  impl_->attempts = 0;
  impl_->failAt = attempt;
}
Invocation &Task::context() noexcept { return core_.tasks[slot_].execution; }
void *Task::frame() noexcept { return core_.tasks[slot_].frame; }
GroupHandle Task::openGroup(GroupHandle parent) noexcept {
  return core_.open(core_.handle(slot_), parent);
}
TaskHandle Task::spawn(GroupHandle group, const TaskEntry &entry, Packet packet) noexcept {
  return core_.submit(group, entry, packet, core_.handle(slot_));
}
bool Task::await(TaskHandle h) noexcept {
  if (core_.tasks[slot_].state != State::Running) {
    context().fault(3);
    return false;
  }
  auto *dependency = core_.get(h);
  if (!dependency || !core_.owned(dependency->group, core_.handle(slot_))) {
    context().fault(3);
    return false;
  }
  if (dependency->state == State::Settled) {
    dependency->observed = true;
    return true;
  }
  auto &task = core_.tasks[slot_];
  task.dependency = h;
  task.state = State::WaitingTask;
  return false;
}
bool Task::join(GroupHandle h) noexcept {
  if (core_.tasks[slot_].state != State::Running) {
    context().fault(3);
    return false;
  }
  auto *group = core_.get(h);
  if (!group || group->owner != core_.handle(slot_) || !group->closed) {
    context().fault(3);
    return false;
  }
  if (group->settled) {
    group->observed = true;
    return true;
  }
  auto &task = core_.tasks[slot_];
  task.groupDependency = h;
  task.state = State::WaitingGroup;
  return false;
}
bool Task::read(TaskHandle h, const ValueLayout &layout, void *output) noexcept {
  return core_.read(h, layout, context(), output, core_.handle(slot_));
}
Failure Task::failure(GroupHandle h) const noexcept {
  auto *group = core_.get(h);
  return group && group->owner == core_.handle(slot_) ? group->failure
                                                      : Failure{TaskFailure::Fault, 3};
}
Failure Task::failure(TaskHandle h) const noexcept {
  auto *task = core_.get(h);
  return task && core_.owned(task->group, core_.handle(slot_)) ? task->failure
                                                               : Failure{TaskFailure::Fault, 3};
}
bool Task::close(GroupHandle group) noexcept { return core_.close(group, core_.handle(slot_)); }
bool Task::cancel(GroupHandle group, bool deadline) noexcept {
  if (!core_.owned(group, core_.handle(slot_)))
    return false;
  core_.failGroup(group, {deadline ? TaskFailure::DeadlineExceeded : TaskFailure::Cancelled});
  return true;
}
bool Task::failGroup(GroupHandle group, Failure failure) noexcept {
  if (!core_.owned(group, core_.handle(slot_)) || failure.kind == TaskFailure::None)
    return false;
  core_.failGroup(group, failure);
  return true;
}
bool Task::cancelled() const noexcept { return core_.tasks[slot_].cancel; }
void Task::yield() noexcept {
  if (core_.tasks[slot_].state != State::Running)
    context().fault(3);
  else
    core_.tasks[slot_].state = State::Runnable;
}
void Task::complete(const void *value) noexcept {
  auto &task = core_.tasks[slot_];
  if (context().status() || task.state != State::Running) {
    context().fault(3);
    core_.finish(slot_, invocationFailure(context()));
    return;
  }
  if (task.cancel) {
    core_.finish(slot_, {TaskFailure::Cancelled});
    return;
  }
  const auto &layout = *task.entry->result;
  if (!aligned(value, layout.alignment) ||
      !layout.copy(task.outcome, task.value, context(), value)) {
    task.execution.fault(task.outcome.status() ? task.outcome.status() : 3);
    core_.finish(slot_, invocationFailure(task.execution));
    return;
  }
  task.valueInitialized = true;
  core_.finish(slot_, {});
}
void Task::fault(std::int64_t code, std::int64_t line, std::int64_t column) noexcept {
  context().fault(code, line, column);
  core_.finish(slot_, invocationFailure(context()));
}
} // namespace kalandra::runtime
