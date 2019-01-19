module.exports = async function(scope, builtins) {
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('10'),
            step: builtins.Decimal('2')
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], [builtins.Decimal('2')], builtins.mul)], [], await builtins.funcall(['print'], [scope], builtins.get_symbol));
    return scope;
};