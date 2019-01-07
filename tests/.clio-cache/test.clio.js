module.exports = async function(scope, builtins) {
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.mul)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.add)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.dec)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.div)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.pow)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.funcall([builtins.Decimal('2')], [builtins.Decimal('2')], builtins.add)], builtins.mul)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.funcall([builtins.Decimal('2')], [builtins.Decimal('2')], builtins.add)], builtins.add)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.funcall([builtins.Decimal('2')], [builtins.Decimal('2')], builtins.add)], builtins.dec)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.funcall([builtins.Decimal('2')], [builtins.Decimal('2')], builtins.add)], builtins.div)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4')],
        self => self.data.length,
    )], [builtins.funcall([builtins.Decimal('2')], [builtins.Decimal('2')], builtins.add)], builtins.pow)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    return scope;
};