const clio_import = require('../internals/import');
const Decimal = require('decimal.js');
const {value} = require('../internals/lazy')

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
var clio_tests = clio_import('tests/test.clio');

test('Adding 1 + 1 equals 2', async () => {
  expect(await value((await clio_tests).add(new Decimal(1), new Decimal(1)))).toEqual(new Decimal(2))
})

test('Twice 2 equals 4', async () => {
  expect(await value((await clio_tests).double(new Decimal(2)))).toEqual(new Decimal(4))
})

test('Fib 10 equals 55', async () => {
  expect(await value((await clio_tests).fib(new Decimal(10)))).toEqual(new Decimal(55))
})

test('Index 10 of range is 20', async () => {
  expect(await value((await value((await clio_tests).the_range)).get(new Decimal(10)))).toEqual(new Decimal(20))
})
