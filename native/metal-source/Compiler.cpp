#include "Build.h"
#include "kalandra/Backend.h"
#include "kalandra/MetalSource.h"
#include "kalandra/Semantics.h"
#include "mlir/IR/BuiltinOps.h"
#include "mlir/IR/Verifier.h"
#include "mlir/InitAllDialects.h"
#include "mlir/Parser/Parser.h"
#include "llvm/ADT/APFloat.h"
#include "llvm/AsmParser/Parser.h"
#include "llvm/IR/Module.h"
#include "llvm/Support/Error.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/FileUtilities.h"
#include "llvm/Support/SourceMgr.h"
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
  enum Kind { Tensor, Target, Task, Scalar } kind;
  std::size_t slot = 0;
  bool gpu = false;
  std::uint32_t device = 0;
  std::optional<std::uint64_t> length = {};
  bool scalarTask = false;
};
class Compiler {
  Module syntax;
  std::map<std::string, std::size_t> cpuFunctions;
  TypedModule cpu;
  std::vector<std::string> cpuExports;
  std::set<std::string> gpuNames;
  std::string declarations;
  // Discover GPU placement roots and their transitive helper closure. All functions
  // retain the same checked tensor/scalar types on both targets.
  void discover(ExprId id, bool gpu = false) {
    if (depth >= 128)
      reject(node(id).span, "function discovery depth exceeded");
    Depth guard(depth);
    const auto &v = node(id).value;
    if (auto *t = std::get_if<TaskExpr>(&v)) {
      discover(t->operand, gpu || t->prefix == TaskPrefix::Spawn);
      if (t->placement)
        discover(*t->placement);
    } else if (auto *c = std::get_if<CallExpr>(&v)) {
      auto name = named(c->callee);
      if (gpu && gpuNames.insert(name).second)
        for (const auto &fn : syntax.functions)
          if (text(fn.name) == name)
            for (auto &statement : fn.body)
              discover(statement.expression, true);
      for (auto a : c->arguments)
        discover(a, gpu);
    } else if (auto *b = std::get_if<BinaryExpr>(&v)) {
      discover(b->left, gpu);
      discover(b->right, gpu);
    } else if (auto *u = std::get_if<UnaryExpr>(&v))
      discover(u->operand, gpu);
    else if (auto *p = std::get_if<ParallelExpr>(&v))
      for (auto &statement : p->body)
        discover(statement.expression, gpu);
  }

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
    if (t.dimensions[0].extent && *t.dimensions[0].extent > std::uint64_t(INT64_MAX) / 4)
      reject(t.span, "rank-one float32 tensor extent exceeds the checked allocation range");
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
  void requireLength(const Value &value, std::uint64_t extent, SourceSpan span) {
    if (value.length) {
      if (*value.length != extent)
        reject(span, "tensor shape mismatch");
    } else {
      auto [line, column] = syntax.source->location(span.begin);
      steps.push_back("if (" + ref(value) + ".shape().size()!=1 || " + ref(value) +
                      ".shape()[0]!=" + std::to_string(extent) + ") { task.fault(1," +
                      std::to_string(line) + "," + std::to_string(column) + "); return; }\n");
    }
  }
  bool reduction(std::size_t function) const {
    const auto &fn = cpu.functions[function];
    if (fn.resultType.tensor || fn.parameters.size() != 1 ||
        !cpu.symbols[fn.parameters[0]].type.tensor || fn.body.size() != 1 || fn.body[0].binding)
      return false;
    auto *sum = std::get_if<ReduceSum>(&cpu.expressions[fn.result].operation);
    if (!sum || sum->order != ReductionOrder::BalancedAdjacent || !sum->rowMajor)
      return false;
    auto *input = std::get_if<SymbolRead>(&cpu.expressions[sum->input].operation);
    return input && input->symbol == fn.parameters[0];
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
    if (std::holds_alternative<NumberExpr>(node(id).value) ||
        std::holds_alternative<UnaryExpr>(node(id).value)) {
      auto out = field("float");
      Value value{Value::Scalar, next - 1};
      steps.push_back("f." + out + " = std::bit_cast<float>(std::uint32_t(" +
                      std::to_string(bits(id)) + "u));\n");
      return value;
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
        steps.push_back(
            "static const std::array<std::uint32_t," + std::to_string(*value.length) +
            "> data = " + data +
            ";\n"
            "const std::int64_t length = " +
            std::to_string(*value.length) +
            ";\n"
            "auto *allocation = task.context().allocate(data.size() * 4);\n"
            "if (!allocation) { task.fault(2); return; }\n"
            "if (!data.empty()) std::memcpy(allocation, data.data(), data.size() * 4);\n"
            "Float32Tensor<1> descriptor{static_cast<float *>(allocation), static_cast<float "
            "*>(allocation), 0, {length}, {1}};\n"
            "auto value = r.fromCpu(task.context(), descriptor.view());\n"
            "task.context().release(allocation);\n"
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
      if (auto found = cpuFunctions.find(name); found != cpuFunctions.end()) {
        const auto &fn = cpu.functions[found->second];
        if (call->arguments.size() != fn.parameters.size())
          reject(span, "CPU function argument count mismatch");
        const bool tensorResult = fn.resultType.tensor;
        auto out = field(tensorResult ? "m::Buffer" : "float");
        Value value{tensorResult ? Value::Tensor : Value::Scalar, next - 1};
        if (tensorResult)
          value.length = fn.resultType.shape[0].constant;
        std::string step, arguments;
        std::map<ExtentId, Value> extentArguments;
        for (std::size_t i = 0; i < call->arguments.size(); ++i) {
          auto input = expression(call->arguments[i]);
          const auto &type = cpu.symbols[fn.parameters[i]].type;
          if (type.tensor) {
            if (input.kind != Value::Tensor || input.gpu)
              reject(span, "CPU tensor arguments require an explicit transfer to devices.cpu()");
            if (type.shape.size() != 1)
              reject(span, "CPU bridge currently accepts rank-one float32 tensors");
            if (type.shape[0].constant && input.length && type.shape[0].constant != input.length)
              reject(span, "CPU argument shape mismatch");
            if (!type.shape[0].constant)
              extentArguments.emplace(type.shape[0].identity, input);
            auto local = "argument" + std::to_string(i);
            step += "auto " + local + " = r.toCpu<1>(task.context(), " + ref(input) + ");\n";
            step += "if (!" + local + ") { " + error(local + ".error()") + " }\n";
            arguments += "&*" + local + ",";
          } else {
            if (input.kind != Value::Scalar)
              reject(span, "CPU argument requires float32");
            arguments += ref(input) + ",";
          }
        }
        std::string guards;
        for (const auto &requirement : fn.preconditions) {
          const auto known = [&](Extent extent) {
            return extent.constant ? extent.constant : extentArguments.at(extent.identity).length;
          };
          const auto render = [&](Extent extent) {
            return extent.constant ? std::to_string(*extent.constant)
                                   : ref(extentArguments.at(extent.identity)) + ".shape()[0]";
          };
          auto left = known(requirement.left), right = known(requirement.right);
          if (left && right) {
            if (left != right)
              reject(span, "CPU call violates a known tensor shape requirement");
          } else {
            auto [line, column] = syntax.source->location(span.begin);
            guards += "if (" + render(requirement.left) + "!=" + render(requirement.right) +
                      ") { task.fault(1," + std::to_string(line) + "," + std::to_string(column) +
                      "); return; }\n";
          }
        }
        step = guards + step;
        if (tensorResult)
          step += "Float32Tensor<1> result{};\n";
        step += (tensorResult ? "" : "f." + out + " = ") +
                std::string("_mlir_ciface_kalandra_cpu_") + std::to_string(found->second) + "(" +
                (tensorResult ? "&result," : "") + arguments + "&task.context());\n";
        step += "if (task.context().status()) { task.fault(task.context().status(), "
                "task.context().line(), task.context().column()); return; }\n";
        if (tensorResult) {
          // Acquire the immutable backing lease before releasing the returned memref owner.
          // The buffer-deallocation pipeline gives C-interface tensor results owned storage.
          step += "auto imported = r.fromCpu(task.context(), result.view());\n";
          step += "task.context().release(result.allocated);\n";
          step += "if (!imported) { " + error("imported.error()") + " }\n";
          step += "f." + out + " = *imported;\n";
        }
        for (std::size_t i = 0; i < fn.parameters.size(); ++i)
          if (cpu.symbols[fn.parameters[i]].type.tensor)
            step += "task.context().release(argument" + std::to_string(i) + "->allocated);\n";
        steps.push_back(step);
        return value;
      }
      reject(span, "unsupported host call in the Metal source slice");
    }
    if (const auto *task = std::get_if<TaskExpr>(&node(id).value)) {
      if (task->prefix == TaskPrefix::Try) {
        const auto *wait = std::get_if<TaskExpr>(&node(task->operand).value);
        if (!wait || wait->prefix != TaskPrefix::Await)
          reject(span, "this slice supports try await for task observation");
        auto input = expression(wait->operand);
        if (input.kind != Value::Task)
          reject(span, "await requires an owned task");
        auto out = field(input.scalarTask ? "float" : "m::Buffer");
        auto value = input;
        value.kind = input.scalarTask ? Value::Scalar : Value::Tensor;
        if (input.scalarTask)
          value.gpu = false;
        value.slot = next - 1;
        observed.insert(input.slot);
        steps.push_back("if (!task.await(" + ref(input) + ")) return;\n" +
                        (input.scalarTask ? "if (!readScalar(task, " : "if (!readBuffer(task, ") +
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
        auto found = cpuFunctions.find(name);
        if (found == cpuFunctions.end() || locals.contains(name) || name == "main")
          reject(span, "unknown or shadowed GPU function");
        const auto &entryFunction = cpu.functions[found->second];
        const bool sum = reduction(found->second);
        if (call->arguments.size() != entryFunction.parameters.size())
          reject(span, "GPU call argument count mismatch");
        if (!entryFunction.resultType.tensor && !sum)
          reject(span,
                 "GPU scalar entries currently require a direct reduceSum of one tensor parameter");
        std::vector<Value> tensors, scalars;
        for (std::size_t i = 0; i < call->arguments.size(); ++i) {
          auto value = expression(call->arguments[i]);
          const bool tensor = cpu.symbols[entryFunction.parameters[i]].type.tensor;
          if (value.kind != (tensor ? Value::Tensor : Value::Scalar))
            reject(node(call->arguments[i]).span, "GPU argument type mismatch");
          (tensor ? tensors : scalars).push_back(value);
        }
        if (tensors.empty() || tensors.size() > 2 || scalars.size() > 8)
          reject(span, "GPU entries require one or two tensors and at most eight float32 scalars");
        auto target = expression(*task->placement);
        if (target.kind != Value::Target || !target.gpu)
          reject(span, "the Metal source path requires a GPU target");
        for (auto value : tensors)
          if (!value.gpu || value.device != target.device)
            reject(span, "GPU arguments must be explicitly transferred to the selected device");
        auto left = tensors[0], right = tensors.back();
        if (left.length && right.length && left.length != right.length)
          reject(span, "elementwise argument shapes differ");
        if (tensors.size() == 2 && (!left.length || !right.length)) {
          auto [line, column] = syntax.source->location(span.begin);
          steps.push_back("if (" + ref(left) + ".shape()[0]!=" + ref(right) +
                          ".shape()[0]) { task.fault(1," + std::to_string(line) + "," +
                          std::to_string(column) + "); return; }\n");
        }
        const bool legacy = tensors.size() == 2 && scalars.empty();
        auto signature = ", m::ElementwiseSignature{" + std::to_string(tensors.size()) + "," +
                         std::to_string(scalars.size()) + "}";
        auto pack = [&](const std::vector<Value> &values, std::string type) {
          std::string result = "std::array<" + type + "," + std::to_string(values.size()) + ">{";
          for (std::size_t i = 0; i < values.size(); ++i)
            result += (i ? ", " : "") + ref(values[i]);
          return result + "}";
        };
        auto arguments = legacy ? ref(left) + ", " + ref(right)
                                : pack(tensors, "m::Buffer") + ", " + pack(scalars, "float");
        auto [entry, inserted] = entries.emplace(found->second, entries.size());
        (void)inserted;
        auto kernel = field("m::Kernel"), out = field("TaskHandle");
        Value result{Value::Task, next - 1, true, target.device,
                     left.length ? left.length : right.length};
        steps.push_back("auto target = " + device(target) + ";\nif (!target) { " +
                        error("target.error()") + " }\n" + std::string("auto kernel = r.") +
                        (sum ? "loadReductionKernel" : "loadElementwiseKernel") +
                        "(f.directory + \"/kernel" + std::to_string(entry->second) +
                        ".metallib\", *target" + (legacy || sum ? "" : signature) +
                        ");\n"
                        "if (!kernel) { " +
                        error("kernel.error()") + " }\nf." + kernel +
                        " = *kernel;\n"
                        "f." +
                        out + " = r." + (sum ? "reduceSum" : "elementwise") + "(task, f.group, f." +
                        kernel + ", " + (sum ? ref(left) : arguments) + ");\n" + check("f." + out));
        result.scalarTask = sum;
        tasks.insert(result.slot);
        return result;
      }
      reject(span, "task results must be observed with try await");
    }
    reject(span, "unsupported expression in the Metal source supervisor");
  }
  std::string shader(std::size_t function) const {
    if (reduction(function))
      return R"(module attributes {gpu.container_module,
  spirv.target_env = #spirv.target_env<#spirv.vce<v1.0, [Shader, Int64], [SPV_KHR_storage_buffer_storage_class]>, #spirv.resource_limits<>>} {
  gpu.module @kernels {
    gpu.func @kalandra_reduce_sum(%input: memref<?xf32>, %output: memref<?xf32>, %parameters: memref<1xi32>)
      kernel attributes {spirv.entry_point_abi = #spirv.entry_point_abi<workgroup_size = [64, 1, 1]>} {
      %block = gpu.block_id x
      %thread = gpu.thread_id x
      %width = gpu.block_dim x
      %base = arith.muli %block, %width : index
      %i = arith.addi %base, %thread : index
      %zero = arith.constant 0 : index
      %one = arith.constant 1 : index
      %two = arith.constant 2 : index
      %count = memref.load %parameters[%zero] : memref<1xi32>
      %n = arith.index_cast %count : i32 to index
      %left = arith.muli %i, %two : index
      %valid = arith.cmpi ult, %left, %n : index
      scf.if %valid {
        %a = memref.load %input[%left] : memref<?xf32>
        %right = arith.addi %left, %one : index
        %paired = arith.cmpi ult, %right, %n : index
        %result = scf.if %paired -> f32 {
          %b = memref.load %input[%right] : memref<?xf32>
          %sum = arith.addf %a, %b : f32
          scf.yield %sum : f32
        } else {
          scf.yield %a : f32
        }
        memref.store %result, %output[%i] : memref<?xf32>
      }
      gpu.return
    }
  }
}
)";
    // Emit scalar typed SSA once per lane. Source names never become IR identifiers.
    std::ostringstream code;
    std::size_t counter = 0, callDepth = 0;
    std::set<std::size_t> active;
    std::unordered_map<std::string, unsigned> dependencies;
    auto temporary = [&] {
      if (counter >= 100000)
        reject({}, "GPU IR expansion limit exceeded");
      return "%v" + std::to_string(counter++);
    };
    std::function<std::string(std::size_t, const std::vector<std::string> &)> invoke;
    invoke = [&](std::size_t fnId, const std::vector<std::string> &args) -> std::string {
      const auto &fn = cpu.functions.at(fnId);
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
        const auto &n = cpu.expressions.at(id);
        std::string result;
        if (auto *read = std::get_if<SymbolRead>(&n.operation))
          result = symbols.at(read->symbol);
        else if (auto *literal = std::get_if<Float32Literal>(&n.operation)) {
          auto integer = temporary();
          result = temporary();
          code << "        " << integer << " = arith.constant " << std::int32_t(literal->bits)
               << " : i32\n";
          code << "        " << result << " = arith.bitcast " << integer << " : i32 to f32\n";
        } else if (std::holds_alternative<ScalarBinary>(n.operation) ||
                   std::holds_alternative<TensorBinary>(n.operation)) {
          auto operation = std::holds_alternative<ScalarBinary>(n.operation)
                               ? std::get<ScalarBinary>(n.operation).operation
                               : std::get<TensorBinary>(n.operation).operation;
          auto left = std::holds_alternative<ScalarBinary>(n.operation)
                          ? std::get<ScalarBinary>(n.operation).left
                          : std::get<TensorBinary>(n.operation).left;
          auto right = std::holds_alternative<ScalarBinary>(n.operation)
                           ? std::get<ScalarBinary>(n.operation).right
                           : std::get<TensorBinary>(n.operation).right;

          if (operation != TokenKind::Plus && operation != TokenKind::Star)
            reject(n.span, "GPU strict arithmetic currently supports only + and *");
          auto a = emit(left), b = emit(right);
          result = temporary();
          dependencies[result] = dependencies[a] | dependencies[b];
          code << "        " << result << " = arith."
               << (operation == TokenKind::Plus ? "addf " : "mulf ") << a << ", " << b
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
    std::vector<std::string> args;
    unsigned tensors = 0, scalars = 0;
    std::string bindings, loads;
    for (auto parameter : cpu.functions[function].parameters) {
      if (cpu.symbols[parameter].type.tensor) {
        auto buffer = "%a" + std::to_string(tensors), lane = "%lane" + std::to_string(tensors);
        bindings += buffer + ": memref<?xf32>, ";
        loads += "        " + lane + " = memref.load " + buffer + "[%i] : memref<?xf32>\n";
        dependencies[lane] = 1u << tensors++;
        args.push_back(lane);
      } else
        args.push_back("%scalar" + std::to_string(scalars++));
    }
    const bool legacy = tensors == 2 && scalars == 0;
    auto parameters = "memref<" + std::to_string(legacy ? 2 : scalars + 1) + "xi32>";
    for (unsigned i = 0; i < scalars; ++i) {
      auto suffix = std::to_string(i);
      loads +=
          "        %index" + suffix + " = arith.constant " + std::to_string(i + 1) + " : index\n";
      loads += "        %bits" + suffix + " = memref.load %parameters[%index" + suffix +
               "] : " + parameters + "\n";
      loads += "        %scalar" + suffix + " = arith.bitcast %bits" + suffix + " : i32 to f32\n";
    }
    auto result = invoke(function, args);
    if (dependencies[result] != (1u << tensors) - 1)
      reject(cpu.functions[function].declaration,
             "GPU tensor inputs must contribute to the result");
    return R"(module attributes {gpu.container_module,
  spirv.target_env = #spirv.target_env<#spirv.vce<v1.0, [Shader, Int64], [SPV_KHR_storage_buffer_storage_class]>, #spirv.resource_limits<>>} {
  gpu.module @kernels {
    gpu.func @)" +
           std::string(legacy ? "kalandra_elementwise" : "kalandra_elementwise_v2") + "(" +
           bindings + "%out: memref<?xf32>, %parameters: " + parameters + R"()
      kernel attributes {spirv.entry_point_abi = #spirv.entry_point_abi<workgroup_size = [64, 1, 1]>} {
      %block = gpu.block_id x
      %thread = gpu.thread_id x
      %width = gpu.block_dim x
      %base = arith.muli %block, %width : index
      %i = arith.addi %base, %thread : index
      %zero = arith.constant 0 : index
      %count = memref.load %parameters[%zero] : )" +
           parameters + R"(
      %n = arith.index_cast %count : i32 to index
      %valid = arith.cmpi ult, %i, %n : index
      scf.if %valid {
)" + loads +
           code.str() + "        memref.store " + result +
           ", %out[%i] : memref<?xf32>\n      }\n      gpu.return\n    }\n  }\n}\n";
  }

public:
  explicit Compiler(Module module) : syntax(std::move(module)) {}
  std::map<std::string, std::string> run() {
    std::set<std::string> names;
    for (const auto &fn : syntax.functions)
      if (!names.insert(text(fn.name)).second)
        reject(fn.name, "duplicate function");
    for (const auto &fn : syntax.functions)
      if (text(fn.name) == "main")
        for (const auto &statement : fn.body)
          discover(statement.expression);
    Module hostModule = syntax;
    hostModule.functions.clear();
    std::optional<std::size_t> main;
    for (std::size_t i = 0; i < syntax.functions.size(); ++i) {
      const auto &fn = syntax.functions[i];
      auto name = text(fn.name);
      if (name == "main") {
        main = i;
        continue;
      }
      if (name == "devices" || name == "tensor" || name == "transfer")
        reject(fn.name, "this GPU source slice reserves standard placement/transfer names");
      if (!fn.result || fn.taskError)
        reject(fn.span, "mixed source functions require an explicit result and no error channel");
      if (fn.result->tensor)
        tensorType(*fn.result, gpuNames.contains(name));
      else if (text(fn.result->name) != "float32")
        reject(fn.result->span, "mixed source results require float32 or rank-one float32 tensors");
      for (const auto &p : fn.parameters) {
        if (p.type.tensor)
          tensorType(p.type, gpuNames.contains(name));
        else if (text(p.type.name) != "float32")
          reject(p.type.span,
                 "mixed source parameters require float32 or rank-one float32 tensors");
      }
      cpuFunctions.emplace(name, hostModule.functions.size());
      cpuExports.push_back(name);
      hostModule.functions.push_back(fn);
    }
    if (!main)
      reject({}, "missing main");
    auto checked = kalandra::check({std::move(hostModule), {}});
    if (!checked.ok())
      throw Rejected{checked.diagnostics.front()};
    cpu = std::move(*checked.module);
    for (std::size_t i = 0; i < cpu.functions.size(); ++i) {
      const auto &f = cpu.functions[i];
      declarations += std::string("extern \"C\" ") + (f.resultType.tensor ? "void" : "float") +
                      " _mlir_ciface_kalandra_cpu_" + std::to_string(i) + "(";
      if (f.resultType.tensor)
        declarations += "Float32Tensor<1>*,";
      for (auto parameter : f.parameters)
        declarations += cpu.symbols[parameter].type.tensor ? "Float32Tensor<1>*," : "float,";
      declarations += "Invocation*);\n";
    }
    const auto &fn = syntax.functions[*main];
    if (!fn.parameters.empty() || !fn.result || !fn.taskError)
      reject(fn.span,
             "Metal main requires no parameters, a float32 or tensor result, and ! TaskError");
    bool scalarResult = !fn.result->tensor;
    if (scalarResult && text(fn.result->name) != "float32")
      reject(fn.span, "Metal main requires float32 or a rank-one float32 tensor");
    auto declared = scalarResult ? std::optional<std::uint64_t>{} : tensorType(*fn.result);
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
        if (s.annotation->tensor) {
          if (result.kind != Value::Tensor)
            reject(s.span, "tensor annotation mismatch");
          if (auto extent = tensorType(*s.annotation)) {
            requireLength(result, *extent, s.span);
            result.length = extent;
          }
        } else if (text(s.annotation->name) != "float32" || result.kind != Value::Scalar)
          reject(s.span, "scalar annotation mismatch");
      }
      if (s.binding)
        locals.emplace(text(*s.binding), result);
    }
    if (scalarResult ? result.kind != Value::Scalar : (result.kind != Value::Tensor || result.gpu))
      reject(fn.span, "main must return a completed host tensor; explicitly transfer the result to "
                      "devices.cpu()");
    if (declared)
      requireLength(result, *declared, fn.span);
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
    if (!cpuExports.empty()) {
      auto lowered = lowerNative(cpu, {}, cpuExports);
      if (!lowered)
        reject(fn.span, lowered.error());
      outputs["cpu.mlir"] = lowered->mlir;
      outputs["cpu.ll"] = lowered->llvm;
    }
    std::ostringstream host;
    host << R"(#include "Metal.h"
#include <array>
#include <bit>
#include <charconv>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <new>
#include <string>
using namespace kalandra::runtime;
namespace m = kalandra::runtime::metal;
 )" << declarations;
    if (scalarResult)
      host << "const ValueLayout &scalarLayout=m::Runtime::scalarLayout();\n";
    host << R"(struct PacketData { m::Runtime *runtime; const char *directory; };
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
bool readScalar(Task &task,TaskHandle child,float &output) {
  auto failure=task.failure(child);
  if(failure.kind!=TaskFailure::None) {task.fault(failure.code ? failure.code : std::int64_t(m::Error::Device)); return false;}
  return task.read(child,m::Runtime::scalarLayout(),&output);
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
        << R"(const TaskEntry entry{1,0x4b414c47505501,sizeof(PacketData),alignof(PacketData),sizeof(Frame),alignof(Frame),construct,destroy,resume,)"
        << (scalarResult ? "&scalarLayout" : "&m::Runtime::bufferLayout()") << R"(};
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
)";
    if (scalarResult)
      host << R"(    Invocation context; float value=0;
    if (!core->observe(child,scalarLayout,context,&value)) return 1;
    std::printf("%08x\n",std::bit_cast<std::uint32_t>(value));)";
    else
      host << R"(    Invocation context; alignas(m::Buffer) std::byte slot[sizeof(m::Buffer)];
    if (!core->observe(child,m::Runtime::bufferLayout(),context,slot)) return 1;
    auto *value=std::launder(reinterpret_cast<m::Buffer *>(slot));
    auto cpu=runtime->toCpu<1>(context,*value);
    if (!cpu) status=1;
    else { std::printf("["); for (std::int64_t i=0;i<cpu->sizes[0];++i) {
      std::uint32_t bits; std::memcpy(&bits,cpu->aligned+i,4); std::printf(i ? ",%08x" : "%08x",bits);
    } std::puts("]"); context.release(cpu->allocated); }
    value->~Buffer();)";
    host << R"(
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
int kalandra::compileMetalCommand(int argc, char **argv) {
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
    if (outputs.contains("cpu.ll") && (variant == "sanitized" || variant == "thread-sanitized")) {
      llvm::LLVMContext context;
      llvm::SMDiagnostic diagnostic;
      auto module = llvm::parseAssemblyString(outputs.at("cpu.ll"), diagnostic, context);
      if (!module)
        throw std::runtime_error("cannot prepare CPU sanitizer attributes");
      for (auto &function : *module)
        if (!function.isDeclaration())
          function.addFnAttr(variant == "sanitized" ? llvm::Attribute::SanitizeAddress
                                                    : llvm::Attribute::SanitizeThread);
      outputs["cpu.ll"].clear();
      llvm::raw_string_ostream stream(outputs["cpu.ll"]);
      module->print(stream, nullptr);
    }
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
