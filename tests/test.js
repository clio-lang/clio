const { clio_import } = require("../internals/import");

const del = require("del");
del.sync("tests/.clio-cache/*");

global.fetch = require("node-fetch"); // fetch is not implemented in node (yet)
global.WebSocket = require("websocket").w3cwebsocket; // same for WebSocket
let clioTests = clio_import("tests/test.clio");

beforeAll(async () => {
  clioTests = await clioTests;
});

test("a + b = 2 + 3", async () => {
  expect(await clioTests.a_plus_b).toEqual(5);
});

test("a - b = 2 - 3", async () => {
  expect(await clioTests.a_minus_b).toEqual(-1);
});

test("a * b = 2 * 3", async () => {
  expect(await clioTests.a_mul_b).toEqual(6);
});

test("a / b = 2 / 3", async () => {
  expect(await clioTests.a_div_b).toEqual(2 / 3);
});

test("a % b = 2 % 3", async () => {
  expect(await clioTests.a_mod_b).toEqual(2);
});

test("a ^ b = 2 ^ 3", async () => {
  expect(await clioTests.a_pow_b).toEqual(8);
});

test("a -> add 1 -> mul 2 -> pow 3", async () => {
  expect(await clioTests.chain).toEqual(216);
});

test("expect fib of list to be same as range", async () => {
  let fib_of_list = await Promise.all(await clioTests.fib_of_list);
  let fib_of_range = await Promise.all(
    (await clioTests.fib_of_range).asArray()
  );
  expect(fib_of_list).toEqual(fib_of_range);
});

test("t and f = t && f", async () => {
  expect(await clioTests.t_and_f).toEqual(true && false);
});

test("t or f = t || f", async () => {
  expect(await clioTests.t_or_f).toEqual(true || false);
});

test("not f = !f", async () => {
  expect(await clioTests.not_f).toEqual(!false);
});

test("not t = !t", async () => {
  expect(await clioTests.not_t).toEqual(!true);
});

test("a -> add 1 (transform i: i * 2) = a * 2 + 1", async () => {
  expect(await clioTests.transform_a).toEqual(5);
});

test("http calls: a -> heavy = 1024", async () => {
  expect(await clioTests.a_heavy).toEqual(1024);
});

test("ws calls: a -> double = 4", async () => {
  expect(await clioTests.a_double).toEqual(4);
});

test("test hash maps", async () => {
  expect(await clioTests.hash_map).toEqual({ key: "value" });
});

test("positional arguments", async () => {
  expect(await clioTests.a_pos).toEqual(9);
});

test("event emitter", async () => {
  let emitter = await clioTests.ee;
  let emit = await clioTests.emit_message;
  expect(
    await new Promise(function(resolve, reject) {
      emitter.on("message", resolve);
      emit(emitter, "hello");
    })
  ).toEqual("hello");
});

test("range slicing", async () => {
  expect(await clioTests.range_slice).toEqual(50);
});

test("list slicing", async () => {
  expect(await clioTests.list_slice).toEqual(1);
});

test("eager map", async () => {
  let eager_map = await clioTests.eager_map;
  eager_map = eager_map.asArray();
  eager_map = await Promise.all(eager_map);
  expect(eager_map).toEqual([0, 2, 4, 6, 8]);
});

test("conditionals", async () => {
  expect(await clioTests.number_is).toEqual("=10");
});

test("in-flow conditionals", async () => {
  expect(await clioTests.other_is).toEqual("=10");
});

test("test equity", async () => {
  expect(await clioTests.eight_is_eight).toEqual(true);
});

afterAll(async () => {
  let ws_connections = clioTests.clio_ws_connections;
  for (let server in ws_connections) {
    if (ws_connections.hasOwnProperty(server)) {
      if (Object.keys(ws_connections[server].emitters).length == 0) {
        ws_connections[server].socket.close();
      }
    }
  }
});
