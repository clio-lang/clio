const { clio_import } = require("../internals/import");

const del = require("del");
del.sync("tests/.clio-cache/*");

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket
var clio_tests = clio_import("tests/test.clio");

beforeAll(async () => {
  clio_tests = await clio_tests;
});

test("a + b = 2 + 3", async () => {
  expect(await clio_tests.a_plus_b).toEqual(5);
});

test("a - b = 2 - 3", async () => {
  expect(await clio_tests.a_minus_b).toEqual(-1);
});

test("a * b = 2 * 3", async () => {
  expect(await clio_tests.a_mul_b).toEqual(6);
});

test("a / b = 2 / 3", async () => {
  expect(await clio_tests.a_div_b).toEqual(2 / 3);
});

test("a % b = 2 % 3", async () => {
  expect(await clio_tests.a_mod_b).toEqual(2);
});

test("a ^ b = 2 ^ 3", async () => {
  expect(await clio_tests.a_pow_b).toEqual(8);
});

test("a -> add 1 -> mul 2 -> pow 3", async () => {
  expect(await clio_tests.chain).toEqual(216);
});

test("expect fib of list to be same as range", async () => {
  var fib_of_list = await Promise.all(await clio_tests.fib_of_list);
  var fib_of_range = await Promise.all(
    (await clio_tests.fib_of_range).asArray()
  );
  expect(fib_of_list).toEqual(fib_of_range);
});

test("t and f = t && f", async () => {
  expect(await clio_tests.t_and_f).toEqual(true && false);
});

test("t or f = t || f", async () => {
  expect(await clio_tests.t_or_f).toEqual(true || false);
});

test("not f = !f", async () => {
  expect(await clio_tests.not_f).toEqual(!false);
});

test("not t = !t", async () => {
  expect(await clio_tests.not_t).toEqual(!true);
});

test("a -> add 1 (transform i: i * 2) = a * 2 + 1", async () => {
  expect(await clio_tests.transform_a).toEqual(5);
});

test("http calls: a -> heavy = 1024", async () => {
  expect(await clio_tests.a_heavy).toEqual(1024);
});

test("ws calls: a -> double = 4", async () => {
  expect(await clio_tests.a_double).toEqual(4);
});

test("test hash maps", async () => {
  expect(await clio_tests.hash_map).toEqual({ key: "value" });
});

test("positional arguments", async () => {
  expect(await clio_tests.a_pos).toEqual(9);
});

test("event emitter", async () => {
  var emitter = await clio_tests.ee;
  var emit = await clio_tests.emit_message;
  expect(
    await new Promise(function(resolve, reject) {
      emitter.on("message", resolve);
      emit(emitter, "hello");
    })
  ).toEqual("hello");
});

test("range slicing", async () => {
  expect(await clio_tests.range_slice).toEqual(50);
});

test("list slicing", async () => {
  expect(await clio_tests.list_slice).toEqual(1);
});

test("eager map", async () => {
  var eager_map = await clio_tests.eager_map;
  eager_map = eager_map.asArray();
  eager_map = await Promise.all(eager_map);
  expect(eager_map).toEqual([0, 2, 4, 6, 8]);
});

test("conditionals", async () => {
  expect(await clio_tests.number_is).toEqual("=10");
});

test("in-flow conditionals", async () => {
  expect(await clio_tests.other_is).toEqual("=10");
});

test("test equity", async () => {
  expect(await clio_tests.eight_is_eight).toEqual(true);
});

afterAll(async () => {
  var ws_connections = clio_tests.clio_ws_connections;
  for (var server in ws_connections) {
    if (ws_connections.hasOwnProperty(server)) {
      if (Object.keys(ws_connections[server].emitters).length == 0) {
        ws_connections[server].socket.close()
      }
    }
  }
})