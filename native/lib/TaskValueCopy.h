#pragma once
#include "kalandra/Semantics.h"
namespace llvm {
class GlobalVariable;
class Module;
} // namespace llvm
namespace kalandra {
// Private compiler component entry: emit the production task value layout and
// its copy callbacks without source/continuation admission or task entry setup.
// Only non-callable storage is supported here; callable layouts require task
// entry linkage. The module must already use the checked invocation ABI.
llvm::GlobalVariable *emitTaskValueLayout(const TypedModule &, llvm::Module &, const ValueType &);
} // namespace kalandra
