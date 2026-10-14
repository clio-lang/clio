import {
  copySchema,
  validateArguments,
  type TaskSchema,
  type ReplyFrame,
} from "../../protocol/src/index.js";
import {
  defaultValueLimits,
  snapshotValue,
  type TaskValue,
  type ValueLimits,
} from "./values.js";
export {
  snapshotValue,
  defaultValueLimits,
  type TaskValue,
  type ValueLimits,
} from "./values.js";

export interface RuntimeOptions {
  /** Parent-host routing for checked remote children. Never sent to workers. */
  readonly dispatchRemote?: (
    task: ModuleTask,
    signal: CancellationSignal,
  ) => Promise<unknown>;
  readonly maxWorkers: number;
  readonly maxQueuedTasks: number;
  readonly valueLimits?: Partial<ValueLimits>;
  /** Maximum child depth beneath a root task. Defaults to 32. */
  readonly maxTaskDepth?: number;
  /** Maximum outstanding descendants across the pool. Defaults to 256. */
  readonly maxNestedTasks?: number;
}
export interface ModuleTask {
  readonly module: string;
  readonly exportName: string;
  readonly args: readonly TaskValue[];
  /** Compiler-generated schema; required by managed compiled programs. */
  readonly schema?: TaskSchema;
}
export interface CancellationSignal {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: () => void): void;
}
export interface TaskOptions {
  readonly signal?: CancellationSignal;
  readonly timeoutMs?: number;
}
export interface WorkerRequest {
  readonly kind: "call";
  readonly id: number;
  readonly task: ModuleTask;
  readonly limits: ValueLimits;
}
export interface WorkerEndpoint {
  subscribe(
    onMessage: (message: unknown) => void,
    onFailure: (error: unknown) => void,
  ): () => void;
  send(request: WorkerRequest): void;
  /** Settle a worker-originated child submission, using its worker-local request ID. */
  reply?(reply: ReplyFrame): void;
  terminate(): Promise<void>;
}
export interface RuntimeHost {
  createWorker(): WorkerEndpoint;
  schedule(callback: () => void, milliseconds: number): () => void;
}
export type RuntimeErrorCode =
  | "REMOTE_CLEANUP_FAILED"
  | "NESTING_LIMIT"
  | "QUEUE_FULL"
  | "POOL_CLOSED"
  | "TASK_CANCELLED"
  | "TASK_TIMEOUT"
  | "TASK_FAILED"
  | "WORKER_FAILED"
  | "INVALID_TASK";
export class RuntimeError extends Error {
  constructor(
    readonly code: RuntimeErrorCode,
    message: string,
    readonly remoteName?: string,
    readonly remoteStack?: string,
  ) {
    super(message);
    this.name = "RuntimeError";
  }
}
class TaskCancellation {
  private readonly listeners = new Set<() => void>();
  readonly signal: CancellationSignal & { aborted: boolean } = {
    aborted: false,
    addEventListener: (_type, listener) => {
      this.listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      this.listeners.delete(listener);
    },
  };
  abort() {
    if (this.signal.aborted) return;
    this.signal.aborted = true;
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}
interface Pending {
  id: number;
  task: ModuleTask;
  resolve: (value: TaskValue) => void;
  reject: (error: RuntimeError) => void;
  cleanups: (() => void)[];
  slot: Slot | null;
  done: boolean;
  parent: Pending | null;
  depth: number;
  remoteController?: TaskCancellation;
  remoteJobs?: Set<Promise<void>>;
  remoteCleanupError?: RuntimeError;
}
interface Slot {
  endpoint: WorkerEndpoint;
  tasks: Set<Pending>;
  retiring: boolean;
  unsubscribe: () => void;
}

/** Centrally admitted task trees; descendants may cooperate on an occupied worker. No retries. */
export class WorkerPool {
  private readonly slots = new Set<Slot>();
  private readonly queue: Pending[] = [];
  private readonly pending = new Map<number, Pending>();
  private readonly terminations = new Set<Promise<void>>();
  private readonly cleanupErrors: unknown[] = [];
  private readonly remoteRuns = new Set<Promise<void>>();
  private readonly limits: ValueLimits;
  private nextId = 1;
  private closed = false;
  private pumping = false;
  private closing: Promise<void> | undefined;
  readonly options: RuntimeOptions;
  constructor(
    private readonly host: RuntimeHost,
    options: RuntimeOptions,
  ) {
    if (
      !Number.isSafeInteger(options.maxWorkers) ||
      options.maxWorkers < 1 ||
      !Number.isSafeInteger(options.maxQueuedTasks) ||
      options.maxQueuedTasks < 0
    )
      throw new RangeError(
        "Worker and queue limits must be nonnegative integers, with at least one worker",
      );
    for (const value of [
      options.maxTaskDepth ?? 32,
      options.maxNestedTasks ?? 256,
    ])
      if (!Number.isSafeInteger(value) || value < 0)
        throw new RangeError("Nesting limits must be nonnegative integers");
    this.limits = Object.freeze({
      ...defaultValueLimits,
      ...options.valueLimits,
    });
    this.options = Object.freeze({ ...options, valueLimits: this.limits });
    for (const value of Object.values(this.limits))
      if (!Number.isSafeInteger(value) || value < 1)
        throw new RangeError("Value limits must be positive integers");
  }
  get stats() {
    return {
      workers: this.slots.size,
      running: [...this.slots].filter((slot) => slot.tasks.size > 0).length,
      queued: this.queue.length,
      stopping: [...this.slots].filter((slot) => slot.retiring).length,
      closed: this.closed,
    };
  }
  run(task: ModuleTask, options: TaskOptions = {}): Promise<TaskValue> {
    return this.enqueue(task, options, null);
  }
  private enqueue(
    task: ModuleTask,
    options: TaskOptions,
    parent: Pending | null,
  ): Promise<TaskValue> {
    if (this.closed)
      return Promise.reject(
        new RuntimeError("POOL_CLOSED", "Worker pool is closed"),
      );
    if (options.signal?.aborted)
      return Promise.reject(
        new RuntimeError("TASK_CANCELLED", "Task was cancelled"),
      );
    if (
      options.timeoutMs !== undefined &&
      (!Number.isSafeInteger(options.timeoutMs) ||
        options.timeoutMs < 1 ||
        options.timeoutMs > 2_147_483_647)
    )
      return Promise.reject(
        new RuntimeError(
          "INVALID_TASK",
          "timeoutMs must be a positive 32-bit integer",
        ),
      );
    if (
      parent &&
      (parent.depth >= (this.options.maxTaskDepth ?? 32) ||
        [...this.pending.values()].filter(
          (task) => task.parent && !task.remoteController,
        ).length +
          this.remoteRuns.size >=
          (this.options.maxNestedTasks ?? 256))
    )
      return Promise.reject(
        new RuntimeError(
          "NESTING_LIMIT",
          "Nested task depth or outstanding task limit exceeded",
        ),
      );
    const remote = !!parent && task.module?.startsWith("kalandra-remote:");
    if (remote && !this.options.dispatchRemote)
      return Promise.reject(
        new RuntimeError(
          "INVALID_TASK",
          "Remote child tasks require host endpoint bindings",
        ),
      );
    const available =
      remote ||
      [...this.slots].some((slot) => !slot.retiring && !slot.tasks.size) ||
      this.slots.size < this.options.maxWorkers ||
      !!(parent?.slot && !parent.slot.retiring);
    if (!available && this.queue.length >= this.options.maxQueuedTasks)
      return Promise.reject(
        new RuntimeError("QUEUE_FULL", "Worker task queue is full"),
      );
    let snapshot: ModuleTask;
    try {
      if (
        typeof task.module !== "string" ||
        !task.module ||
        typeof task.exportName !== "string" ||
        !task.exportName ||
        !Array.isArray(task.args)
      )
        throw new TypeError(
          "A module, export name, and argument array are required",
        );
      snapshot = {
        module: task.module,
        exportName: task.exportName,
        args: snapshotValue(task.args, this.limits) as TaskValue[],
        ...(task.schema
          ? {
              schema: copySchema(
                snapshotValue(task.schema, {
                  maxDataBytes: 128 * 1024,
                  maxDepth: 128,
                  maxNodes: 8192,
                }) as unknown as TaskSchema,
              ),
            }
          : {}),
      };
      if (snapshot.schema)
        validateArguments(snapshot.schema, snapshot.args, this.limits);
    } catch (error) {
      return Promise.reject(new RuntimeError("INVALID_TASK", String(error)));
    }
    return new Promise((resolve, reject) => {
      const pending: Pending = {
        id: this.nextId++,
        task: snapshot,
        resolve,
        reject,
        cleanups: [],
        slot: null,
        done: false,
        parent,
        depth: parent ? parent.depth + 1 : 0,
      };
      this.pending.set(pending.id, pending);
      if (!remote) this.queue.push(pending);
      const cancel = (code: "TASK_CANCELLED" | "TASK_TIMEOUT") => {
        if (pending.done) return;
        this.failTree(
          pending,
          new RuntimeError(
            code,
            code === "TASK_TIMEOUT"
              ? "Task deadline exceeded"
              : "Task was cancelled",
          ),
        );
        this.pump();
      };
      try {
        if (options.signal) {
          const signal = options.signal,
            listener = () => cancel("TASK_CANCELLED");
          signal.addEventListener("abort", listener, { once: true });
          pending.cleanups.push(() =>
            signal.removeEventListener("abort", listener),
          );
          if (signal.aborted) listener();
        }
        if (!pending.done && options.timeoutMs !== undefined)
          pending.cleanups.push(
            this.host.schedule(() => cancel("TASK_TIMEOUT"), options.timeoutMs),
          );
      } catch (error) {
        this.finish(pending, new RuntimeError("WORKER_FAILED", String(error)));
      }
      if (remote && !pending.done) this.startRemote(pending);
      this.pump();
    });
  }
  private startRemote(task: Pending) {
    const root = this.root(task);
    const controller = new TaskCancellation();
    task.remoteController = controller;
    const jobs = (root.remoteJobs ??= new Set());
    const job = Promise.resolve()
      .then(async () => {
        if (controller.signal.aborted)
          throw new RuntimeError("TASK_CANCELLED", "Task was cancelled");
        const result = await this.options.dispatchRemote!(
          task.task,
          controller.signal,
        );
        const value = snapshotValue(result, this.limits);
        if (!task.task.schema)
          throw new Error("Remote children require a schema");
        validateArguments(
          { args: [task.task.schema.result], result: "void" },
          [value],
          this.limits,
        );
        this.finish(task, undefined, value);
      })
      .catch((error) => {
        const failure =
          error instanceof RuntimeError
            ? error
            : new RuntimeError(
                error &&
                  typeof error === "object" &&
                  "code" in error &&
                  error.code === "REMOTE_CLEANUP_FAILED"
                  ? "REMOTE_CLEANUP_FAILED"
                  : "TASK_FAILED",
                String(error),
              );
        if (failure.code === "REMOTE_CLEANUP_FAILED") {
          root.remoteCleanupError = failure;
          this.cleanupErrors.push(failure);
          this.closed = true;
          for (const pending of this.pending.values())
            pending.remoteController?.abort();
          for (const pending of [...this.pending.values()])
            this.finish(pending, failure);
          for (const slot of this.slots) this.retire(slot);
        }
        if (!task.done) this.failTree(task, failure);
      })
      .finally(() => {
        jobs.delete(job);
        this.remoteRuns.delete(job);
        this.pump();
      });
    jobs.add(job);
    this.remoteRuns.add(job);
  }
  private finish(task: Pending, error?: RuntimeError, value?: TaskValue) {
    if (task.done) return;
    task.done = true;
    const index = this.queue.indexOf(task);
    if (index >= 0) this.queue.splice(index, 1);
    this.pending.delete(task.id);
    task.slot?.tasks.delete(task);
    for (const cleanup of task.cleanups) cleanup();
    task.cleanups.length = 0;
    if (error && !task.parent && task.remoteJobs?.size) {
      void Promise.all([...task.remoteJobs]).then(() =>
        task.reject(task.remoteCleanupError ?? error),
      );
    } else if (error) task.reject(error);
    else task.resolve(value);
  }
  private retire(slot: Slot) {
    if (slot.retiring) return;
    slot.retiring = true;
    slot.unsubscribe();
    // Retiring workers still count toward maxWorkers until termination completes.
    let stopped = false;
    const termination = Promise.resolve()
      .then(() => slot.endpoint.terminate())
      .then(() => {
        stopped = true;
      })
      .catch((error) => {
        this.cleanupErrors.push(error);
        // A failed termination may leave a live worker: stop the pool, never exceed the bound.
        this.closed = true;
        for (const task of this.pending.values())
          task.remoteController?.abort();
        for (const task of [...this.pending.values()])
          this.finish(
            task,
            new RuntimeError("WORKER_FAILED", "Worker termination failed"),
          );
        for (const other of this.slots) if (other !== slot) this.retire(other);
      })
      .then(() => {
        if (stopped) this.slots.delete(slot);
        this.terminations.delete(termination);
        this.pump();
      });
    this.terminations.add(termination);
  }
  private root(task: Pending): Pending {
    while (task.parent) task = task.parent;
    return task;
  }
  private failTree(task: Pending, error: RuntimeError) {
    const root = this.root(task);
    const slots = new Set<Slot>();
    for (const pending of this.pending.values())
      if (this.root(pending) === root) pending.remoteController?.abort();
    for (const pending of [...this.pending.values()]) {
      if (this.root(pending) !== root) continue;
      if (pending.slot) slots.add(pending.slot);
      this.finish(pending, error);
    }
    for (const slot of slots) this.retire(slot);
  }
  private failure(slot: Slot, error: unknown) {
    if (slot.retiring) return;
    for (const task of [...slot.tasks])
      this.failTree(task, new RuntimeError("WORKER_FAILED", String(error)));
    this.retire(slot);
  }
  private spawn(
    slot: Slot,
    parent: Pending,
    message: { requestId?: unknown; task?: unknown },
  ) {
    if (
      !slot.endpoint.reply ||
      !parent.task.schema ||
      !Number.isSafeInteger(message.requestId) ||
      (message.requestId as number) < 1 ||
      !message.task ||
      typeof message.task !== "object" ||
      !("schema" in message.task) ||
      !message.task.schema
    ) {
      this.failure(slot, "Invalid child task submission");
      return;
    }
    const requestId = message.requestId as number;
    void this.enqueue(message.task as ModuleTask, {}, parent).then(
      (value) => {
        if (parent.done || slot.retiring) return;
        try {
          slot.endpoint.reply!({ kind: "result", id: requestId, value });
        } catch (error) {
          this.failure(slot, error);
        }
      },
      (error) => {
        if (!parent.done)
          this.failTree(
            parent,
            error instanceof RuntimeError
              ? error
              : new RuntimeError("TASK_FAILED", String(error)),
          );
        this.pump();
      },
    );
  }
  private message(slot: Slot, message: unknown) {
    if (slot.retiring) return;
    const task =
      message && typeof message === "object" && "id" in message
        ? this.pending.get(message.id as number)
        : undefined;
    if (
      !task ||
      task.slot !== slot ||
      !message ||
      typeof message !== "object" ||
      !("id" in message) ||
      message.id !== task.id ||
      !("kind" in message)
    ) {
      this.failure(slot, "Invalid worker response");
      return;
    }
    if (message.kind === "spawn") {
      this.spawn(
        slot,
        task,
        message as { requestId?: unknown; task?: unknown },
      );
      return;
    }
    if (message.kind === "result" && "value" in message) {
      if ([...this.pending.values()].some((child) => child.parent === task)) {
        this.failure(slot, "Task completed before its children");
        return;
      }
      try {
        const value = snapshotValue(message.value, this.limits);
        this.finish(task, undefined, value);
      } catch (error) {
        this.failure(slot, error);
        return;
      }
    } else if (
      message.kind === "failure" &&
      "error" in message &&
      message.error &&
      typeof message.error === "object" &&
      "message" in message.error &&
      typeof message.error.message === "string"
    ) {
      const error = message.error;
      const failure = new RuntimeError(
        "TASK_FAILED",
        error.message as string,
        "name" in error && typeof error.name === "string"
          ? error.name
          : undefined,
        "stack" in error && typeof error.stack === "string"
          ? error.stack
          : undefined,
      );
      if (
        task.parent ||
        [...this.pending.values()].some((child) => child.parent === task)
      )
        this.failTree(task, failure);
      else this.finish(task, failure);
    } else {
      this.failure(slot, "Invalid worker response");
      return;
    }
    this.pump();
  }
  private pump() {
    if (this.pumping || this.closed) return;
    this.pumping = true;
    try {
      while (this.queue.length) {
        let slot = [...this.slots].find(
          (item) => !item.retiring && !item.tasks.size,
        );
        const capacity = !!slot || this.slots.size < this.options.maxWorkers;
        const index = capacity
          ? 0
          : this.queue.findIndex(
              (task) => task.parent?.slot && !task.parent.slot.retiring,
            );
        if (index < 0) return;
        const task = this.queue[index]!;
        if (!capacity) slot = task.parent!.slot!;
        if (!slot) {
          try {
            slot = {
              endpoint: this.host.createWorker(),
              tasks: new Set(),
              retiring: false,
              unsubscribe: () => {},
            };
            this.slots.add(slot);
            const current = slot;
            slot.unsubscribe = slot.endpoint.subscribe(
              (message) => this.message(current, message),
              (error) => this.failure(current, error),
            );
          } catch (error) {
            if (slot) this.retire(slot);
            this.finish(
              this.queue[0]!,
              new RuntimeError("WORKER_FAILED", String(error)),
            );
            continue;
          }
        }
        if (slot.retiring) continue;
        this.queue.splice(this.queue.indexOf(task), 1);
        task.slot = slot;
        slot.tasks.add(task);
        try {
          slot.endpoint.send({
            kind: "call",
            id: task.id,
            task: task.task,
            limits: this.limits,
          });
        } catch (error) {
          this.failure(slot, error);
        }
      }
    } finally {
      this.pumping = false;
    }
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    for (const task of this.pending.values()) task.remoteController?.abort();
    for (const task of [...this.pending.values()])
      this.finish(
        task,
        new RuntimeError("POOL_CLOSED", "Worker pool was closed"),
      );
    for (const slot of this.slots) this.retire(slot);
    this.closing = Promise.all([...this.terminations, ...this.remoteRuns]).then(
      () => {
        if (this.cleanupErrors.length)
          throw new AggregateError(
            this.cleanupErrors,
            "Some workers could not be terminated",
          );
      },
    );
    return this.closing;
  }
}
