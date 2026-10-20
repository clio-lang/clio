#include "../metal/ElementwiseLayout.h"
#include "Build.h"
#include "MatmulShader.h"
#include "MatmulTiles.h"
#include "kalandra/Backend.h"
#include "kalandra/Continuation.h"
#include "kalandra/MetalSource.h"
#include "kalandra/Project.h"
#include "kalandra/Semantics.h"
#include "mlir/IR/BuiltinOps.h"
#include "mlir/IR/Verifier.h"
#include "mlir/InitAllDialects.h"
#include "mlir/Parser/Parser.h"
#include "llvm/AsmParser/Parser.h"
#include "llvm/IR/Module.h"
#include "llvm/Support/FileSystem.h"
#include "llvm/Support/FileUtilities.h"
#include "llvm/Support/SourceMgr.h"
#include "llvm/Support/raw_ostream.h"
#include <array>
#include <charconv>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <tuple>
#include <unordered_map>
using namespace kalandra;
namespace {
struct Rejected {
  Diagnostic diagnostic;
};
struct Value {
  enum Kind { Tensor, Target, Task, Scalar, Error, FaultKind, Text } kind;
  std::size_t slot = 0;
  bool gpu = false;
  std::uint32_t device = 0;
  std::optional<std::uint64_t> length = {};
  bool scalarTask = false;
  unsigned rank = 1;
  std::optional<std::uint64_t> width = {};
  std::optional<std::size_t> failure = {};
};
class Compiler {
  Module syntax;
  std::map<std::string, std::size_t> cpuFunctions;
  TypedModule cpu;
  TypedModule placement;
  std::vector<std::string> cpuExports;
  std::string declarations, cpuEntries;
  std::size_t cpuEntryCount = 0;
  std::string activeGroup;
  std::optional<std::size_t> admissionExit;
  static std::string jump(std::size_t instruction) {
    return "f.pc=@pc" + std::to_string(instruction) + "@; continue;\n";
  }
  static std::string failureRef(const Value &value) {
    return "f.v" + std::to_string(*value.failure);
  }
  void completed(const Value &value, SourceSpan span) const {
    if (value.failure)
      reject(span, "expected error result requires try or catch before use");
  }
  std::string admitted(const std::string &handle) {
    std::string code = "if (!(" + handle + ")) { auto failure=task.failure(" + activeGroup +
                       "); if(failure.kind!=TaskFailure::None){\n";
    // Another worker can fail and settle the group between argument evaluation
    // and admission. Preserve that error instead of faulting on an empty handle.
    if (admissionExit)
      code += jump(*admissionExit);
    else
      code += "task.fail(failure); return;\n";
    return code + "} " + error("m::Error::Invalid") + "}\n";
  }
  // Admit the placed function's typed closure, not CPU expressions used to
  // compute its arguments. Host preflight checks fixed and inferred shape contracts.
  void admitGpuTypes(FunctionId root) const {
    std::set<FunctionId> visited;
    std::vector<FunctionId> pending{root};
    while (!pending.empty()) {
      auto function = pending.back();
      pending.pop_back();
      if (!visited.insert(function).second)
        continue;
      const auto &fn = cpu.functions[function];
      const auto supported = [&](const ValueType &type) {
        if (type.builtin == BuiltinValue::Numeric &&
            !numericArithmeticAvailable(type.element, NumericTarget::AppleGpu))
          reject(fn.declaration, "GPU kernel numeric type is not implemented");
      };
      supported(fn.resultType);
      for (auto parameter : fn.parameters)
        supported(cpu.symbols[parameter].type);
      for (auto value : fn.expressions)
        if (auto *call = std::get_if<FunctionCall>(&cpu.expressions[value].operation))
          pending.push_back(call->function);
    }
  }

  std::map<std::size_t, std::size_t> entries;
  std::vector<std::string> steps, fields;
  std::size_t next = 0;
  struct Depth {
    std::size_t &value;
    explicit Depth(std::size_t &v) : value(v) { ++value; }
    ~Depth() { --value; }
  };
  [[noreturn]] void reject(SourceSpan span, std::string message) const {
    throw Rejected{{"G001", std::move(message), span}};
  }
  std::string text(SourceSpan span) const { return std::string(syntax.source->slice(span)); }
  const TypedExpr &node(ValueId id) const { return placement.expressions.at(id); }
  FunctionId cpuFunction(FunctionId id, SourceSpan span) const {
    auto found = cpuFunctions.find(placement.functions.at(id).name);
    if (found == cpuFunctions.end())
      reject(span, "task/host entry requires an ordinary CPU function");
    return found->second;
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
  static std::optional<std::uint64_t> extent(const Value &value, unsigned axis) {
    return axis == 0 ? value.length : value.width;
  }
  std::optional<std::uint64_t> tensorType(const TypeSyntax &t, bool dynamicOnly = false) const {
    if (!t.tensor || !t.element || text(*t.element) != "float32" || t.dimensions.empty() ||
        t.dimensions.size() > 2)
      reject(t.span, "the Metal source bridge requires rank-one or rank-two float32 tensors");
    const auto bytes = describeNumeric(NumericType::Float32)->bytes();
    std::uint64_t count = 1;
    bool allKnown = true, empty = false;
    for (const auto &d : t.dimensions) {
      if (dynamicOnly && d.extent)
        reject(t.span, "GPU tensor parameters/results currently require dynamic extents");
      if (d.extent && *d.extent > std::uint64_t(INT64_MAX) / bytes)
        reject(t.span, "tensor extent exceeds the checked allocation range");
      allKnown &= d.extent.has_value();
      empty |= d.extent && *d.extent == 0;
    }
    if (allKnown && !empty)
      for (const auto &d : t.dimensions) {
        if (*d.extent > std::uint64_t(INT64_MAX) / bytes / count)
          reject(t.span, "tensor shape exceeds the checked allocation range");
        count *= *d.extent;
      }
    return t.dimensions[0].extent;
  }
  std::optional<std::uint32_t> constantBits(ValueId id) const {
    if (const auto *literal = std::get_if<Float32Literal>(&node(id).operation))
      return literal->bits;
    if (const auto *unary = std::get_if<ScalarUnary>(&node(id).operation)) {
      auto value = constantBits(unary->operand);
      if (value && unary->operation == TokenKind::Minus)
        *value ^= 0x80000000u;
      return value;
    }
    return {};
  }
  std::string lengthGuard(const Value &value, std::uint64_t wanted, SourceSpan span,
                          unsigned axis = 0) const {
    auto known = extent(value, axis);
    if (known) {
      if (*known != wanted)
        reject(span, "tensor shape mismatch");
      return {};
    }
    auto [line, column] = syntax.source->location(span.begin);
    return "if (" + ref(value) + ".shape().size()!=" + std::to_string(value.rank) + " || " +
           ref(value) + ".shape()[" + std::to_string(axis) + "]!=" + std::to_string(wanted) +
           ") { task.fault(1," + std::to_string(line) + "," + std::to_string(column) +
           "); return; }\n";
  }
  void requireLength(const Value &value, std::uint64_t wanted, SourceSpan span, unsigned axis = 0) {
    if (auto guard = lengthGuard(value, wanted, span, axis); !guard.empty())
      steps.push_back(std::move(guard));
  }
  struct PrimitiveEntry {
    enum Kind { Input, Sum, Matrix } kind = Input;
    std::size_t left = 0, right = 0;
  };
  mutable std::map<FunctionId, std::optional<PrimitiveEntry>> primitiveEntries;
  std::optional<PrimitiveEntry> primitiveEntry(FunctionId root) const {
    if (auto found = primitiveEntries.find(root); found != primitiveEntries.end())
      return found->second;
    const auto &entry = cpu.functions.at(root);
    const bool sumSignature = !entry.resultType.tensor && entry.parameters.size() == 1 &&
                              cpu.symbols[entry.parameters[0]].type.tensor &&
                              (cpu.symbols[entry.parameters[0]].type.shape.size() == 1 ||
                               cpu.symbols[entry.parameters[0]].type.shape.size() == 2);
    const bool matrixSignature = entry.resultType.tensor && entry.resultType.shape.size() == 2 &&
                                 entry.parameters.size() == 2 &&
                                 cpu.symbols[entry.parameters[0]].type.tensor &&
                                 cpu.symbols[entry.parameters[1]].type.tensor &&
                                 cpu.symbols[entry.parameters[0]].type.shape.size() == 2 &&
                                 cpu.symbols[entry.parameters[1]].type.shape.size() == 2;
    auto &cached = primitiveEntries[root];
    if (!sumSignature && !matrixSignature)
      return cached;
    std::size_t work = 0, primitives = 0;
    std::set<FunctionId> active;
    using Result = std::optional<PrimitiveEntry>;
    std::function<Result(FunctionId, const std::vector<PrimitiveEntry> &)> invoke;
    invoke = [&](FunctionId id, const std::vector<PrimitiveEntry> &args) -> Result {
      if (++work > 300000 || active.size() >= 128)
        reject(entry.declaration, "GPU primitive forwarding analysis limit exceeded");
      if (!active.insert(id).second)
        return {};
      const auto &fn = cpu.functions.at(id);
      if (args.size() != fn.parameters.size())
        return {};
      std::unordered_map<SymbolId, PrimitiveEntry> symbols;
      std::unordered_map<ValueId, PrimitiveEntry> values;
      for (std::size_t i = 0; i < args.size(); ++i)
        symbols.emplace(fn.parameters[i], args[i]);
      std::function<Result(ValueId)> emit = [&](ValueId value) -> Result {
        if (++work > 300000)
          reject(entry.declaration, "GPU primitive forwarding analysis limit exceeded");
        if (auto found = values.find(value); found != values.end())
          return found->second;
        const auto &node = cpu.expressions.at(value);
        Result result;
        if (const auto *read = std::get_if<SymbolRead>(&node.operation)) {
          if (auto found = symbols.find(read->symbol); found != symbols.end())
            result = found->second;
        } else if (const auto *check = std::get_if<ShapeCheck>(&node.operation))
          result = emit(check->input);
        else if (const auto *sum = std::get_if<ReduceSum>(&node.operation)) {
          auto input = emit(sum->input);
          if (input && input->kind == PrimitiveEntry::Input &&
              sum->order == ReductionOrder::BalancedAdjacent && sum->rowMajor && ++primitives == 1)
            result = PrimitiveEntry{PrimitiveEntry::Sum, input->left, 0};
        } else if (const auto *matrix = std::get_if<Matmul>(&node.operation)) {
          auto left = emit(matrix->left), right = emit(matrix->right);
          if (left && right && left->kind == PrimitiveEntry::Input &&
              right->kind == PrimitiveEntry::Input &&
              matrix->order == ReductionOrder::BalancedAdjacent &&
              matrix->separatelyRoundedProducts && ++primitives == 1)
            result = PrimitiveEntry{PrimitiveEntry::Matrix, left->left, right->left};
        } else if (const auto *call = std::get_if<FunctionCall>(&node.operation)) {
          std::vector<PrimitiveEntry> arguments;
          for (auto argument : call->arguments) {
            auto input = emit(argument);
            if (!input)
              return {};
            arguments.push_back(*input);
          }
          result = invoke(call->function, arguments);
        }
        if (result)
          values.emplace(value, *result);
        return result;
      };
      // Inspect every statement, including unused bindings. Do not discard an
      // extra reduction, allocation or unsupported operation to fit one launch.
      for (const auto &statement : fn.body) {
        auto value = emit(statement.value);
        if (!value)
          return {};
        if (statement.binding)
          symbols[*statement.binding] = *value;
      }
      auto result = emit(fn.result);
      active.erase(id);
      return result;
    };
    std::vector<PrimitiveEntry> arguments;
    for (std::size_t i = 0; i < entry.parameters.size(); ++i)
      arguments.push_back({PrimitiveEntry::Input, i, 0});
    auto result = invoke(root, arguments);
    if (result && primitives == 1 &&
        ((sumSignature && result->kind == PrimitiveEntry::Sum) ||
         (matrixSignature && result->kind == PrimitiveEntry::Matrix)))
      cached = result;
    return cached;
  }
  bool reduction(std::size_t function) const {
    auto entry = primitiveEntry(function);
    return entry && entry->kind == PrimitiveEntry::Sum;
  }
  bool matrixFunction(std::size_t function) const {
    auto entry = primitiveEntry(function);
    return entry && entry->kind == PrimitiveEntry::Matrix;
  }
  std::map<std::string, FunctionId> hostOperations;
  ExtentId hostExtent = 0;
  void observeExtents(const ValueType &type) {
    for (const auto &extent : type.shape)
      hostExtent = std::max(hostExtent, extent.identity);
  }
  void declareCpuFunction(FunctionId id) {
    const auto &f = cpu.functions[id];
    declarations += std::string("extern \"C\" ") + (f.resultType.tensor ? "void" : "float") +
                    " _mlir_ciface_kalandra_cpu_" + std::to_string(id) + "(";
    if (f.resultType.tensor)
      declarations += "Float32Tensor<" + std::to_string(f.resultType.shape.size()) + ">*,";
    for (auto parameter : f.parameters)
      declarations +=
          cpu.symbols[parameter].type.tensor
              ? "Float32Tensor<" + std::to_string(cpu.symbols[parameter].type.shape.size()) + ">*,"
              : "float,";
    declarations += "Invocation*);\n";
  }
  // Check a tiny operation wrapper with the common frontend, then import its typed
  // nodes with fresh IDs and the original expression's source location. Only
  // compiler-owned operator/type spellings enter this source; user text is not spliced.
  FunctionId hostKernel(const std::string &operation, const std::vector<Value> &inputs,
                        SourceSpan span) {
    std::string key = operation;
    for (const auto &input : inputs) {
      completed(input, span);
      if ((input.kind != Value::Tensor && input.kind != Value::Scalar) || input.gpu)
        reject(span, "inline CPU expressions require completed host values; explicitly transfer "
                     "GPU tensors to devices.cpu() and observe tasks with try await");
      key += ":" + std::to_string(input.kind == Value::Tensor ? input.rank : 0);
    }
    if (auto found = hostOperations.find(key); found != hostOperations.end())
      return found->second;
    const bool builtin = operation == "matmul" || operation == "reduceSum";
    if (inputs.size() !=
        (operation == "reduceSum" || operation == "neg" || operation == "pos" ? 1 : 2))
      reject(span, "inline CPU operation argument count mismatch");
    auto name = "__host_expression_" + std::to_string(cpu.functions.size());
    while (cpuFunctions.contains(name))
      name += "_";
    const auto type = [](unsigned rank) {
      if (!rank)
        return std::string("float32");
      std::string result = "Tensor[float32";
      for (unsigned axis = 0; axis < rank; ++axis)
        result += ",?";
      return result + "]";
    };
    unsigned resultRank = 0;
    std::string parameters, arguments;
    for (std::size_t i = 0; i < inputs.size(); ++i) {
      auto rank = inputs[i].kind == Value::Tensor ? inputs[i].rank : 0;
      resultRank = std::max(resultRank, rank);
      if (i) {
        parameters += ",";
        arguments += ",";
      }
      parameters += "a" + std::to_string(i) + ":" + type(rank);
      arguments += "a" + std::to_string(i);
    }
    if (operation == "reduceSum")
      resultRank = 0;
    std::string body = builtin              ? operation + "(" + arguments + ")"
                       : operation == "neg" ? "-a0"
                       : operation == "pos" ? "+a0"
                                            : "a0 " + operation + " a1";
    auto source = std::make_shared<SourceFile>(syntax.source->path(),
                                               "fn " + name + "(" + parameters + ") -> " +
                                                   type(resultRank) + ":\n  " + body + "\n");
    auto checked = kalandra::check(parse(source));
    if (!checked.ok()) {
      auto diagnostic = checked.diagnostics.front();
      diagnostic.span = span;
      throw Rejected{std::move(diagnostic)};
    }
    auto module = std::move(*checked.module);
    if (module.expressions.size() > SemanticLimits{}.maxValues - cpu.expressions.size())
      reject(span, "inline CPU expression value limit exceeded");
    auto fn = std::move(module.functions.at(0));
    const auto function = cpu.functions.size(), symbols = cpu.symbols.size(),
               values = cpu.expressions.size();
    std::map<ExtentId, ExtentId> extents;
    auto remapExtent = [&](Extent &extent) {
      if (!extent.identity)
        return;
      auto [entry, inserted] = extents.emplace(extent.identity, 0);
      if (inserted)
        entry->second = ++hostExtent;
      extent.identity = entry->second;
    };
    auto remapType = [&](ValueType &value) {
      for (auto &extent : value.shape)
        remapExtent(extent);
    };
    for (auto symbol : module.symbols) {
      remapType(symbol.type);
      symbol.owner = function;
      symbol.declaration = span;
      cpu.symbols.push_back(std::move(symbol));
    }
    for (auto expression : module.expressions) {
      remapType(expression.type);
      expression.span = span;
      std::visit(
          [&](auto &op) {
            using T = std::decay_t<decltype(op)>;
            if constexpr (std::is_same_v<T, SymbolRead>)
              op.symbol += symbols;
            else if constexpr (std::is_same_v<T, ScalarUnary> || std::is_same_v<T, TensorUnary>)
              op.operand += values;
            else if constexpr (std::is_same_v<T, ScalarBinary> || std::is_same_v<T, TensorBinary> ||
                               std::is_same_v<T, Matmul>) {
              op.left += values;
              op.right += values;
            } else if constexpr (std::is_same_v<T, ReduceSum>)
              op.input += values;
            else
              reject(span, "unexpected operation in inline CPU kernel");
          },
          expression.operation);
      cpu.expressions.push_back(std::move(expression));
    }
    fn.declaration = span;
    remapType(fn.resultType);
    if (fn.declaredResult)
      remapType(*fn.declaredResult);
    for (auto &parameter : fn.parameters)
      parameter += symbols;
    for (auto &value : fn.expressions)
      value += values;
    fn.result += values;
    for (auto &statement : fn.body) {
      statement.span = span;
      statement.value += values;
      if (statement.binding)
        *statement.binding += symbols;
    }
    for (auto &requirement : fn.preconditions) {
      remapExtent(requirement.left);
      remapExtent(requirement.right);
    }
    cpu.functions.push_back(std::move(fn));
    cpuExports.push_back(name);
    hostOperations.emplace(key, function);
    declareCpuFunction(function);
    return function;
  }
  Value hostOperation(const std::string &operation, const std::vector<Value> &inputs,
                      SourceSpan span) {
    return cpuCall(hostKernel(operation, inputs, span), inputs, span, true);
  }
  Value cpuCall(FunctionId function, const std::vector<Value> &inputs, SourceSpan span,
                bool inlineOperation = false, bool spawned = false) {
    const auto &fn = cpu.functions[function];
    if (inputs.size() != fn.parameters.size())
      reject(span, "CPU function argument count mismatch");
    const bool tensorResult = fn.resultType.tensor;
    auto out = spawned ? std::string("value") : field(tensorResult ? "m::Buffer" : "float");
    Value value{tensorResult ? Value::Tensor : Value::Scalar, spawned ? 0 : next - 1};
    if (tensorResult) {
      value.length = fn.resultType.shape[0].constant;
      value.rank = fn.resultType.shape.size();
      if (value.rank == 2)
        value.width = fn.resultType.shape[1].constant;
    }
    std::string step, arguments;
    std::map<ExtentId, std::pair<Value, unsigned>> extentArguments;
    std::vector<std::tuple<Value, std::uint64_t, unsigned>> fixedShapes;
    for (std::size_t i = 0; i < inputs.size(); ++i) {
      auto input = inputs[i];
      completed(input, span);
      const auto &type = cpu.symbols[fn.parameters[i]].type;
      if (type.tensor) {
        if (input.kind != Value::Tensor || input.gpu)
          reject(span, "CPU tensor arguments require an explicit transfer to devices.cpu()");
        if (type.shape.size() != input.rank)
          reject(span, "CPU tensor argument rank mismatch");
        for (unsigned axis = 0; axis < input.rank; ++axis) {
          if (type.shape[axis].constant)
            fixedShapes.emplace_back(input, *type.shape[axis].constant, axis);
          else
            extentArguments.emplace(type.shape[axis].identity, std::pair{input, axis});
        }
        auto local = "argument" + std::to_string(i);
        step += "auto " + local + " = r.toCpu<" + std::to_string(input.rank) +
                ">(task.context(), " + ref(input) + ");\n";
        step += "if (!" + local + ") { " + error(local + ".error()") + " }\n";
        arguments += "&*" + local + ",";
      } else {
        if (input.kind != Value::Scalar)
          reject(span, "CPU argument requires float32");
        arguments += ref(input) + ",";
      }
    }
    if (inlineOperation && tensorResult)
      for (unsigned axis = 0; axis < value.rank; ++axis) {
        const auto &dimension = fn.resultType.shape[axis];
        auto known = dimension.constant;
        if (!known) {
          auto argument = extentArguments.find(dimension.identity);
          if (argument != extentArguments.end())
            known = extent(argument->second.first, argument->second.second);
        }
        if (axis == 0)
          value.length = known;
        else
          value.width = known;
      }
    std::string guards;
    for (const auto &[input, wanted, axis] : fixedShapes)
      guards += lengthGuard(input, wanted, span, axis);
    for (const auto &requirement : fn.preconditions) {
      const auto known = [&](Extent extent) {
        if (extent.constant)
          return extent.constant;
        const auto &argument = extentArguments.at(extent.identity);
        return Compiler::extent(argument.first, argument.second);
      };
      const auto render = [&](Extent extent) {
        return extent.constant
                   ? std::to_string(*extent.constant)
                   : ref(extentArguments.at(extent.identity).first) + ".shape()[" +
                         std::to_string(extentArguments.at(extent.identity).second) + "]";
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
      step += "Float32Tensor<" + std::to_string(value.rank) + "> result{};\n";
    step += (tensorResult ? "" : "f." + out + " = ") + std::string("_mlir_ciface_kalandra_cpu_") +
            std::to_string(function) + "(" + (tensorResult ? "&result," : "") + arguments +
            "&task.context());\n";
    auto [line, column] = syntax.source->location(span.begin);
    const auto location = inlineOperation ? std::to_string(line) + "," + std::to_string(column)
                                          : "task.context().line(),task.context().column()";
    step += "if (task.context().status()) { task.fault(task.context().status(), " + location +
            "); return; }\n";
    if (spawned)
      step += "if(task.cancelled()) return;\n";
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
    if (!spawned) {
      steps.push_back(step);
      return value;
    }
    const auto prefix = "cpuJob" + std::to_string(cpuEntryCount++);
    std::string members = "m::Runtime *runtime;", captures = "f.runtime", owned = "data.runtime";
    std::string validation = "!data.runtime";
    std::set<std::size_t> captured;
    for (const auto &input : inputs) {
      if (!captured.insert(input.slot).second)
        continue;
      const auto name = "v" + std::to_string(input.slot);
      members += std::string(input.kind == Value::Tensor ? "m::Buffer " : "float ") + name + ";";
      captures += "," + ref(input);
      owned += ",data." + name;
      if (input.kind == Value::Tensor)
        validation += " || !data." + name + " || data." + name + ".onDevice() || data." + name +
                      ".format()!=m::Format::Float32 || data." + name +
                      ".shape().size()!=" + std::to_string(input.rank);
    }
    cpuEntries += "struct " + prefix + "Packet{" + members + "};\nstruct " + prefix + "Frame{" +
                  members + (tensorResult ? "m::Buffer" : "float") + " value{};};\n";
    cpuEntries += "bool " + prefix +
                  "Construct(Invocation &context,void *out,const Packet &packet){\n"
                  "const auto &data=*static_cast<const " +
                  prefix +
                  "Packet*>(packet.data);\n"
                  "if(" +
                  validation +
                  "){context.fault(3);return false;}\n"
                  "new(out) " +
                  prefix + "Frame{" + owned + ",{}};return true;}\n";
    cpuEntries += "void " + prefix + "Destroy(void *frame) noexcept {static_cast<" + prefix +
                  "Frame*>(frame)->~" + prefix + "Frame();}\n";
    cpuEntries +=
        "void " + prefix + "Resume(Task &task){auto &f=*static_cast<" + prefix +
        "Frame*>(task.frame());auto &r=*f.runtime; (void)r;\nif(task.cancelled()) return;\n" +
        step + "task.complete(&f.value); }\n";
    cpuEntries += "const TaskEntry " + prefix + "Entry{1," +
                  std::to_string(0x4b414c4350550000ULL + cpuEntryCount) + "ull,sizeof(" + prefix +
                  "Packet),alignof(" + prefix + "Packet),sizeof(" + prefix + "Frame),alignof(" +
                  prefix + "Frame)," + prefix + "Construct," + prefix + "Destroy," + prefix +
                  "Resume,&m::Runtime::" + (tensorResult ? "bufferLayout" : "scalarLayout") +
                  "()};\n";
    auto taskField = field("TaskHandle");
    steps.push_back(prefix + "Packet packet{" + captures + "};\nf." + taskField + "=task.spawn(" +
                    activeGroup + "," + prefix + "Entry,{" + prefix +
                    "Entry.packetLayout,&packet,sizeof(packet),&task.context()});\n" +
                    admitted("f." + taskField));
    value.kind = Value::Task;
    value.scalarTask = !tensorResult;
    value.slot = next - 1;
    return value;
  }
  std::vector<bool> resumable;
  static std::string helperName(FunctionId id) { return "helper" + std::to_string(id); }
  Value spawnHelper(FunctionId id, const std::vector<Value> &inputs, Value target,
                    SourceSpan span) {
    if (target.kind != Value::Target || target.gpu)
      reject(span,
             "resumable helpers require CPU placement; GPU placements require numeric kernels");
    const auto &fn = placement.functions.at(id);
    if (inputs.size() != fn.parameters.size())
      reject(span, "resumable helper argument count mismatch");
    std::string captures = "f.runtime,f.directory.c_str()";
    for (const auto &input : inputs) {
      completed(input, span);
      if ((input.kind != Value::Tensor && input.kind != Value::Scalar) || input.gpu)
        reject(span, "resumable helper captures require completed host values");
      captures += "," + ref(input);
    }
    const auto out = field("TaskHandle");
    const auto name = helperName(id);
    steps.push_back(name + "::PacketData packet{" + captures + "};\nf." + out + "=task.spawn(" +
                    activeGroup + "," + name + "::entry,{" + name +
                    "::entry.packetLayout,&packet,sizeof(packet),&task.context()});\n" +
                    admitted("f." + out));
    Value value{Value::Task, next - 1};
    const auto type = fn.declaredResult.value_or(fn.resultType);
    value.scalarTask = !type.tensor;
    if (type.tensor) {
      value.rank = type.shape.size();
      value.length = type.shape[0].constant;
      if (value.rank == 2)
        value.width = type.shape[1].constant;
    }
    return value;
  }
  Value transfer(Value input, Value target, SourceSpan span) {
    completed(input, span);
    if (input.kind != Value::Tensor || target.kind != Value::Target)
      reject(span, "transfer requires a completed tensor and device target");
    if (target.gpu && input.gpu && input.device != target.device)
      reject(span, "cross-device transfers are not implemented");
    auto out = field("TaskHandle");
    Value result{Value::Task, next - 1, target.gpu, target.device, input.length};
    result.rank = input.rank;
    result.width = input.width;
    std::string step;
    if (target.gpu)
      step = "auto target = " + device(target) + ";\nif (!target) { " + error("target.error()") +
             " }\nf." + out + " = r.upload(task, " + activeGroup + ", " + ref(input) +
             ", *target);\n";
    else
      step = "f." + out + " = r.download(task, " + activeGroup + ", " + ref(input) + ");\n";
    steps.push_back(step + admitted("f." + out));
    return result;
  }
  Value spawn(FunctionId function, const std::vector<Value> &inputs, Value target,
              SourceSpan span) {
    if (!target.gpu)
      return cpuCall(function, inputs, span, false, true);
    admitGpuTypes(function);
    const auto &entryFunction = cpu.functions[function];
    const bool sum = reduction(function);
    const bool matrix = matrixFunction(function);
    if (!entryFunction.resultType.tensor && !sum)
      reject(span, "GPU scalar entries currently require one reduceSum with forwarding helpers");
    std::vector<Value> tensors, scalars;
    for (std::size_t i = 0; i < inputs.size(); ++i) {
      const auto &value = inputs[i];
      const auto &type = cpu.symbols[entryFunction.parameters[i]].type;
      const bool tensor = type.tensor;
      completed(value, span);
      if (value.kind != (tensor ? Value::Tensor : Value::Scalar))
        reject(span, "GPU argument type mismatch");
      if (tensor && value.rank != type.shape.size())
        reject(span, "GPU tensor ranks must match their parameters");
      if (tensor)
        for (unsigned axis = 0; axis < type.shape.size(); ++axis)
          if (type.shape[axis].constant)
            requireLength(value, *type.shape[axis].constant, span, axis);
      (tensor ? tensors : scalars).push_back(value);
    }
    if (tensors.empty())
      reject(span, "elementwise GPU entries currently require at least one tensor input");
    if (tensors.size() > UINT32_MAX || scalars.size() >= UINT32_MAX)
      reject(span, "GPU argument representation limit exceeded");
    std::vector<std::uint32_t> reads;
    if (!sum && !matrix)
      shader(function, &reads);
    else
      for (std::size_t i = 0; i < tensors.size(); ++i)
        reads.push_back(i);
    for (auto value : tensors)
      if (!value.gpu || value.device != target.device)
        reject(span, "GPU arguments must be explicitly transferred to the selected device");
    auto left = tensors[reads.front()], right = tensors.back();
    if (auto entry = primitiveEntry(function); entry && (sum || matrix)) {
      left = tensors.at(entry->left);
      if (matrix)
        right = tensors.at(entry->right);
    }
    // Parameter extent identities already include transitive helper obligations.
    auto locate = [&](const Extent &wanted) -> std::pair<std::size_t, unsigned> {
      std::size_t tensor = 0;
      for (auto parameter : entryFunction.parameters) {
        const auto &type = cpu.symbols[parameter].type;
        if (!type.tensor)
          continue;
        for (unsigned axis = 0; axis < type.shape.size(); ++axis)
          if (!wanted.constant && wanted.identity == type.shape[axis].identity)
            return {tensor, axis};
        ++tensor;
      }
      reject(span, "GPU shape requirement cannot be mapped to a parameter");
    };
    for (const auto &requirement : entryFunction.preconditions) {
      if (requirement.left.constant && requirement.right.constant) {
        if (requirement.left.constant != requirement.right.constant)
          reject(span, "GPU argument shapes differ");
        continue;
      }
      if (requirement.left.constant || requirement.right.constant) {
        const auto &dynamic = requirement.left.constant ? requirement.right : requirement.left;
        const auto &constant = requirement.left.constant ? requirement.left : requirement.right;
        auto [input, axis] = locate(dynamic);
        requireLength(tensors[input], *constant.constant, span, axis);
        continue;
      }
      auto [a, axisA] = locate(requirement.left);
      auto [b, axisB] = locate(requirement.right);
      auto aExtent = extent(tensors[a], axisA), bExtent = extent(tensors[b], axisB);
      if (aExtent && bExtent && aExtent != bExtent)
        reject(span,
               matrix ? "matmul inner dimensions differ" : "elementwise argument shapes differ");
      if (!aExtent || !bExtent) {
        auto [line, column] = syntax.source->location(span.begin);
        steps.push_back("if(" + ref(tensors[a]) + ".shape()[" + std::to_string(axisA) +
                        "]!=" + ref(tensors[b]) + ".shape()[" + std::to_string(axisB) +
                        "]) {task.fault(1," + std::to_string(line) + "," + std::to_string(column) +
                        ");return;}\n");
      }
    }
    const bool projected = reads.size() != tensors.size();
    const bool indirect =
        !sum && !matrix &&
        !kalandra::runtime::metal::directElementwiseLayout(reads.size(), scalars.size());
    const bool legacy = !projected && !indirect && tensors.size() == 2 && scalars.empty();
    auto signature = ", m::ElementwiseSignature{" + std::to_string(tensors.size()) + "," +
                     std::to_string(scalars.size()) +
                     (indirect ? ",m::ElementwiseBinding::ArgumentBuffer}" : "}");
    if (projected) {
      signature += ", std::array<std::uint32_t," + std::to_string(reads.size()) + ">{";
      for (std::size_t i = 0; i < reads.size(); ++i)
        signature += (i ? "," : "") + std::to_string(reads[i]);
      signature += "}";
    }
    auto pack = [&](const std::vector<Value> &values, std::string type) {
      std::string result = "std::array<" + type + "," + std::to_string(values.size()) + ">{";
      for (std::size_t i = 0; i < values.size(); ++i)
        result += (i ? ", " : "") + ref(values[i]);
      return result + "}";
    };
    auto arguments = legacy ? ref(left) + ", " + ref(right)
                            : pack(tensors, "m::Buffer") + ", " + pack(scalars, "float");
    auto [entry, inserted] = entries.emplace(function, entries.size());
    (void)inserted;
    auto kernel = field("m::Kernel"), out = field("TaskHandle");
    Value result{Value::Task, next - 1, true, target.device, left.length};
    result.rank = left.rank;
    result.width = matrix ? right.width : left.width;
    steps.push_back("auto target = " + device(target) + ";\nif (!target) { " +
                    error("target.error()") + " }\n" + std::string("auto kernel = r.") +
                    (matrix ? "loadMatmulKernel"
                     : sum  ? "loadReductionKernel"
                            : "loadElementwiseKernel") +
                    "(f.directory + \"/kernel" + std::to_string(entry->second) +
                    ".metallib\", *target" + (legacy || sum || matrix ? "" : signature) +
                    ");\n"
                    "if (!kernel) { " +
                    error("kernel.error()") + " }\nf." + kernel +
                    " = *kernel;\n"
                    "f." +
                    out + " = r." +
                    (matrix ? "matmul"
                     : sum  ? "reduceSum"
                            : "elementwise") +
                    "(task, " + activeGroup + ", f." + kernel + ", " +
                    (sum ? ref(left) : arguments) + ");\n" + admitted("f." + out));
    result.scalarTask = sum;
    return result;
  }
  Value numericKernel(ValueId id, const std::vector<Value> &args) {
    const auto &typed = node(id);
    const auto span = typed.span;
    if (const auto *literal = std::get_if<TensorLiteral>(&typed.operation)) {
      const auto rank = typed.type.shape.size();
      if (rank < 1 || rank > 2)
        reject(span, "the Metal source bridge requires rank-one or rank-two float32 tensors");
      const auto rows = typed.type.shape[0].constant.value();
      const auto columns = rank == 2 ? typed.type.shape[1].constant.value() : 0;
      const auto &elements = literal->elements;
      for (auto item : elements)
        if (!constantBits(item))
          reject(span, "Metal tensor literals require constant float32 numbers");
      auto out = field("m::Buffer");
      Value value{Value::Tensor, next - 1, false, 0, rows};
      value.rank = rank;
      if (rank == 2)
        value.width = columns;
      std::string data = "{ ";
      for (auto item : elements)
        data += std::to_string(*constantBits(item)) + "u,";
      data += " }";
      auto descriptor = rank == 1 ? "Float32Tensor<1> descriptor{allocation,allocation,0,{" +
                                        std::to_string(rows) + "},{1}};\n"
                                  : "Float32Tensor<2> descriptor{allocation,allocation,0,{" +
                                        std::to_string(rows) + "," + std::to_string(columns) +
                                        "},{" + std::to_string(columns) + ",1}};\n";
      steps.push_back(
          "static const std::array<std::uint32_t," + std::to_string(elements.size()) +
          "> data = " + data +
          ";\n"
          "auto *allocation=static_cast<float*>(task.context().allocate(data.size()*4));\n"
          "if(!allocation) {task.fault(2);return;}\n"
          "if(!data.empty()) std::memcpy(allocation,data.data(),data.size()*4);\n" +
          descriptor +
          "auto "
          "value=r.fromCpu(task.context(),descriptor.view());\ntask.context().release(allocation)"
          ";\n"
          "if(!value) {" +
          error("value.error()") + "}\nf." + out + "=*value;\n");
      return value;
    }
    if (const auto *shape = std::get_if<ShapeCheck>(&typed.operation)) {
      auto value = args.at(0);
      for (const auto &requirement : shape->requirements) {
        const auto first = steps.size();
        requireLength(value, requirement.extent, span, requirement.axis);
        if (value.failure)
          for (auto index = first; index < steps.size(); ++index)
            steps[index] =
                "if(" + failureRef(value) + ".kind==TaskFailure::None){\n" + steps[index] + "}\n";
        if (requirement.axis == 0)
          value.length = requirement.extent;
        else
          value.width = requirement.extent;
      }
      return value;
    }
    if (const auto *unary = std::get_if<TensorUnary>(&typed.operation))
      return hostOperation(unary->operation == TokenKind::Minus ? "neg" : "pos", args, span);
    if (const auto *binary = std::get_if<TensorBinary>(&typed.operation))
      return arithmetic(binary->operation, args, span);
    if (std::holds_alternative<ReduceSum>(typed.operation))
      return hostOperation("reduceSum", args, span);
    if (std::holds_alternative<Matmul>(typed.operation))
      return hostOperation("matmul", args, span);
    reject(span, "unsupported numerical continuation operation");
  }
  Value arithmetic(TokenKind operation, const std::vector<Value> &args, SourceSpan span) {
    if (operation != TokenKind::Plus && operation != TokenKind::Minus &&
        operation != TokenKind::Star && operation != TokenKind::Slash)
      reject(span, "inline float32 arithmetic supports only +, -, * and /");
    return hostOperation(operation == TokenKind::Plus    ? "+"
                         : operation == TokenKind::Minus ? "-"
                         : operation == TokenKind::Star  ? "*"
                                                         : "/",
                         args, span);
  }
  std::vector<std::string> plannedGroups;
  std::vector<std::size_t> plannedPC;
  struct GpuAwaitSite {
    std::size_t instruction, group;
  };
  std::vector<GpuAwaitSite> gpuAwaitSites;
  std::vector<Value> plannedParameters;
  Value lowerPlan(const continuation::Plan &plan, FunctionId entryId) {
    using namespace continuation;
    for (const auto &type : plan.slots)
      if (type.builtin == BuiltinValue::Numeric && type.element != NumericType::Float32)
        reject({}, "Metal supervisor frame storage currently requires float32");
    std::map<Slot, Value> values;
    std::map<Slot, unsigned> payloadWrites;
    std::map<std::size_t, std::size_t> joins;
    std::map<Slot, std::size_t> gpuCalls;
    for (std::size_t i = 0; i < plan.code.size(); ++i)
      if (plan.code[i].code == Code::Join)
        joins.emplace(plan.code[i].group, i);
    for (std::size_t i = 0; i < plan.groups; ++i)
      plannedGroups.push_back("f." + field("GroupHandle"));
    auto shape = [](Value &value, const ValueType &type) {
      value.gpu = type.device.has_value();
      value.device = type.device.value_or(0);
      if (type.tensor) {
        value.rank = type.shape.size();
        value.length = type.shape.at(0).constant;
        if (value.rank == 2)
          value.width = type.shape[1].constant;
      }
    };
    auto allocate = [&](Slot slot) {
      const auto &type = plan.slots.at(slot);
      Value value{type.task ? Value::Task : type.tensor ? Value::Tensor : Value::Scalar};
      shape(value, type);
      std::string storage = type.task ? "TaskHandle" : type.tensor ? "m::Buffer" : "float";
      if (type.builtin == BuiltinValue::Device) {
        value.kind = Value::Target;
      } else {
        if (type.builtin == BuiltinValue::TaskError) {
          value.kind = Value::Error;
          storage = "Failure";
        }
        if (type.builtin == BuiltinValue::FaultKind) {
          value.kind = Value::FaultKind;
          storage = "unsigned";
        }
        if (type.builtin == BuiltinValue::String) {
          value.kind = Value::Text;
          storage = "const char *";
        }
        field(storage);
        value.slot = next - 1;
      }
      value.scalarTask = type.task && !type.tensor;
      if (type.fallible) {
        field("Failure");
        value.failure = next - 1;
      }
      return value;
    };
    auto get = [&](Slot slot) -> Value {
      auto found = values.find(slot);
      if (found != values.end())
        return found->second;
      return values.emplace(slot, allocate(slot)).first->second;
    };
    auto payloadCopy = [](Value output, Value input) {
      return ref(output) + "=" + ref(input) + ";\n";
    };
    auto copy = [&](Value output, Value input) {
      auto code = payloadCopy(output, input);
      if (output.failure)
        code +=
            failureRef(output) + "=" + (input.failure ? failureRef(input) : "Failure{}") + ";\n";
      return code;
    };
    // Backend kernels can prove a result shape more precisely than its public
    // type. Carry those facts through values, but meet all payload-producing
    // branch writes rather than letting the last arm dictate a merge shape.
    auto write = [&](Slot slot, Value input) {
      auto output = get(slot);
      const auto &type = plan.slots.at(slot);
      if (type.tensor) {
        const bool first = payloadWrites[slot]++ == 0;
        output.length = type.shape[0].constant          ? type.shape[0].constant
                        : first                         ? input.length
                        : output.length == input.length ? output.length
                                                        : std::nullopt;
        if (output.rank == 2)
          output.width = type.shape[1].constant        ? type.shape[1].constant
                         : first                       ? input.width
                         : output.width == input.width ? output.width
                                                       : std::nullopt;
        values[slot] = output;
      }
      return output;
    };
    auto bind = [&](Slot slot, Value input) {
      auto found = values.find(slot);
      if (found != values.end()) {
        const auto output = write(slot, input);
        steps.push_back(copy(output, input));
      } else {
        auto length = input.length, width = input.width;
        shape(input, plan.slots.at(slot));
        if (input.kind == Value::Tensor || (input.kind == Value::Task && !input.scalarTask)) {
          if (!input.length)
            input.length = length;
          if (input.rank == 2 && !input.width)
            input.width = width;
        }
        values.emplace(slot, input);
        payloadWrites[slot] = 1;
      }
    };
    // Parameter storage belongs to the child frame. Declared fixed dimensions
    // are checked here; inferred operation guards stay inside their source scopes.
    const auto &fn = placement.functions.at(entryId);
    std::string guards;
    auto [line, column] = syntax.source->location(fn.declaration.begin);
    const auto fault =
        "{task.fault(1," + std::to_string(line) + "," + std::to_string(column) + ");return;}\n";
    for (std::size_t n = 0; n < plan.parameters.size(); ++n) {
      const auto parameter = get(plan.parameters[n]);
      plannedParameters.push_back(parameter);
      const auto &type = placement.symbols.at(fn.parameters[n]).type;
      for (std::size_t axis = 0; axis < type.shape.size(); ++axis) {
        const auto actual = ref(parameter) + ".shape()[" + std::to_string(axis) + "]";
        if (type.shape[axis].constant)
          guards +=
              "if(" + actual + "!=" + std::to_string(*type.shape[axis].constant) + ")" + fault;
      }
    }
    if (!guards.empty())
      steps.push_back(std::move(guards));
    for (std::size_t i = 0; i < plan.code.size(); ++i) {
      const auto &op = plan.code[i];
      plannedPC.push_back(steps.size() + 1);
      const auto span = node(op.source).span;
      std::vector<Value> args;
      for (auto slot : op.args)
        args.push_back(get(slot));
      switch (op.code) {
      case Code::Literal: {
        field("float");
        Value value{Value::Scalar, next - 1};
        const auto bits = std::get<Float32Literal>(node(op.source).operation).bits;
        steps.push_back(ref(value) + "=std::bit_cast<float>(std::uint32_t(" + std::to_string(bits) +
                        "u));\n");
        bind(op.output, value);
        break;
      }
      case Code::Unary: {
        field("float");
        Value value{Value::Scalar, next - 1};
        const bool neg =
            std::get<ScalarUnary>(node(op.source).operation).operation == TokenKind::Minus;
        steps.push_back(ref(value) + "=std::bit_cast<float>(std::bit_cast<std::uint32_t>(" +
                        ref(args[0]) + ") ^ " + (neg ? "0x80000000u" : "0u") + ");\n");
        bind(op.output, value);
        break;
      }
      case Code::Binary:
        bind(op.output,
             arithmetic(std::get<ScalarBinary>(node(op.source).operation).operation, args, span));
        break;
      case Code::Kernel:
        bind(op.output, numericKernel(op.source, args));
        break;
      case Code::Call:
        bind(op.output, cpuCall(cpuFunction(op.target, span), args, span));
        break;
      case Code::Device: {
        Value value{Value::Target};
        shape(value, plan.slots.at(op.output));
        bind(op.output, value);
        break;
      }
      case Code::Transfer:
      case Code::Spawn: {
        activeGroup = plannedGroups.at(op.group);
        admissionExit = joins.at(op.group);
        if (op.code == Code::Transfer)
          bind(op.output, transfer(args.at(0), args.at(1), span));
        else {
          if (!op.placement)
            reject(span, "mixed spawn requires a checked target");
          auto target = get(*op.placement);
          if (target.gpu)
            gpuCalls[op.output] = op.group;
          bind(op.output, resumable.at(op.target)
                              ? spawnHelper(op.target, args, target, span)
                              : spawn(cpuFunction(op.target, span), args, target, span));
        }
        break;
      }
      case Code::Open: {
        auto group = plannedGroups.at(op.group);
        steps.push_back(group + "=task.openGroup(" +
                        (op.target == SIZE_MAX ? "" : plannedGroups.at(op.target)) + ");\n" +
                        check(group));
        break;
      }
      case Code::Await: {
        auto output = write(op.output, args.at(0)), input = args.at(0);
        if (auto found = gpuCalls.find(op.args[0]); found != gpuCalls.end())
          gpuAwaitSites.push_back({i, found->second});
        steps.push_back("if(!task.await(" + ref(input) + ")) return;\n" + failureRef(output) +
                        "=task.failure(" + ref(input) + ");\nif(" + failureRef(output) +
                        ".kind==TaskFailure::None){\n" +
                        (input.scalarTask ? "if(!readScalar(task," : "if(!readBuffer(task,") +
                        ref(input) + "," + ref(output) + ")) return;\n}\n");
        break;
      }
      case Code::Try:
      case Code::Fail: {
        const auto failure = op.code == Code::Fail ? ref(args[0]) : failureRef(args[0]);
        std::string code =
            op.code == Code::Try ? "if(" + failure + ".kind!=TaskFailure::None){\n" : "{\n";
        if (op.group != SIZE_MAX)
          code += "task.failGroup(" + plannedGroups.at(op.group) + "," + failure + ");\n";
        else
          code += failureRef(get(op.target)) + "=" + failure + ";\n";
        code += jump(op.jump) + "}\n";
        if (op.code == Code::Try)
          code += copy(write(op.output, args[0]), args[0]);
        steps.push_back(std::move(code));
        break;
      }
      case Code::Copy:
        steps.push_back(copy(write(op.output, args.at(0)), args.at(0)));
        break;
      case Code::Catch: {
        auto output = write(op.output, args[0]), error = get(op.args[1]);
        steps.push_back("if(" + failureRef(args[0]) + ".kind==TaskFailure::None){\n" +
                        copy(output, args[0]) + jump(op.target) + "}\n" + ref(error) + "=" +
                        failureRef(args[0]) + ";\n" + jump(op.jump));
        break;
      }
      case Code::Branch:
        throw std::runtime_error("CPU Boolean branches are not supported by the Metal target");
      case Code::Case: {
        const auto subject = args.at(0);
        const auto tag =
            subject.kind == Value::Error ? "unsigned(" + ref(subject) + ".kind)" : ref(subject);
        steps.push_back("if(" + tag + "!=" + std::to_string(op.target) + "){\n" +
                        (op.jump == SIZE_MAX ? error("m::Error::Invalid") : jump(op.jump)) + "}\n");
        break;
      }
      case Code::Jump:
        steps.push_back(jump(op.jump));
        break;
      case Code::Field: {
        auto output = get(op.output);
        const auto subject = args.at(0);
        auto field = static_cast<ErrorField>(op.target);
        std::string code;
        if (field == ErrorField::Kind)
          code = ref(subject) + ".code==1 ? 3u : " + ref(subject) + ".code==2 ? 4u : 5u";
        else if (field == ErrorField::Message)
          code = ref(subject) + ".code==1 ? \"tensor shape mismatch\" : " + ref(subject) +
                 ".code==2 ? \"allocation failed\" : \"native execution fault\"";
        else
          code = "\"task admission rejected\"";
        steps.push_back(ref(output) + "=" + code + ";\n");
        break;
      }
      case Code::Join: {
        const auto group = plannedGroups.at(op.group);
        auto output = write(op.output, args.at(0));
        steps.push_back(check("task.close(" + group + ")"));
        steps.push_back("if(!task.join(" + group + ")) return;\n" + failureRef(output) +
                        "=task.failure(" + group + ");\nif(" + failureRef(output) +
                        ".kind==TaskFailure::None){\n" + payloadCopy(output, args.at(0)) + "}\n");
        break;
      }
      case Code::MapInit:
      case Code::MapCheck:
      case Code::MapLoad:
      case Code::MapStore:
      case Code::MapAdvance:
      case Code::MapSuccess:
      case Code::ReleaseGroup:
      case Code::CallableTarget:
      case Code::CallableCaptures:
      case Code::CallableSyncGuard:
      case Code::InvalidCallable:
      case Code::FunctionReference:
      case Code::FunctionInvoke:
      case Code::SynchronousCall:
        reject(span, "function values require the CPU backend");
      case Code::Label:
        break;
      case Code::Return: {
        auto result = args.at(0);
        steps.push_back((result.failure
                             ? "if(" + failureRef(result) + ".kind!=TaskFailure::None){task.fail(" +
                                   failureRef(result) + ");return;}\n"
                             : "") +
                        "task.complete(&" + ref(result) + ");return;\n");
        break;
      }
      }
    }
    // All edges address common plan instructions; close/join may use two target steps.
    for (auto &step : steps)
      for (std::size_t pos = 0; (pos = step.find("@pc", pos)) != std::string::npos;) {
        const auto end = step.find('@', pos + 3);
        const auto index = std::stoull(step.substr(pos + 3, end - pos - 3));
        step.replace(pos, end - pos + 1, std::to_string(plannedPC.at(index)));
      }
    return get(plan.result);
  }
  std::string helperPacket(FunctionId id) const {
    std::string code = "namespace " + helperName(id) +
                       " { struct PacketData { m::Runtime *runtime; const char *directory;";
    const auto &fn = placement.functions.at(id);
    for (std::size_t n = 0; n < fn.parameters.size(); ++n)
      code += std::string(placement.symbols.at(fn.parameters[n]).type.tensor ? "m::Buffer "
                                                                             : "float ") +
              "arg" + std::to_string(n) + ";";
    return code + "}; extern const TaskEntry entry; }\n";
  }
  std::string helperBody(FunctionId id) const {
    const auto &fn = placement.functions.at(id);
    std::ostringstream out;
    out << "namespace " << helperName(id)
        << " {\nstruct Frame {m::Runtime *runtime; std::string directory; unsigned pc=1;\n";
    for (const auto &field : fields)
      out << field << '\n';
    out << "};\nbool construct(Invocation &context,void *out,const Packet &packet){\n"
           "const auto &data=*static_cast<const PacketData*>(packet.data);\n"
           "if(!data.runtime || !data.directory";
    for (std::size_t n = 0; n < plannedParameters.size(); ++n) {
      const auto &type = placement.symbols.at(fn.parameters[n]).type;
      if (type.tensor) {
        auto arg = "data.arg" + std::to_string(n);
        out << " || !" << arg << " || " << arg << ".onDevice() || " << arg
            << ".format()!=m::Format::Float32 || " << arg
            << ".shape().size()!=" << type.shape.size();
      }
    }
    out << "){context.fault(3);return false;}\n"
           "auto &f=*new(out) Frame{data.runtime,data.directory}; (void)f;\n";
    for (std::size_t n = 0; n < plannedParameters.size(); ++n)
      out << ref(plannedParameters[n]) << "=data.arg" << n << ";\n";
    out << "return true;}\nvoid destroy(void *p) noexcept {static_cast<Frame*>(p)->~Frame();}\n"
           "void resume(Task &task){auto &f=*static_cast<Frame*>(task.frame()); auto "
           "&r=*f.runtime; (void)r;\n"
           "if(task.cancelled())return;\nfor(;;){switch(f.pc){\n";
    for (std::size_t i = 0; i < steps.size(); ++i)
      out << "case " << i + 1 << ": {\n"
          << steps[i] << "f.pc=" << i + 2 << ";\n} [[fallthrough]];\n";
    out << "default:task.fault(3);return;}}}\n"
           "const TaskEntry entry{1,"
        << 0x4b414c52534d0000ULL + id
        << "ull,sizeof(PacketData),alignof(PacketData),"
           "sizeof(Frame),alignof(Frame),construct,destroy,resume,&m::Runtime::"
        << (fn.resultType.tensor ? "bufferLayout" : "scalarLayout") << "()};\n}\n";
    return out.str();
  }
  std::string shader(std::size_t function, std::vector<std::uint32_t> *readInputs = nullptr) const {
    if (matrixFunction(function))
      return matmulShader;
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
    struct Instruction {
      std::string result, code;
      std::vector<std::string> operands;
    };
    std::vector<Instruction> instructions;
    std::unordered_map<std::string, std::size_t> definitions;
    std::unordered_map<std::string, std::uint32_t> tensorInputs;
    std::size_t counter = 0, callDepth = 0;
    std::set<std::size_t> active;
    auto temporary = [&] {
      if (counter >= 100000)
        reject({}, "GPU IR expansion limit exceeded");
      return "%v" + std::to_string(counter++);
    };
    std::function<std::string(std::size_t, const std::vector<std::string> &)> invoke;
    invoke = [&](std::size_t fnId, const std::vector<std::string> &args) -> std::string {
      const auto &fn = cpu.functions.at(fnId);
      for (auto parameter : fn.parameters)
        if (cpu.symbols[parameter].type.tensor && (cpu.symbols[parameter].type.shape.empty() ||
                                                   cpu.symbols[parameter].type.shape.size() > 2))
          reject(fn.declaration, "elementwise GPU helpers require rank-one or rank-two tensors");
      if (fn.resultType.tensor && (fn.resultType.shape.empty() || fn.resultType.shape.size() > 2))
        reject(fn.declaration, "elementwise GPU helpers require rank-one or rank-two results");
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
        std::ostringstream instruction;
        std::vector<std::string> operands;
        if (auto *read = std::get_if<SymbolRead>(&n.operation))
          result = symbols.at(read->symbol);
        else if (auto *literal = std::get_if<Float32Literal>(&n.operation)) {
          auto integer = temporary();
          result = temporary();
          instruction << "        " << integer << " = arith.constant "
                      << std::int32_t(literal->bits) << " : i32\n";
          instruction << "        " << result << " = arith.bitcast " << integer
                      << " : i32 to f32\n";
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

          if (operation != TokenKind::Plus && operation != TokenKind::Minus &&
              operation != TokenKind::Star && operation != TokenKind::Slash)
            reject(n.span, "GPU strict arithmetic currently supports only +, -, * and /");
          auto a = emit(left), b = emit(right);
          result = temporary();
          operands = {a, b};
          instruction << "        " << result << " = arith."
                      << (operation == TokenKind::Plus    ? "addf "
                          : operation == TokenKind::Minus ? "subf "
                          : operation == TokenKind::Slash ? "divf "
                                                          : "mulf ")
                      << a << ", " << b << " : f32\n";
        } else if (std::holds_alternative<ScalarUnary>(n.operation) ||
                   std::holds_alternative<TensorUnary>(n.operation)) {
          const auto op = std::holds_alternative<ScalarUnary>(n.operation)
                              ? std::get<ScalarUnary>(n.operation).operation
                              : std::get<TensorUnary>(n.operation).operation;
          const auto input = std::holds_alternative<ScalarUnary>(n.operation)
                                 ? std::get<ScalarUnary>(n.operation).operand
                                 : std::get<TensorUnary>(n.operation).operand;
          result = emit(input);
          if (op == TokenKind::Minus) {
            auto operand = result;
            result = temporary();
            operands = {operand};
            instruction << "        " << result << " = arith.negf " << operand << " : f32\n";
          } else if (op != TokenKind::Plus)
            reject(n.span, "GPU unary arithmetic is not implemented");
        } else if (auto *check = std::get_if<ShapeCheck>(&n.operation)) {
          // Straight-line helper checks become the entry's transitive shape
          // preconditions, validated on the host before kernel admission.
          result = emit(check->input);
        } else if (auto *call = std::get_if<FunctionCall>(&n.operation)) {
          std::vector<std::string> inputs;
          for (auto arg : call->arguments)
            inputs.push_back(emit(arg));
          result = invoke(call->function, inputs);
        } else
          reject(n.span, "unsupported GPU operation in a transitive helper");
        auto emitted = instruction.str();
        if (!emitted.empty()) {
          definitions.emplace(result, instructions.size());
          instructions.push_back({result, std::move(emitted), std::move(operands)});
        }
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
    for (auto parameter : cpu.functions[function].parameters) {
      if (cpu.symbols[parameter].type.tensor) {
        auto lane = "%lane" + std::to_string(tensors);
        tensorInputs.emplace(lane, tensors++);
        args.push_back(lane);
      } else
        args.push_back("%scalar" + std::to_string(scalars++));
    }
    auto result = invoke(function, args);
    std::set<std::uint32_t> used;
    std::set<std::string> live;
    // Iterative traversal bounds compiler stack even for a long left-associated expression.
    std::vector<std::string> pending{result};
    while (!pending.empty()) {
      auto value = std::move(pending.back());
      pending.pop_back();
      if (!live.insert(value).second)
        continue;
      if (auto input = tensorInputs.find(value); input != tensorInputs.end())
        used.insert(input->second);
      else if (auto definition = definitions.find(value); definition != definitions.end())
        for (const auto &operand : instructions[definition->second].operands)
          pending.push_back(operand);
    }
    if (!kalandra::runtime::metal::indirectElementwiseLayout(used.size(), scalars))
      reject(cpu.functions[function].declaration,
             "GPU argument binding representation limit exceeded");
    if (readInputs)
      readInputs->assign(used.begin(), used.end());
    std::ostringstream code;
    for (const auto &instruction : instructions)
      if (live.contains(instruction.result))
        code << instruction.code;
    const bool indirect = !kalandra::runtime::metal::directElementwiseLayout(used.size(), scalars);
    const bool legacy = !indirect && tensors == 2 && scalars == 0 && used.size() == tensors;
    auto parameters = "memref<" + std::to_string(legacy ? 2 : scalars + 1) + "xi32>";
    std::string bindings, loads;
    for (auto input : used) {
      auto buffer = "%a" + std::to_string(input), lane = "%lane" + std::to_string(input);
      bindings += buffer + ": memref<?xf32>, ";
      loads += "        " + lane + " = memref.load " + buffer + "[%i] : memref<?xf32>\n";
    }
    for (unsigned i = 0; i < scalars; ++i) {
      auto suffix = std::to_string(i);
      loads +=
          "        %index" + suffix + " = arith.constant " + std::to_string(i + 1) + " : index\n";
      loads += "        %bits" + suffix + " = memref.load %parameters[%index" + suffix +
               "] : " + parameters + "\n";
      loads += "        %scalar" + suffix + " = arith.bitcast %bits" + suffix + " : i32 to f32\n";
    }
    return R"(module attributes {gpu.container_module,
  spirv.target_env = #spirv.target_env<#spirv.vce<v1.0, [Shader, Int64], [SPV_KHR_storage_buffer_storage_class]>, #spirv.resource_limits<>>} {
  gpu.module @kernels {
    gpu.func @)" +
           std::string(indirect ? "kalandra_elementwise_v3"
                       : legacy ? "kalandra_elementwise"
                                : "kalandra_elementwise_v2") +
           "(" + bindings + "%out: memref<?xf32>, %parameters: " + parameters + R"()
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
    auto checkedPlacement = kalandra::check({syntax, {}}, {}, {.placement = true});
    if (!checkedPlacement.ok())
      throw Rejected{checkedPlacement.diagnostics.front()};
    placement = std::move(*checkedPlacement.module);
    resumable = continuation::resumableFunctions(placement);
    Module hostModule = syntax;
    hostModule.functions.clear();
    std::optional<std::size_t> main;
    for (std::size_t i = 0; i < syntax.functions.size(); ++i) {
      const auto &fn = syntax.functions[i];
      auto name = placement.functions.at(i).name;
      if (fn.moduleIndex == 0 && name == "main") {
        main = i;
        continue;
      }
      if (name == "devices" || name == "tensor" || name == "transfer")
        reject(fn.name, "this GPU source slice reserves standard placement/transfer names");
      if (!fn.result)
        reject(fn.span, "mixed source functions require an explicit result");
      if (fn.result->tensor)
        tensorType(*fn.result);
      else if (text(fn.result->name) != "float32")
        reject(fn.result->span,
               "mixed source results require float32 or rank-one/rank-two float32 tensors");
      for (const auto &p : fn.parameters) {
        if (p.type.tensor)
          tensorType(p.type);
        else if (text(p.type.name) != "float32")
          reject(p.type.span,
                 "mixed source parameters require float32 or rank-one/rank-two float32 tensors");
      }
      if (resumable[i])
        continue;
      cpuFunctions.emplace(name, hostModule.functions.size());
      cpuExports.push_back(name);
      hostModule.functions.push_back(fn);
    }
    if (!main)
      reject({}, "missing main");
    // The CPU bridge contains only synchronous helpers. Remove imports of
    // coordinating functions from this projection too; their original resolved
    // identities remain in the placement module and continuation plan.
    using Binding = std::pair<std::size_t, std::string>;
    std::map<Binding, FunctionId> exportedFunctions;
    std::map<Binding, Binding> reexports;
    for (FunctionId i = 0; i < syntax.functions.size(); ++i) {
      const auto &fn = syntax.functions[i];
      if (fn.exported)
        exportedFunctions.emplace(Binding{fn.moduleIndex, text(fn.name)}, i);
    }
    for (const auto &import : syntax.imports)
      if (import.exported && import.target)
        for (const auto &name : import.names)
          reexports.emplace(Binding{import.moduleIndex, text(name.alias.value_or(name.name))},
                            Binding{*import.target, text(name.name)});
    auto projectedAway = [&](Binding binding) {
      // loadModules already rejects cycles and bounds graph depth. Keep this
      // traversal explicitly bounded as the compiler also has in-memory callers.
      for (std::size_t depth = 0; depth <= syntax.imports.size(); ++depth) {
        if (auto found = exportedFunctions.find(binding); found != exportedFunctions.end())
          return found->second == *main || resumable[found->second];
        auto next = reexports.find(binding);
        if (next == reexports.end())
          return false;
        binding = next->second;
      }
      reject({}, "cyclic module re-export in CPU projection");
    };
    for (auto &import : hostModule.imports)
      std::erase_if(import.names, [&](const ImportedName &name) {
        return import.target && projectedAway({*import.target, text(name.name)});
      });
    std::erase_if(hostModule.imports, [](const Import &import) { return import.names.empty(); });
    auto checked = kalandra::check({std::move(hostModule), {}});
    if (!checked.ok())
      throw Rejected{checked.diagnostics.front()};
    cpu = std::move(*checked.module);
    for (const auto &symbol : cpu.symbols)
      observeExtents(symbol.type);
    for (const auto &expression : cpu.expressions)
      observeExtents(expression.type);
    for (const auto &function : cpu.functions) {
      observeExtents(function.resultType);
      if (function.declaredResult)
        observeExtents(*function.declaredResult);
      for (const auto &requirement : function.preconditions) {
        hostExtent = std::max(hostExtent, requirement.left.identity);
        hostExtent = std::max(hostExtent, requirement.right.identity);
      }
    }
    for (std::size_t i = 0; i < cpu.functions.size(); ++i)
      declareCpuFunction(i);
    const auto &fn = syntax.functions[*main];
    if (!fn.parameters.empty() || !fn.result || !fn.taskError)
      reject(fn.span,
             "Metal main requires no parameters, a float32 or tensor result, and ! TaskError");
    bool scalarResult = !fn.result->tensor;
    if (scalarResult && text(fn.result->name) != "float32")
      reject(fn.span, "Metal main requires float32 or a rank-one/rank-two float32 tensor");
    if (!scalarResult)
      tensorType(*fn.result);
    auto planned = continuation::plan(placement, {.preserveCalls = true, .entry = *main});
    if (!planned)
      reject(fn.span, planned.error());
    auto result = lowerPlan(*planned->plans[*main], *main);
    (void)result;
    // Compile each reachable resumable child once. Keep the main frame's state
    // separate while numeric exports and shader entries remain module-wide.
    auto mainFields = std::move(fields), mainSteps = std::move(steps),
         mainGroups = std::move(plannedGroups);
    auto mainPC = std::move(plannedPC);
    auto mainSites = std::move(gpuAwaitSites);
    auto mainParameters = std::move(plannedParameters);
    const auto mainNext = next;
    std::string helperDeclarations, helperBodies;
    for (FunctionId id = 0; id < planned->plans.size(); ++id) {
      if (id == *main || planned->plans[id]->code.empty())
        continue;
      fields.clear();
      steps.clear();
      plannedGroups.clear();
      plannedPC.clear();
      gpuAwaitSites.clear();
      plannedParameters.clear();
      next = 0;
      activeGroup.clear();
      admissionExit.reset();
      lowerPlan(*planned->plans[id], id);
      helperDeclarations += helperPacket(id);
      helperBodies += helperBody(id);
    }
    fields = std::move(mainFields);
    steps = std::move(mainSteps);
    plannedGroups = std::move(mainGroups);
    plannedPC = std::move(mainPC);
    gpuAwaitSites = std::move(mainSites);
    plannedParameters = std::move(mainParameters);
    next = mainNext;
    if (entries.empty())
      reject(fn.span, "no GPU placement in source");
    std::map<std::string, std::string> outputs;
    outputs["placement.ir"] = dumpTypedIR(placement);
    outputs["continuation.plan"] = continuation::dump(*planned);
    for (auto [function, index] : entries) {
      auto base = "kernel" + std::to_string(index);
      outputs[base + ".mlir"] = shader(function);
      if (matrixFunction(function)) {
        outputs[base + "-rows2.mlir"] = matmulRows2Shader;
        outputs[base + "-quad.mlir"] = matmulQuadShader;
      }
    }
    mlir::DialectRegistry registry;
    mlir::registerAllDialects(registry);
    mlir::MLIRContext context(registry);
    for (auto &[name, ir] : outputs) {
      if (!name.ends_with(".mlir"))
        continue;
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
 )" << declarations
         << helperDeclarations << cpuEntries;
    if (scalarResult)
      host << "const ValueLayout &scalarLayout=m::Runtime::scalarLayout();\n";
    host << R"(struct PacketData { m::Runtime *runtime; const char *directory; };
struct Frame { m::Runtime *runtime; std::string directory; unsigned pc=1;
)";
    for (auto &f : fields)
      host << "  " << f << '\n';
    host << "};\nstruct GpuAwaitSite { unsigned pc; std::size_t group; };\n";
    host << "[[maybe_unused]] constexpr std::array<GpuAwaitSite," << gpuAwaitSites.size()
         << "> gpuAwaitSites{{";
    for (auto site : gpuAwaitSites)
      host << "{" << plannedPC.at(site.instruction) << "," << site.group << "},";
    host
        << "}};\ninline GroupHandle continuationGroup(const Frame &f,std::size_t id){switch(id){\n";
    for (std::size_t i = 0; i < plannedGroups.size(); ++i)
      host << "case " << i << ":return " << plannedGroups[i] << ";\n";
    host << "default:return {};}}\n";
    host << R"(bool construct(Invocation &, void *out, const Packet &p) {
  auto &data=*static_cast<const PacketData *>(p.data);
  new(out) Frame{data.runtime,data.directory}; return true;
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
  for (;;) { switch(f.pc) {
)";
    for (std::size_t i = 0; i < steps.size(); ++i)
      host << "case " << i + 1 << ": {\n"
           << steps[i] << "f.pc=" << i + 2 << ";\n} [[fallthrough]];\n";
    host << "default: task.fault(3); return;\n} }\n}\n";
    host
        << R"(const TaskEntry entry{1,0x4b414c47505501,sizeof(PacketData),alignof(PacketData),sizeof(Frame),alignof(Frame),construct,destroy,resume,)"
        << (scalarResult ? "&scalarLayout" : "&m::Runtime::bufferLayout()") << "};\n"
        << helperBodies << R"(int main(int argc,char **argv) {
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
    auto cpu=runtime->toCpu<)"
           << fn.result->dimensions.size() << R"(>(context,*value);
    if (!cpu) status=1;
    else { std::printf("["); for (std::uint64_t i=0;i<value->bytes()/4;++i) {
      std::uint32_t bits; std::memcpy(&bits,cpu->aligned+i,4); std::printf(i ? ",%08x" : "%08x",bits);
    } std::puts("]"); context.release(cpu->allocated); }
    value->~Buffer();)";
    host << R"(
  }
  core->close(group); if (!core->drain() || !core->release(group)) return 1;
  auto s=runtime->stats(); auto t=core->stats();
  if (s.bytes || s.metalBuffers || s.hostBackings || s.deviceBackings || s.inFlight || s.stagingBuffers || s.argumentBytes || s.argumentPacks || t.records || t.groups || t.externalPending || t.retainedBytes) return 1;
  return status;
}
)";
    outputs["host.cpp"] = host.str();
    std::string manifest = "kernel_count=" + std::to_string(entries.size()) + "\n";
    for (auto [function, index] : entries) {
      if (reduction(function) || matrixFunction(function))
        continue;
      unsigned tensors = 0, scalars = 0;
      std::string order;
      for (auto parameter : cpu.functions[function].parameters) {
        const auto &type = cpu.symbols[parameter].type;
        if (!order.empty())
          order += ",";
        if (type.tensor) {
          ++tensors;
          order += "tensor" + std::to_string(type.shape.size());
        } else {
          ++scalars;
          order += "float32";
        }
      }
      auto prefix = "kernel" + std::to_string(index) + ".";
      std::vector<std::uint32_t> reads;
      shader(function, &reads);
      std::string bindings;
      for (auto input : reads)
        bindings += (bindings.empty() ? "" : ",") + std::to_string(input);
      manifest += prefix + "binding_layout=" +
                  (kalandra::runtime::metal::directElementwiseLayout(reads.size(), scalars)
                       ? "direct"
                       : "argument_buffer_tier2") +
                  "\n";
      manifest += prefix + "tensor_bindings=" + bindings + "\n";
      manifest += prefix + "tensors=" + std::to_string(tensors) + "\n" + prefix +
                  "scalars=" + std::to_string(scalars) + "\n" + prefix + "source_order=" + order +
                  "\n";
    }
    outputs["manifest.txt"] = std::move(manifest);
    return outputs;
  }
};
} // namespace
int kalandra::compileMetalCommand(int argc, char **argv) {
  const auto usage = [] {
    std::cerr << "usage: kalandra-metal-source <source.k | --project manifest.toml> -o directory "
                 "[--package name=path.k ...] [--build [-O0|-O2|--sanitize|--thread-sanitize]]\n";
    return 2;
  };
  bool build = false;
  std::string variant = "debug", sourcePath, projectPath;
  std::filesystem::path directory;
  std::optional<NativeProject> project;
  std::vector<ModulePackage> packages;
  bool selected = false;
  for (int i = 1; i < argc; ++i) {
    std::string_view option = argv[i];
    if (option == "-o" || option == "--project" || option == "--package") {
      if (++i >= argc || std::string_view(argv[i]).empty())
        return usage();
      if (option == "-o") {
        if (!directory.empty())
          return usage();
        directory = argv[i];
      } else if (option == "--project") {
        if (!projectPath.empty())
          return usage();
        projectPath = argv[i];
      } else {
        auto package = parseModulePackage(argv[i]);
        if (!package) {
          std::cerr << package.error() << '\n';
          return 2;
        }
        packages.push_back(std::move(*package));
      }
    } else if (option == "--build" && !build)
      build = true;
    else if (!selected && (option == "-O0" || option == "-O2" || option == "--sanitize" ||
                           option == "--thread-sanitize")) {
      selected = true;
      variant = option == "-O2"          ? "optimized"
                : option == "--sanitize" ? "sanitized"
                : option == "-O0"        ? "debug"
                                         : "thread-sanitized";
    } else if (!option.starts_with('-') && sourcePath.empty())
      sourcePath = option;
    else
      return usage();
  }
  if (directory.empty() || (selected && !build) || (!sourcePath.empty() && !projectPath.empty()))
    return usage();
  if (!projectPath.empty()) {
    auto loaded = loadNativeProject(projectPath);
    if (!loaded) {
      std::cerr << loaded.error() << '\n';
      return 1;
    }
    project = std::move(*loaded);
    sourcePath = project->entry;
    packages.insert(packages.end(), project->packages.begin(), project->packages.end());
  }
  if (sourcePath.empty())
    return usage();
  auto parsed = loadModules(sourcePath, {}, {}, packages);
  if (!parsed) {
    std::cerr << parsed.error() << '\n';
    return 1;
  }
  auto source = parsed->module.source;
  try {
    if (!parsed->ok()) {
      for (auto &d : parsed->diagnostics)
        std::cerr << renderDiagnostic(*source, d);
      return 1;
    }
    auto outputs = Compiler(std::move(parsed->module)).run();
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
      auto protect = [&](const std::filesystem::path &input) {
        std::error_code first, second;
        const bool equivalent = std::filesystem::equivalent(target, input, ec);
        const auto a = std::filesystem::weakly_canonical(target, first);
        const auto b = std::filesystem::weakly_canonical(input, second);
        if (equivalent || (!first && !second && a == b))
          throw std::runtime_error("source and output paths must be distinct");
      };
      protect(source->path());
      for (const auto &part : source->parts())
        protect(part.source->path());
      if (project)
        protect(project->manifest);
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
    std::cerr << renderDiagnostic(*source, e.diagnostic);
  } catch (const std::exception &e) {
    std::cerr << "Metal source compilation: " << e.what() << '\n';
  }
  return 1;
}
