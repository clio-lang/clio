#include "kalandra/StrictFloat.h"
#include "mlir/Dialect/Arith/IR/Arith.h"
#include "mlir/Dialect/SCF/IR/SCF.h"
#include "mlir/IR/Builders.h"
#include "mlir/IR/BuiltinTypes.h"
#include "mlir/IR/TypeUtilities.h"

namespace kalandra {
namespace {
using namespace mlir;
class IntegerFloat {
  OpBuilder b;
  Location loc;
  Value c(std::uint64_t n, unsigned width = 64) {
    return arith::ConstantIntOp::create(b, loc, n, width);
  }
  Value add(Value x, Value y) { return arith::AddIOp::create(b, loc, x, y); }
  Value sub(Value x, Value y) { return arith::SubIOp::create(b, loc, x, y); }
  Value bitAnd(Value x, Value y) { return arith::AndIOp::create(b, loc, x, y); }
  Value bitOr(Value x, Value y) { return arith::OrIOp::create(b, loc, x, y); }
  Value shl(Value x, Value y) { return arith::ShLIOp::create(b, loc, x, y); }
  Value shr(Value x, Value y) { return arith::ShRUIOp::create(b, loc, x, y); }
  Value cmp(arith::CmpIPredicate p, Value x, Value y) {
    return arith::CmpIOp::create(b, loc, p, x, y);
  }
  Value eq(Value x, Value y) { return cmp(arith::CmpIPredicate::eq, x, y); }
  Value lt(Value x, Value y) { return cmp(arith::CmpIPredicate::ult, x, y); }
  Value slt(Value x, Value y) { return cmp(arith::CmpIPredicate::slt, x, y); }
  Value choose(Value p, Value x, Value y) { return arith::SelectOp::create(b, loc, p, x, y); }
  Value all(Value x, Value y) { return bitAnd(x, y); }
  Value wide(Value x) { return arith::ExtUIOp::create(b, loc, b.getI64Type(), x); }
  Value narrow(Value x) { return arith::TruncIOp::create(b, loc, b.getI32Type(), x); }
  Value nonzero(Value x) { return cmp(arith::CmpIPredicate::ne, x, c(0)); }
  // Every emitted shift is in 1..63, including eagerly evaluated select arms.
  // Bit zero jams all discarded bits; count >=64 reduces any nonzero value to 1.
  Value jam(Value x, Value count) {
    auto safe = choose(lt(count, c(1)), c(1), choose(lt(count, c(64)), count, c(63)));
    auto lost = nonzero(shl(x, sub(c(64), safe)));
    auto sticky = arith::ExtUIOp::create(b, loc, b.getI64Type(), lost);
    auto shifted = bitOr(shr(x, safe), sticky);
    auto any = arith::ExtUIOp::create(b, loc, b.getI64Type(), nonzero(x));
    return choose(eq(count, c(0)), x, choose(lt(count, c(64)), shifted, any));
  }
  struct Parts {
    Value bits, sign, exponent, significand, isNan, isInf, isZero;
  };
  Parts unpack(Value value) {
    auto bits = wide(arith::BitcastOp::create(b, loc, b.getI32Type(), value));
    auto sign = bitAnd(bits, c(0x80000000));
    auto magnitude = bitAnd(bits, c(0x7fffffff));
    auto exponent = bitAnd(shr(bits, c(23)), c(255));
    auto fraction = bitAnd(bits, c(0x7fffff));
    return {bits,
            sign,
            choose(eq(exponent, c(0)), c(1), exponent),
            choose(eq(exponent, c(0)), fraction, bitOr(fraction, c(0x800000))),
            lt(c(0x7f800000), magnitude),
            eq(magnitude, c(0x7f800000)),
            eq(magnitude, c(0))};
  }
  // Normalize in logarithmic steps. A shift is allowed only if it cannot
  // overshoot the target bit or cross the subnormal exponent floor. Zero
  // keeps its exponent, just as in the original bounded one-bit loop.
  std::pair<Value, Value> normalize(Value sig, Value exponent, unsigned bit, std::int64_t floor) {
    for (unsigned shift = 16; shift != 0; shift >>= 1) {
      if (shift > bit)
        continue;
      auto fits = lt(sig, c(std::uint64_t{1} << (bit - shift + 1)));
      auto room = cmp(arith::CmpIPredicate::sge, exponent, c(floor + shift));
      auto move = all(all(nonzero(sig), fits), room);
      sig = choose(move, shl(sig, c(shift)), sig);
      exponent = choose(move, sub(exponent, c(shift)), exponent);
    }
    return {sig, exponent};
  }
  Value pack(Value sig, Value exponent, Value sign) {
    // Three low bits are guard/round/sticky. The retained odd bit breaks ties.
    auto main = shr(sig, c(3));
    auto tail = bitAnd(sig, c(7));
    auto increment = bitOr(lt(c(4), tail), all(eq(tail, c(4)), nonzero(bitAnd(main, c(1)))));
    auto rounded = add(main, arith::ExtUIOp::create(b, loc, b.getI64Type(), increment));
    auto carry = eq(rounded, c(0x1000000));
    rounded = choose(carry, shr(rounded, c(1)), rounded);
    exponent = choose(carry, add(exponent, c(1)), exponent);
    auto field = choose(lt(rounded, c(0x800000)), c(0), exponent);
    auto bits = bitOr(sign, bitOr(shl(field, c(23)), bitAnd(rounded, c(0x7fffff))));
    return choose(slt(exponent, c(255)), bits, bitOr(sign, c(0x7f800000)));
  }
  Value addition(Parts a, Parts d) {
    auto magnitudeA = bitAnd(a.bits, c(0x7fffffff)), magnitudeB = bitAnd(d.bits, c(0x7fffffff));
    auto swap = lt(magnitudeA, magnitudeB);
    auto sigA = choose(swap, d.significand, a.significand),
         sigB = choose(swap, a.significand, d.significand);
    auto expA = choose(swap, d.exponent, a.exponent), expB = choose(swap, a.exponent, d.exponent);
    auto sign = choose(swap, d.sign, a.sign);
    auto same = eq(a.sign, d.sign);
    sigA = shl(sigA, c(3));
    sigB = jam(shl(sigB, c(3)), sub(expA, expB));
    auto sig = choose(same, add(sigA, sigB), sub(sigA, sigB));
    auto carry = cmp(arith::CmpIPredicate::uge, sig, c(0x8000000));
    sig = choose(carry, jam(sig, c(1)), sig);
    expA = choose(carry, add(expA, c(1)), expA);
    auto [normal, exponent] = normalize(sig, expA, 26, 1);
    auto zeroSign = bitAnd(a.sign, d.sign);
    auto result = choose(eq(normal, c(0)), zeroSign, pack(normal, exponent, sign));
    result = choose(d.isInf, d.bits, result);
    result = choose(a.isInf, a.bits, result);
    auto invalid = all(all(a.isInf, d.isInf), cmp(arith::CmpIPredicate::ne, a.sign, d.sign));
    return choose(bitOr(bitOr(a.isNan, d.isNan), invalid), c(0x7fc00000), result);
  }
  Value multiplication(Parts a, Parts d) {
    auto [sigA, expA] = normalize(a.significand, a.exponent, 23, -22);
    auto [sigB, expB] = normalize(d.significand, d.exponent, 23, -22);
    auto product = arith::MulIOp::create(b, loc, sigA, sigB);
    auto high = nonzero(bitAnd(product, c(std::uint64_t{1} << 47)));
    auto sig = jam(product, choose(high, c(21), c(20)));
    auto exponent = sub(add(expA, expB), c(127));
    exponent = choose(high, add(exponent, c(1)), exponent);
    auto tiny = slt(exponent, c(1));
    sig = choose(tiny, jam(sig, sub(c(1), exponent)), sig);
    exponent = choose(tiny, c(1), exponent);
    auto sign = arith::XOrIOp::create(b, loc, a.sign, d.sign);
    auto result = pack(sig, exponent, sign);
    result = choose(bitOr(a.isZero, d.isZero), sign, result);
    result = choose(bitOr(a.isInf, d.isInf), bitOr(sign, c(0x7f800000)), result);
    auto invalid = bitOr(all(a.isInf, d.isZero), all(d.isInf, a.isZero));
    return choose(bitOr(bitOr(a.isNan, d.isNan), invalid), c(0x7fc00000), result);
  }

public:
  explicit IntegerFloat(Operation *op) : b(op), loc(op->getLoc()) {}
  Value lower(Operation *op) {
    auto a = unpack(op->getOperand(0)), d = unpack(op->getOperand(1));
    auto bits = isa<arith::AddFOp>(op) ? addition(a, d) : multiplication(a, d);
    return arith::BitcastOp::create(b, loc, b.getF32Type(), narrow(bits));
  }
};
} // namespace
mlir::LogicalResult lowerStrictFloat32(mlir::Operation *root) {
  root->getContext()->getOrLoadDialect<mlir::scf::SCFDialect>();
  llvm::SmallVector<mlir::Operation *> operations;
  bool valid = true;
  root->walk([&](mlir::Operation *op) {
    if (op->getName().getDialectNamespace() != "arith")
      return;
    if (mlir::isa<mlir::arith::BitcastOp>(op))
      return;
    bool floating = false;
    for (auto type : op->getOperandTypes())
      floating |= mlir::isa<mlir::FloatType>(mlir::getElementTypeOrSelf(type));
    for (auto type : op->getResultTypes())
      floating |= mlir::isa<mlir::FloatType>(mlir::getElementTypeOrSelf(type));
    if (!floating)
      return;
    if (mlir::isa<mlir::arith::AddFOp, mlir::arith::MulFOp>(op) &&
        op->getResult(0).getType().isF32())
      operations.push_back(op);
    else {
      op->emitError("strict binary32 lowering supports only scalar float32 add/multiply");
      valid = false;
    }
  });
  if (!valid)
    return mlir::failure();
  for (auto *op : operations) {
    auto result = IntegerFloat(op).lower(op);
    op->getResult(0).replaceAllUsesWith(result);
    op->erase();
  }
  return mlir::success();
}
} // namespace kalandra
