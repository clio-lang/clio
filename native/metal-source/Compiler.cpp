#include "Build.h"
#include "kalandra/Semantics.h"
#include "mlir/IR/BuiltinOps.h"
#include "mlir/IR/Verifier.h"
#include "mlir/InitAllDialects.h"
#include "mlir/Parser/Parser.h"
#include "llvm/ADT/APFloat.h"
#include "llvm/Support/Error.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/FileUtilities.h"
#include "llvm/Support/raw_ostream.h"
#include <charconv>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <unordered_map>
using namespace kalandra;
namespace {
struct Rejected {
  Diagnostic diagnostic;
};
struct Value {
  enum Kind { Tensor, Target, Task } kind;
  std::size_t slot = 0;
  bool gpu = false;
  std::uint32_t device = 0;
  std::size_t length = 0;
};
class Compiler {
  Module syntax;
  TypedModule scalar;
  std::map<std::string, std::size_t> functions;
  std::unordered_map<std::string, Value> locals;
  std::set<std::size_t> observed, tasks;
  std::map<std::size_t, std::size_t> entries;
  std::vector<std::string> steps, fields;
  std::size_t next = 0, depth = 0;
  struct Depth {
    std::size_t &value;
    explicit Depth(std::size_t &v) : value(v) { ++value; }
    ~Depth() { --value; }
  };
  [[noreturn]] void reject(SourceSpan span, std::string message) const {
    throw Rejected{{"G001", std::move(message), span}};
  }
  std::string text(SourceSpan span) const { return std::string(syntax.source->slice(span)); }
  const Expr &node(ExprId id) const { return syntax.expressions.at(id); }
  std::string named(ExprId id) const {
    if (const auto *n = std::get_if<NameExpr>(&node(id).value))
      return text(n->name);
    reject(node(id).span, "a statically named function is required");
  }
  std::string field(std::string type) {
    if (next >= 20000)
      reject({}, "Metal continuation value limit exceeded");
    auto name = "v" + std::to_string(next++);
    fields.push_back(type + " " + name + "{};");
    return name;
  }
  static std::string ref(const Value &v) { return "f.v" + std::to_string(v.slot); }
  std::string error(std::string expr) const {
    return "task.fault(std::int64_t(" + expr + ")); return;";
  }
  std::string check(std::string expr) const {
    return "if (!(" + expr + ")) { " + error("m::Error::Invalid") + " }\n";
  }
  std::string device(const Value &target) const {
    return "r.device(" + std::to_string(target.device) + ")";
  }
  std::optional<std::uint64_t> tensorType(const TypeSyntax &t, bool dynamicOnly = false) const {
    if (!t.tensor || !t.element || text(*t.element) != "float32" || t.dimensions.size() != 1 ||
        (dynamicOnly && t.dimensions[0].extent))
      reject(t.span, dynamicOnly
                         ? "GPU kernel parameters/results currently require Tensor[float32, ?]"
                         : "the Metal source slice requires a rank-one float32 tensor");
    return t.dimensions[0].extent;
  }
  std::uint32_t bits(ExprId id) const {
    bool negative = false;
    if (const auto *u = std::get_if<UnaryExpr>(&node(id).value)) {
      if (u->operation != TokenKind::Minus && u->operation != TokenKind::Plus)
        reject(node(id).span, "unsupported tensor literal");
      negative = u->operation == TokenKind::Minus;
      id = u->operand;
    }
    const auto *literal = std::get_if<NumberExpr>(&node(id).value);
    if (!literal || text(literal->literal).size() > 4096)
      reject(node(id).span, "tensor literals require finite float32 numbers");
    llvm::APFloat value(llvm::APFloat::IEEEsingle());
    auto status =
        value.convertFromString(text(literal->literal), llvm::APFloat::rmNearestTiesToEven);
    if (!status) {
      llvm::consumeError(status.takeError());
      reject(node(id).span, "invalid float32 literal");
    }
    if ((*status & llvm::APFloat::opOverflow) || !value.isFinite())
      reject(node(id).span, "float32 literal overflow");
    if (negative)
      value.changeSign();
    return std::uint32_t(value.bitcastToAPInt().getZExtValue());
  }
  Value expression(ExprId id, const TypeSyntax *annotation = nullptr) {
    if (depth >= 128)
      reject(node(id).span, "Metal source expression depth exceeded");
    Depth guard(depth);
    const auto span = node(id).span;
    if (const auto *n = std::get_if<NameExpr>(&node(id).value)) {
      auto found = locals.find(text(n->name));
      if (found == locals.end())
        reject(span, "unknown value '" + text(n->name) + "'");
      return found->second;
    }
    if (const auto *call = std::get_if<CallExpr>(&node(id).value)) {
      auto name = named(call->callee);
      if (locals.contains(name))
        reject(span, "local values are not callable");
      if (name == "devices.cpu" || name == "devices.gpu") {
        if (locals.contains("devices"))
          reject(span, "devices is shadowed by a local binding");
        Value result{Value::Target};
        result.gpu = name == "devices.gpu";
        if ((!result.gpu && !call->arguments.empty()) || call->arguments.size() > 1)
          reject(span, "invalid device selector argument count");
        if (!call->arguments.empty()) {
          const auto *n = std::get_if<NumberExpr>(&node(call->arguments[0]).value);
          if (!n)
            reject(span, "this slice requires a constant uint32 GPU index");
          auto input = text(n->literal);
          auto parsed = std::from_chars(input.data(), input.data() + input.size(), result.device);
          if (parsed.ec != std::errc{} || parsed.ptr != input.data() + input.size())
            reject(span, "invalid GPU index");
        }
        return result;
      }
      if (name == "tensor") {
        if (!annotation)
          reject(span, "host tensor literals require Tensor[float32, ...] context");
        auto extent = tensorType(*annotation);
        if (call->arguments.size() != 1)
          reject(span, "tensor requires one flat literal");
        const auto *array = std::get_if<ArrayExpr>(&node(call->arguments[0]).value);
        if (!array || array->elements.size() > 200000)
          reject(span, "expected a bounded flat tensor literal");
        if (extent && *extent != array->elements.size())
          reject(span, "tensor literal shape mismatch");
        auto out = field("m::Buffer");
        Value value{Value::Tensor, next - 1, false, 0, array->elements.size()};
        std::string data = "{ ";
        for (auto item : array->elements)
          data += std::to_string(bits(item)) + "u,";
        data += " }";
        steps.push_back("static const std::array<std::uint32_t," + std::to_string(value.length) +
                        "> data = " + data +
                        ";\n"
                        "const std::int64_t length = " +
                        std::to_string(value.length) +
                        ";\n"
                        "auto value = r.hostTensor(std::as_bytes(std::span(data)), {&length,1}, "
                        "m::Format::Float32);\n"
                        "if (!value) { " +
                        error("value.error()") + " }\nf." + out + " = *value;\n");
        return value;
      }
      if (name == "transfer") {
        if (call->arguments.size() != 2)
          reject(span, "transfer requires a tensor and target");
        auto input = expression(call->arguments[0]);
        auto target = expression(call->arguments[1]);
        if (input.kind != Value::Tensor || target.kind != Value::Target)
          reject(span, "transfer requires a completed tensor and device target");
        if (target.gpu && input.gpu && input.device != target.device)
          reject(span, "cross-device transfers are not implemented");
        auto out = field("TaskHandle");
        Value result{Value::Task, next - 1, target.gpu, target.device, input.length};
        std::string step;
        if (target.gpu)
          step = "auto target = " + device(target) + ";\nif (!target) { " +
                 error("target.error()") + " }\nf." + out + " = r.upload(task, f.group, " +
                 ref(input) + ", *target);\n";
        else
          step = "f." + out + " = r.download(task, f.group, " + ref(input) + ");\n";
        steps.push_back(step + check("f." + out));
        tasks.insert(result.slot);
        return result;
      }
      reject(span, "unsupported host call in the first Metal source slice");
    }
    if (const auto *task = std::get_if<TaskExpr>(&node(id).value)) {
      if (task->prefix == TaskPrefix::Try) {
        const auto *wait = std::get_if<TaskExpr>(&node(task->operand).value);
        if (!wait || wait->prefix != TaskPrefix::Await)
          reject(span, "this slice supports try await for task observation");
        auto input = expression(wait->operand);
        if (input.kind != Value::Task)
          reject(span, "await requires an owned task");
        auto out = field("m::Buffer");
        auto value = input;
        value.kind = Value::Tensor;
        value.slot = next - 1;
        observed.insert(input.slot);
        steps.push_back("if (!task.await(" + ref(input) +
                        ")) return;\n"
                        "if (!readBuffer(task, " +
                        ref(input) + ", f." + out + ")) return;\n");
        return value;
      }
      if (task->prefix == TaskPrefix::Spawn) {
        if (!task->placement)
          reject(span, "GPU source calls require an explicit on target clause");
        const auto *call = std::get_if<CallExpr>(&node(task->operand).value);
        if (!call)
          reject(span, "spawn requires a named function call");
        auto name = named(call->callee);
        auto found = functions.find(name);
        if (found == functions.end() || locals.contains(name) || name == "main")
          reject(span, "unknown or shadowed GPU function");
        if (call->arguments.size() != 2)
          reject(span, "the first GPU entry ABI requires two tensor arguments");
        auto left = expression(call->arguments[0]);
        auto right = expression(call->arguments[1]);
        auto target = expression(*task->placement);
        if (target.kind != Value::Target || !target.gpu)
          reject(span, "the Metal source path requires a GPU target");
        if (left.kind != Value::Tensor || right.kind != Value::Tensor || !left.gpu || !right.gpu ||
            left.device != target.device || right.device != target.device)
          reject(span, "GPU arguments must be explicitly transferred to the selected device");
        if (left.length != right.length)
          reject(span, "elementwise argument shapes differ");
        auto [entry, inserted] = entries.emplace(found->second, entries.size());
        (void)inserted;
        auto kernel = field("m::Kernel"), out = field("TaskHandle");
        Value result{Value::Task, next - 1, true, target.device, left.length};
        steps.push_back("auto target = " + device(target) + ";\nif (!target) { " +
                        error("target.error()") +
                        " }\n"
                        "auto kernel = r.loadElementwiseKernel(f.directory + \"/kernel" +
                        std::to_string(entry->second) +
                        ".metallib\", *target);\n"
                        "if (!kernel) { " +
                        error("kernel.error()") + " }\nf." + kernel +
                        " = *kernel;\n"
                        "f." +
                        out + " = r.elementwise(task, f.group, f." + kernel + ", " + ref(left) +
                        ", " + ref(right) + ");\n" + check("f." + out));
        tasks.insert(result.slot);
        return result;
      }
      reject(span, "task results must be observed with try await");
    }
    reject(span, "unsupported expression in the Metal source supervisor");
  }
  void validateKernelShapes(const Function &fn) const {
    std::map<std::string, bool> values;
    for (const auto &p : fn.parameters)
      values.emplace(text(p.name), true);
    std::size_t nesting = 0;
    std::function<bool(ExprId)> infer = [&](ExprId id) -> bool {
      if (nesting >= 128)
        reject(node(id).span, "GPU shape analysis depth exceeded");
      Depth guard(nesting);
      const auto &expr = node(id);
      if (auto *name = std::get_if<NameExpr>(&expr.value)) {
        auto found = values.find(text(name->name));
        if (found == values.end())
          reject(expr.span, "unknown GPU value");
        return found->second;
      }
      if (std::holds_alternative<NumberExpr>(expr.value))
        return false;
      if (auto *unary = std::get_if<UnaryExpr>(&expr.value))
        return infer(unary->operand);
      if (auto *binary = std::get_if<BinaryExpr>(&expr.value)) {
        if (binary->operation != TokenKind::Plus && binary->operation != TokenKind::Star)
          reject(expr.span, "GPU strict arithmetic currently supports only + and *");
        bool left = infer(binary->left), right = infer(binary->right);
        return left || right;
      }
      if (auto *call = std::get_if<CallExpr>(&expr.value)) {
        auto name = named(call->callee);
        if (values.contains(name) || !functions.contains(name) || call->arguments.size() != 2)
          reject(expr.span, "GPU calls require a statically known two-tensor helper");
        for (auto arg : call->arguments)
          if (!infer(arg))
            reject(node(arg).span, "a tensor parameter cannot receive a scalar; scalar lifting "
                                   "applies to arithmetic only");
        return true;
      }
      reject(expr.span, "unsupported operation in GPU function");
    };
    bool result = false;
    for (const auto &statement : fn.body) {
      result = infer(statement.expression);
      if (statement.annotation) {
        tensorType(*statement.annotation, true);
        if (!result)
          reject(statement.span, "tensor binding cannot receive a scalar");
      }
      if (statement.binding && !values.emplace(text(*statement.binding), result).second)
        reject(*statement.binding, "duplicate immutable binding");
    }
    if (!result)
      reject(fn.span, "GPU tensor function must return a tensor");
  }
  std::string shader(std::size_t function) const {
    // Emit scalar typed SSA once per lane. Source names never become IR identifiers.
    std::ostringstream code;
    std::size_t counter = 0, callDepth = 0;
    std::set<std::size_t> active;
    std::unordered_map<std::string, unsigned> dependencies{{"%x", 1}, {"%y", 2}};
    auto temporary = [&] {
      if (counter >= 100000)
        reject({}, "GPU IR expansion limit exceeded");
      return "%v" + std::to_string(counter++);
    };
    std::function<std::string(std::size_t, const std::vector<std::string> &)> invoke;
    invoke = [&](std::size_t fnId, const std::vector<std::string> &args) -> std::string {
      const auto &fn = scalar.functions.at(fnId);
      if (callDepth >= 128 || !active.insert(fnId).second)
        reject(fn.declaration, "recursive GPU helper calls are not implemented");
      Depth guard(callDepth);
      std::unordered_map<SymbolId, std::string> symbols;
      std::unordered_map<ValueId, std::string> values;
      for (std::size_t i = 0; i < args.size(); ++i)
        symbols[fn.parameters.at(i)] = args[i];
      std::function<std::string(ValueId)> emit = [&](ValueId id) -> std::string {
        if (auto found = values.find(id); found != values.end())
          return found->second;
        const auto &n = scalar.expressions.at(id);
        std::string result;
        if (auto *read = std::get_if<SymbolRead>(&n.operation))
          result = symbols.at(read->symbol);
        else if (auto *literal = std::get_if<Float32Literal>(&n.operation)) {
          auto integer = temporary();
          result = temporary();
          code << "        " << integer << " = arith.constant " << std::int32_t(literal->bits)
               << " : i32\n";
          code << "        " << result << " = arith.bitcast " << integer << " : i32 to f32\n";
        } else if (auto *binary = std::get_if<ScalarBinary>(&n.operation)) {
          if (binary->operation != TokenKind::Plus && binary->operation != TokenKind::Star)
            reject(n.span, "GPU strict arithmetic currently supports only + and *");
          auto a = emit(binary->left), b = emit(binary->right);
          result = temporary();
          dependencies[result] = dependencies[a] | dependencies[b];
          code << "        " << result << " = arith."
               << (binary->operation == TokenKind::Plus ? "addf " : "mulf ") << a << ", " << b
               << " : f32\n";
        } else if (auto *unary = std::get_if<ScalarUnary>(&n.operation)) {
          if (unary->operation != TokenKind::Plus)
            reject(n.span, "GPU unary arithmetic is not implemented");
          result = emit(unary->operand);
        } else if (auto *call = std::get_if<FunctionCall>(&n.operation)) {
          std::vector<std::string> inputs;
          for (auto arg : call->arguments)
            inputs.push_back(emit(arg));
          result = invoke(call->function, inputs);
        } else
          reject(n.span, "unsupported GPU operation in a transitive helper");
        values.emplace(id, result);
        return result;
      };
      for (const auto &statement : fn.body) {
        auto value = emit(statement.value);
        if (statement.binding)
          symbols[*statement.binding] = value;
      }
      auto result = emit(fn.result);
      active.erase(fnId);
      return result;
    };
    auto result = invoke(function, {"%x", "%y"});
    if (dependencies[result] != 3)
      reject(scalar.functions[function].declaration,
             "the initial two-input GPU ABI requires both inputs to contribute to the result");
    return R"(module attributes {gpu.container_module,
  spirv.target_env = #spirv.target_env<#spirv.vce<v1.0, [Shader, Int64], [SPV_KHR_storage_buffer_storage_class]>, #spirv.resource_limits<>>} {
  gpu.module @kernels {
    gpu.func @kalandra_elementwise(%a: memref<?xf32>, %b: memref<?xf32>, %out: memref<?xf32>, %parameters: memref<2xi32>)
      kernel attributes {spirv.entry_point_abi = #spirv.entry_point_abi<workgroup_size = [64, 1, 1]>} {
      %block = gpu.block_id x
      %thread = gpu.thread_id x
      %width = gpu.block_dim x
      %base = arith.muli %block, %width : index
      %i = arith.addi %base, %thread : index
      %zero = arith.constant 0 : index
      %count = memref.load %parameters[%zero] : memref<2xi32>
      %n = arith.index_cast %count : i32 to index
      %valid = arith.cmpi ult, %i, %n : index
      scf.if %valid {
        %x = memref.load %a[%i] : memref<?xf32>
        %y = memref.load %b[%i] : memref<?xf32>
)" + code.str() +
           "        memref.store " + result +
           ", %out[%i] : memref<?xf32>\n      }\n      gpu.return\n    }\n  }\n}\n";
  }

public:
  explicit Compiler(Module module) : syntax(std::move(module)) {}
  std::map<std::string, std::string> run() {
    Module kernels = syntax;
    kernels.functions.clear();
    std::optional<std::size_t> main;
    for (std::size_t i = 0; i < syntax.functions.size(); ++i) {
      const auto &fn = syntax.functions[i];
      auto name = text(fn.name);
      if (name == "main") {
        if (main)
          reject(fn.name, "duplicate main");
        main = i;
        continue;
      }
      if (name == "devices" || name == "tensor" || name == "transfer")
        reject(fn.name, "this GPU source slice reserves standard placement/transfer names");
      if (!functions.emplace(name, kernels.functions.size()).second)
        reject(fn.name, "duplicate GPU function");
      if (fn.parameters.size() != 2 || !fn.result || fn.taskError)
        reject(
            fn.span,
            "GPU functions require two tensor parameters, a tensor result, and no error channel");
      Function converted = fn;
      auto scalarize = [&](TypeSyntax &type) {
        tensorType(type, true);
        type.tensor = false;
        type.name = *type.element;
        type.element = {};
        type.dimensions.clear();
      };
      for (auto &p : converted.parameters)
        scalarize(p.type);
      scalarize(*converted.result);
      // Bindings may have explicit tensor context; each lane receives scalar context.
      for (auto &s : converted.body)
        if (s.annotation)
          scalarize(*s.annotation);
      kernels.functions.push_back(std::move(converted));
    }
    if (!main)
      reject({}, "missing main");
    for (const auto &fn : syntax.functions)
      if (text(fn.name) != "main")
        validateKernelShapes(fn);
    auto checked = kalandra::check({std::move(kernels), {}});
    if (!checked.ok())
      throw Rejected{checked.diagnostics.front()};
    scalar = std::move(*checked.module);
    const auto &fn = syntax.functions[*main];
    if (!fn.parameters.empty() || !fn.result || !fn.taskError)
      reject(fn.span, "Metal main requires no parameters, a tensor result, and ! TaskError");
    auto declared = tensorType(*fn.result);
    if (fn.body.size() != 1 || fn.body[0].binding)
      reject(fn.span, "Metal main must contain a single try parallel block");
    const auto *attempt = std::get_if<TaskExpr>(&node(fn.body[0].expression).value);
    const auto *parallel = attempt && attempt->prefix == TaskPrefix::Try
                               ? std::get_if<ParallelExpr>(&node(attempt->operand).value)
                               : nullptr;
    if (!parallel)
      reject(fn.span, "Metal main must contain a single try parallel block");
    Value result{Value::Target};
    for (const auto &s : parallel->body) {
      if (s.binding && locals.contains(text(*s.binding)))
        reject(*s.binding, "duplicate immutable binding");
      result = expression(s.expression, s.annotation ? &*s.annotation : nullptr);
      if (s.annotation) {
        auto extent = tensorType(*s.annotation);
        if (result.kind != Value::Tensor || (extent && *extent != result.length))
          reject(s.span, "tensor annotation mismatch");
      }
      if (s.binding)
        locals.emplace(text(*s.binding), result);
    }
    if (result.kind != Value::Tensor || result.gpu)
      reject(fn.span, "main must return a completed host tensor; explicitly transfer the result to "
                      "devices.cpu()");
    if (declared && *declared != result.length)
      reject(fn.span, "main result shape mismatch");
    for (auto task : tasks)
      if (!observed.contains(task))
        reject(fn.span, "every admitted child task must be observed with try await");
    if (entries.empty())
      reject(fn.span, "no GPU placement in source");
    std::map<std::string, std::string> outputs;
    for (auto [function, index] : entries)
      outputs["kernel" + std::to_string(index) + ".mlir"] = shader(function);
    mlir::DialectRegistry registry;
    mlir::registerAllDialects(registry);
    mlir::MLIRContext context(registry);
    for (auto &[name, ir] : outputs) {
      (void)name;
      auto parsed = mlir::parseSourceString<mlir::ModuleOp>(ir, &context);
      if (!parsed || mlir::failed(mlir::verify(*parsed)))
        reject(fn.span, "generated GPU IR failed verification");
    }
    std::ostringstream host;
    host << R"(#include "Metal.h"
#include <array>
#include <charconv>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <new>
#include <string>
using namespace kalandra::runtime;
namespace m = kalandra::runtime::metal;
struct PacketData { m::Runtime *runtime; const char *directory; };
struct Frame { m::Runtime *runtime; std::string directory; GroupHandle group; unsigned pc=0;
)";
    for (auto &f : fields)
      host << "  " << f << '\n';
    host << R"(};
bool construct(Invocation &, void *out, const Packet &p) {
  auto &data=*static_cast<const PacketData *>(p.data);
  new(out) Frame{data.runtime,data.directory,{}}; return true;
}
void destroy(void *p) noexcept { static_cast<Frame *>(p)->~Frame(); }
bool readBuffer(Task &task, TaskHandle child, m::Buffer &output) {
  auto failure=task.failure(child);
  if (failure.kind!=TaskFailure::None) { task.fault(failure.code ? failure.code : std::int64_t(m::Error::Device)); return false; }
  alignas(m::Buffer) std::byte slot[sizeof(m::Buffer)];
  if (!task.read(child,m::Runtime::bufferLayout(),slot)) return false;
  auto *value=std::launder(reinterpret_cast<m::Buffer *>(slot)); output=*value; value->~Buffer(); return true;
}
void resume(Task &task) {
  auto &f=*static_cast<Frame *>(task.frame()); auto &r=*f.runtime;
  if (f.pc==0) { f.group=task.openGroup(); if (!f.group) { task.fault(2); return; } f.pc=1; }
  switch(f.pc) {
)";
    for (std::size_t i = 0; i < steps.size(); ++i)
      host << "case " << i + 1 << ": {\n"
           << steps[i] << "f.pc=" << i + 2 << ";\n} [[fallthrough]];\n";
    host << "case " << steps.size() + 1 << ": task.close(f.group); f.pc=" << steps.size() + 2
         << "; [[fallthrough]];\ncase " << steps.size() + 2
         << ": {\n"
            "if (!task.join(f.group)) return;\nauto failure=task.failure(f.group);\nif "
            "(failure.kind!=TaskFailure::None) { task.fault(failure.code); return; "
            "}\ntask.complete(&"
         << ref(result) << "); return;\n}\ndefault: task.fault(3);\n}\n}\n";
    host
        << R"(const TaskEntry entry{1,0x4b414c47505501,sizeof(PacketData),alignof(PacketData),sizeof(Frame),alignof(Frame),construct,destroy,resume,&m::Runtime::bufferLayout()};
int main(int argc,char **argv) {
  if (argc!=1 && argc!=2) { std::fprintf(stderr,"expected optional shader directory\n"); return 2; }
  const auto directory=argc==2 ? std::string(argv[1]) : std::filesystem::absolute(argv[0]).parent_path().string();
  auto made=m::Runtime::create();
  if (!made) { std::fprintf(stderr,"Metal unavailable: %lld\n",(long long)made.error()); return 1; }
  auto runtime=std::move(*made);
  TaskLimits limits;
  if (auto *configured=std::getenv("KALANDRA_WORKERS")) {
    unsigned count=0; auto end=configured+std::strlen(configured); auto parsed=std::from_chars(configured,end,count);
    if (parsed.ec!=std::errc{} || parsed.ptr!=end || count<1 || count>64) return 2;
    limits.workers=count;
  }
  auto core=TaskCore::create(limits); if (!core) return 1;
  auto group=core->openRoot(); PacketData packet{runtime.get(),directory.c_str()};
  auto child=core->submit(group,entry,{entry.packetLayout,&packet,sizeof(packet)});
  if (!child || !core->drain()) return 1;
  auto failure=core->failure(group); if (failure.kind==TaskFailure::None) failure=core->failure(child);
  int status=0;
  if (failure.kind!=TaskFailure::None) { std::fprintf(stderr,"Metal task failed: %d/%lld\n",int(failure.kind),(long long)failure.code); status=1; }
  else {
    Invocation context; alignas(m::Buffer) std::byte slot[sizeof(m::Buffer)];
    if (!core->observe(child,m::Runtime::bufferLayout(),context,slot)) return 1;
    auto *value=std::launder(reinterpret_cast<m::Buffer *>(slot)); auto bytes=value->hostBytes();
    if (!bytes) status=1;
    else { std::printf("["); for (std::size_t i=0;i<bytes->size()/4;++i) {
      std::uint32_t bits; std::memcpy(&bits,bytes->data()+i*4,4); std::printf(i ? ",%08x" : "%08x",bits);
    } std::puts("]"); }
    value->~Buffer();
  }
  core->close(group); if (!core->drain() || !core->release(group)) return 1;
  auto s=runtime->stats(); auto t=core->stats();
  if (s.bytes || s.metalBuffers || s.hostBackings || s.deviceBackings || s.inFlight || s.stagingBuffers || t.records || t.groups || t.externalPending || t.retainedBytes) return 1;
  return status;
}
)";
    outputs["host.cpp"] = host.str();
    outputs["manifest.txt"] = "kernel_count=" + std::to_string(entries.size()) + "\n";
    return outputs;
  }
};
} // namespace
int main(int argc, char **argv) {
  if (argc < 4 || std::string_view(argv[2]) != "-o") {
    std::cerr << "usage: kalandra-metal-source source.kalandra -o directory [--build "
                 "[-O2|--sanitize|--thread-sanitize]]\n";
    return 2;
  }
  bool build = false;
  std::string variant = "debug";
  bool selected = false;
  for (int i = 4; i < argc; ++i) {
    std::string_view option = argv[i];
    if (option == "--build" && !build)
      build = true;
    else if (!selected &&
             (option == "-O2" || option == "--sanitize" || option == "--thread-sanitize")) {
      selected = true;
      variant = option == "-O2"          ? "optimized"
                : option == "--sanitize" ? "sanitized"
                                         : "thread-sanitized";
    } else {
      std::cerr << "unknown or conflicting option\n";
      return 2;
    }
  }
  if (selected && !build) {
    std::cerr << "build flags require --build\n";
    return 2;
  }
  auto source = loadSource(argv[1]);
  if (!source) {
    std::cerr << source.error() << '\n';
    return 1;
  }
  try {
    auto parsed = parse(*source);
    if (!parsed.ok()) {
      for (auto &d : parsed.diagnostics)
        std::cerr << renderDiagnostic(**source, d);
      return 1;
    }
    auto outputs = Compiler(std::move(parsed.module)).run();
    std::filesystem::path directory = argv[3];
    std::vector<std::string> paths;
    for (const auto &[name, contents] : outputs) {
      (void)contents;
      paths.push_back(name);
      if (build && name.starts_with("kernel") && name.ends_with(".mlir"))
        for (const auto *suffix : {".lowered.mlir", ".converted.mlir", ".kernel.mlir", ".spv",
                                   ".metal", ".air", ".metallib"})
          paths.push_back(std::filesystem::path(name).stem().string() + suffix);
    }
    if (build)
      paths.push_back("program");
    for (const auto &name : paths) {
      auto target = directory / name;
      std::error_code ec;
      if (std::filesystem::equivalent(target, argv[1], ec))
        throw std::runtime_error("source and output paths must be distinct");
      if (std::filesystem::is_symlink(std::filesystem::symlink_status(target)))
        throw std::runtime_error("refusing symlink output");
    }
    std::filesystem::create_directories(directory);
    for (auto &[name, contents] : outputs) {
      llvm::SmallString<256> temporary;
      int descriptor = -1;
      auto target = directory / name;
      if (auto ec = llvm::sys::fs::createUniqueFile(target.string() + ".tmp-%%%%%%", descriptor,
                                                    temporary))
        throw std::runtime_error(ec.message());
      llvm::FileRemover remove(temporary);
      llvm::raw_fd_ostream file(descriptor, true);
      file << contents;
      file.close();
      if (file.has_error())
        throw std::runtime_error("cannot write compiler output");
      std::filesystem::rename(std::string(temporary), target);
    }
    if (build)
      buildMetalProgram(directory, outputs, variant);
    return 0;
  } catch (const Rejected &e) {
    std::cerr << renderDiagnostic(**source, e.diagnostic);
  } catch (const std::exception &e) {
    std::cerr << "Metal source compilation: " << e.what() << '\n';
  }
  return 1;
}
