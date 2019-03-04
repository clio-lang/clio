const {clio_import} = require('../internals/import');
const Decimal = require('decimal.js');
const {value} = require('../internals/lazy');

const del = require('del');
del.sync('tests/.clio-cache/*');

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require('websocket').w3cwebsocket; // same for WebSocket
var clio_tests = clio_import('tests/test.clio');

test('a + b = 2 + 3', async () => {
  expect(await value((await clio_tests).a_plus_b)).toEqual(new Decimal(5))
})

test('a - b = 2 - 3', async () => {
  expect(await value((await clio_tests).a_minus_b)).toEqual(new Decimal(-1))
})

test('a * b = 2 * 3', async () => {
  expect(await value((await clio_tests).a_mul_b)).toEqual(new Decimal(6))
})

test('a / b = 2 / 3', async () => {
  expect(await value((await clio_tests).a_div_b)).toEqual(new Decimal(2).div(3))
})

test('a % b = 2 % 3', async () => {
  expect(await value((await clio_tests).a_mod_b)).toEqual(new Decimal(2))
})

test('a ^ b = 2 ^ 3', async () => {
  expect(await value((await clio_tests).a_pow_b)).toEqual(new Decimal(8))
})

test('a -> add 1 -> mul 2 -> pow 3', async () => {
  expect(await value((await clio_tests).chain)).toEqual(new Decimal(216))
})

test('expect fib of list to be same as range', async () => {
  var fib_of_list = await value(value((await clio_tests).fib_of_list.data))
  var fib_of_range = await value(value((await clio_tests).fib_of_range.data))
  expect(fib_of_list).toEqual(fib_of_range)
})

test('t and f = t && f', async () => {
  expect(await value((await clio_tests).t_and_f)).toEqual(true && false)
})

test('t or f = t || f', async () => {
  expect(await value((await clio_tests).t_or_f)).toEqual(true || false)
})

test('not f = !f', async () => {
  expect(await value((await clio_tests).not_f)).toEqual(!false)
})

test('not t = !t', async () => {
  expect(await value((await clio_tests).not_t)).toEqual(!true)
})

test('a -> add 1 (transform i: i * 2) = a * 2 + 1', async () => {
  expect(await value((await clio_tests).transform_a)).toEqual(new Decimal(5))
})

test('http calls: a -> heavy = 1024', async () => {
  expect(await value((await clio_tests).a_heavy)).toEqual(new Decimal(1024))
})

test('ws calls: a -> double = 4', async () => {
  expect(await value((await clio_tests).a_double)).toEqual(new Decimal(4))
})

test('test hash maps', async () => {
  expect(await value((await clio_tests).hash_map)).toEqual({__clio_is_processed: true, key: 'value'})
})

test('positional arguments', async () => {
  expect(await value((await clio_tests).a_pos)).toEqual(new Decimal(9))
})

test('event emitter', async () => {
  var emitter = await value((await clio_tests).ee)
  var emit = await value((await clio_tests).emit_message)
  expect(await new Promise(function(resolve, reject) {
    emitter.on('message', resolve);
    emit(emitter, 'hello')
  })).toEqual('hello')
})

test('range slicing', async () => {
  expect((await value((await clio_tests).range_slice))).toEqual(new Decimal(50))
})

test('list slicing', async () => {
  expect((await value((await clio_tests).list_slice))).toEqual(new Decimal(1))
})

test('eager map', async () => {
  expect((await value((await clio_tests).eager_map)).data).toEqual(
    [new Decimal(0),new Decimal(2),new Decimal(4),new Decimal(6),new Decimal(8)])
})

test('conditionals', async () => {
  expect((await value((await clio_tests).number_is))).toEqual("=10")
})

test('in-flow conditionals', async () => {
  expect((await value((await clio_tests).other_is))).toEqual("=10")
})

test('test equity', async () => {
  expect((await value((await clio_tests).eight_is_eight))).toEqual(true)
})
