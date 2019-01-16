module.exports = async function(scope, builtins) {
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.mul)], [], await builtins.funcall(['print'], [scope], builtins.get_symbol));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('1'),
            end: builtins.Decimal('4'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('4'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], [builtins.Decimal('2')], builtins.mul)], [], await builtins.funcall(['print'], [scope], builtins.get_symbol));
    return scope;
};