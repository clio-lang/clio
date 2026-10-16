#include "../metal/ElementwiseLayout.h"
#include "Build.h"
#include "MatmulShader.h"
#include "MatmulTiles.h"
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
#include <tuple>
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
  unsigned rank = 1;
  std::optional<std::uint64_t> width = {};
};
class Compiler {
  Module syntax;
  std::map<std::string, std::size_t> cpuFunctions;
  TypedModule cpu;
  std::vector<std::string> cpuExports;
  std::string declarations, cpuEntries;
  std::size_t cpuEntryCount = 0;
  // Admit the placed function's typed closure, not CPU expressions used to
  // compute its arguments. CPU-only functions may keep fixed shape signatures.
  void admitGpuTypes(FunctionId root) const {
    std::set<FunctionId> visited;
    std::vector<FunctionId> pending{root};
    while (!pending.empty()) {
      auto function = pending.back();
      pending.pop_back();
      if (!visited.insert(function).second)
        continue;
      const auto &fn = cpu.functions[function];
      auto dynamic = [&](const ValueType &type) {
        for (const auto &axis : type.shape)
          if (axis.constant)
            reject(fn.declaration,
                   "GPU tensor parameters/results currently require dynamic extents");
      };
      if (fn.declaredResult)
        dynamic(*fn.declaredResult);
      for (auto parameter : fn.parameters)
        dynamic(cpu.symbols[parameter].type);
      for (auto value : fn.expressions)
        if (auto *call = std::get_if<FunctionCall>(&cpu.expressions[value].operation))
          pending.push_back(call->function);
    }
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
  static std::optional<std::uint64_t> extent(const Value &value, unsigned axis) {
    return axis == 0 ? value.length : value.width;
  }
  std::optional<std::uint64_t> tensorType(const TypeSyntax &t, bool dynamicOnly = false) const {
    if (!t.tensor || !t.element || text(*t.element) != "float32" || t.dimensions.empty() ||
        t.dimensions.size() > 2)
      reject(t.span, "the Metal source bridge requires rank-one or rank-two float32 tensors");
    std::uint64_t count = 1;
    bool allKnown = true, empty = false;
    for (const auto &d : t.dimensions) {
      if (dynamicOnly && d.extent)
        reject(t.span, "GPU tensor parameters/results currently require dynamic extents");
      if (d.extent && *d.extent > std::uint64_t(INT64_MAX) / 4)
        reject(t.span, "tensor extent exceeds the checked allocation range");
      allKnown &= d.extent.has_value();
      empty |= d.extent && *d.extent == 0;
    }
    if (allKnown && !empty)
      for (const auto &d : t.dimensions) {
        if (*d.extent > std::uint64_t(INT64_MAX) / 4 / count)
          reject(t.span, "tensor shape exceeds the checked allocation range");
        count *= *d.extent;
      }
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
  bool reduction(std::size_t function) const {
    const auto &fn = cpu.functions[function];
    if (fn.resultType.tensor || fn.parameters.size() != 1 ||
        (cpu.symbols[fn.parameters[0]].type.shape.size() != 1 &&
         cpu.symbols[fn.parameters[0]].type.shape.size() != 2) ||
        fn.body.size() != 1 || fn.body[0].binding)
      return false;
    auto *sum = std::get_if<ReduceSum>(&cpu.expressions[fn.result].operation);
    if (!sum || sum->order != ReductionOrder::BalancedAdjacent || !sum->rowMajor)
      return false;
    auto *input = std::get_if<SymbolRead>(&cpu.expressions[sum->input].operation);
    return input && input->symbol == fn.parameters[0];
  }
  bool matrixFunction(std::size_t function) const {
    const auto &fn = cpu.functions[function];
    if (!fn.resultType.tensor || fn.resultType.shape.size() != 2 || fn.parameters.size() != 2 ||
        fn.body.size() != 1 || fn.body[0].binding)
      return false;
    if (cpu.symbols[fn.parameters[0]].type.shape.size() != 2 ||
        cpu.symbols[fn.parameters[1]].type.shape.size() != 2)
      return false;
    auto *product = std::get_if<Matmul>(&cpu.expressions[fn.result].operation);
    if (!product || product->order != ReductionOrder::BalancedAdjacent ||
        !product->separatelyRoundedProducts)
      return false;
    auto *left = std::get_if<SymbolRead>(&cpu.expressions[product->left].operation);
    auto *right = std::get_if<SymbolRead>(&cpu.expressions[product->right].operation);
    return left && right && left->symbol == fn.parameters[0] && right->symbol == fn.parameters[1];
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
    steps.push_back(prefix + "Packet packet{" + captures + "};\nf." + taskField +
                    "=task.spawn(f.group," + prefix + "Entry,{" + prefix +
                    "Entry.packetLayout,&packet,sizeof(packet),&task.context()});\n" +
                    check("f." + taskField));
    value.kind = Value::Task;
    value.scalarTask = !tensorResult;
    value.slot = next - 1;
    tasks.insert(value.slot);
    return value;
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
    if (const auto *binary = std::get_if<BinaryExpr>(&node(id).value)) {
      const auto operation = binary->operation;
      if (operation != TokenKind::Plus && operation != TokenKind::Minus &&
          operation != TokenKind::Star && operation != TokenKind::Slash)
        reject(span, "inline float32 arithmetic supports only +, -, * and /");
      auto left = expression(binary->left);
      auto right = expression(binary->right);
      return hostOperation(operation == TokenKind::Plus    ? "+"
                           : operation == TokenKind::Minus ? "-"
                           : operation == TokenKind::Star  ? "*"
                                                           : "/",
                           {left, right}, span);
    }
    if (const auto *unary = std::get_if<UnaryExpr>(&node(id).value)) {
      // Literal signs retain their existing contextual bit parsing; non-literals
      // use the same checked unary operation as ordinary CPU functions.
      auto operand = unary->operand;
      while (const auto *nested = std::get_if<UnaryExpr>(&node(operand).value))
        operand = nested->operand;
      if (!std::holds_alternative<NumberExpr>(node(operand).value)) {
        if (unary->operation != TokenKind::Plus && unary->operation != TokenKind::Minus)
          reject(span, "unsupported inline unary arithmetic");
        auto input = expression(unary->operand);
        return hostOperation(unary->operation == TokenKind::Minus ? "neg" : "pos", {input}, span);
      }
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
        tensorType(*annotation);
        if (call->arguments.size() != 1)
          reject(span, "tensor requires one literal");
        auto *array = std::get_if<ArrayExpr>(&node(call->arguments[0]).value);
        if (!array || array->elements.size() > 200000)
          reject(span, "expected a bounded tensor literal");
        const unsigned rank = annotation->dimensions.size();
        const auto rows = array->elements.size();
        std::size_t columns = rank == 1 ? 0 : annotation->dimensions[1].extent.value_or(0);
        std::vector<ExprId> elements;
        if (rank == 1)
          elements = array->elements;
        else
          for (std::size_t i = 0; i < rows; ++i) {
            auto *row = std::get_if<ArrayExpr>(&node(array->elements[i]).value);
            if (!row)
              reject(span, "rank-two tensor literals require nested rows");
            if (i == 0 && !annotation->dimensions[1].extent)
              columns = row->elements.size();
            if (row->elements.size() != columns)
              reject(span, "tensor literal row widths differ");
            if (elements.size() + row->elements.size() > 200000)
              reject(span, "tensor literal element limit exceeded");
            elements.insert(elements.end(), row->elements.begin(), row->elements.end());
          }
        if (annotation->dimensions[0].extent && *annotation->dimensions[0].extent != rows)
          reject(span, "tensor literal shape mismatch");
        if (rank == 2 && annotation->dimensions[1].extent &&
            *annotation->dimensions[1].extent != columns)
          reject(span, "tensor literal shape mismatch");
        auto out = field("m::Buffer");
        Value value{Value::Tensor, next - 1, false, 0, rows};
        value.rank = rank;
        if (rank == 2)
          value.width = columns;
        std::string data = "{ ";
        for (auto item : elements)
          data += std::to_string(bits(item)) + "u,";
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
        result.rank = input.rank;
        result.width = input.width;
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
        const auto function = found->second;
        std::vector<Value> inputs;
        for (auto argument : call->arguments)
          inputs.push_back(expression(argument));
        return cpuCall(function, inputs, span);
      }
      if (name == "reduceSum" || name == "matmul") {
        std::vector<Value> inputs;
        for (auto argument : call->arguments)
          inputs.push_back(expression(argument));
        return hostOperation(name, inputs, span);
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
        const auto *call = std::get_if<CallExpr>(&node(task->operand).value);
        if (!call)
          reject(span, "spawn requires a named function call");
        auto name = named(call->callee);
        auto found = cpuFunctions.find(name);
        if (found == cpuFunctions.end() || locals.contains(name) || name == "main")
          reject(span, "unknown or shadowed task function");
        const auto function = found->second;
        if (call->arguments.size() != cpu.functions[function].parameters.size())
          reject(span, "task call argument count mismatch");
        std::vector<Value> inputs;
        for (auto argument : call->arguments)
          inputs.push_back(expression(argument));
        auto target = task->placement ? expression(*task->placement) : Value{Value::Target};
        if (target.kind != Value::Target)
          reject(span, "task placement requires a device target");
        if (!target.gpu)
          return cpuCall(function, inputs, span, false, true);
        admitGpuTypes(function);
        const auto &entryFunction = cpu.functions[function];
        const bool sum = reduction(function);
        const bool matrix = matrixFunction(function);
        if (!entryFunction.resultType.tensor && !sum)
          reject(span,
                 "GPU scalar entries currently require a direct reduceSum of one tensor parameter");
        std::vector<Value> tensors, scalars;
        for (std::size_t i = 0; i < inputs.size(); ++i) {
          const auto &value = inputs[i];
          const auto &type = cpu.symbols[entryFunction.parameters[i]].type;
          const bool tensor = type.tensor;
          if (value.kind != (tensor ? Value::Tensor : Value::Scalar))
            reject(node(call->arguments[i]).span, "GPU argument type mismatch");
          if (tensor && value.rank != type.shape.size())
            reject(span, "GPU tensor ranks must match their parameters");
          (tensor ? tensors : scalars).push_back(value);
        }
        if (tensors.empty())
          reject(span, "elementwise GPU entries currently require at least one tensor input");
        if (tensors.size() > UINT32_MAX || scalars.size() >= UINT32_MAX)
          reject(span, "GPU argument representation limit exceeded");
        std::vector<std::uint32_t> reads;
        if (!sum && !matrix)
          shader(found->second, &reads);
        else
          for (std::size_t i = 0; i < tensors.size(); ++i)
            reads.push_back(i);
        for (auto value : tensors)
          if (!value.gpu || value.device != target.device)
            reject(span, "GPU arguments must be explicitly transferred to the selected device");
        auto left = tensors[reads.front()], right = tensors.back();
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
            reject(span, matrix ? "matmul inner dimensions differ"
                                : "elementwise argument shapes differ");
          if (!aExtent || !bExtent) {
            auto [line, column] = syntax.source->location(span.begin);
            steps.push_back("if(" + ref(tensors[a]) + ".shape()[" + std::to_string(axisA) +
                            "]!=" + ref(tensors[b]) + ".shape()[" + std::to_string(axisB) +
                            "]) {task.fault(1," + std::to_string(line) + "," +
                            std::to_string(column) + ");return;}\n");
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
        auto [entry, inserted] = entries.emplace(found->second, entries.size());
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
                        "(task, f.group, f." + kernel + ", " + (sum ? ref(left) : arguments) +
                        ");\n" + check("f." + out));
        result.scalarTask = sum;
        tasks.insert(result.slot);
        return result;
      }
      reject(span, "task results must be observed with try await");
    }
    reject(span, "unsupported expression in the Metal source supervisor");
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
    std::set<std::string> names;
    for (const auto &fn : syntax.functions)
      if (!names.insert(text(fn.name)).second)
        reject(fn.name, "duplicate function");
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
          tensorType(*s.annotation);
          if (result.rank != s.annotation->dimensions.size())
            reject(s.span, "tensor annotation rank mismatch");
          for (unsigned axis = 0; axis < result.rank; ++axis)
            if (auto wanted = s.annotation->dimensions[axis].extent) {
              requireLength(result, *wanted, s.span, axis);
              if (axis == 0)
                result.length = wanted;
              else
                result.width = wanted;
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
    if (!scalarResult) {
      if (result.rank != fn.result->dimensions.size())
        reject(fn.span, "main tensor result rank mismatch");
      for (unsigned axis = 0; axis < result.rank; ++axis)
        if (auto wanted = fn.result->dimensions[axis].extent)
          requireLength(result, *wanted, fn.span, axis);
    }
    for (auto task : tasks)
      if (!observed.contains(task))
        reject(fn.span, "every admitted child task must be observed with try await");
    if (entries.empty())
      reject(fn.span, "no GPU placement in source");
    std::map<std::string, std::string> outputs;
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
 )" << declarations
         << cpuEntries;
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
