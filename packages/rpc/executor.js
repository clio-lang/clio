import { Buffer, TYPES } from "./lib.js";
import { DeSia, Sia, constructors as builtinConstructors } from "sializer";
import { EventEmitter, randomId } from "./common.js";

const { EVENT, CALL, GET } = TYPES;

export class Executor {
  constructor(transport) {
    this.transport = transport;
    this.isConnected = false;
    this.connect();
    this.promises = new Map();
    this.emitters = new Map();
    this.id = "executor://" + randomId();
    this.packets = 0;
    this.setupSia();
    this.transport.register(this.id, this);
  }
  setupSia() {
    const constructors = [
      ...builtinConstructors,
      {
        constructor: EventEmitter,
        code: 17,
        args: (item) => {
          const { destination } = this;
          const send = (event, ...args) => {
            const payload = this.serialize([item.id, EVENT, event, args]);
            const packet = this.serialize([this.id, destination, payload]);
            this.send(packet);
          };
          item.on(/.*/, send);
          this.emitters.set(item.id, { emitter: item, send });
          return [item.id, this.id];
        },
        build: (id, clientId) => {
          if (this.emitters.has(id)) return this.emitters.get(id);
          const emitter = new EventEmitter(id);
          const send = (event, ...args) => {
            const payload = this.serialize([id, EVENT, event, args]);
            const packet = this.serialize([this.id, clientId, payload]);
            this.send(packet);
          };
          emitter.on(/.*/, send);
          this.emitters.set(id, { emitter, send });
          return emitter;
        },
      },
    ];
    this.sia = new Sia({ constructors });
    this.desia = new DeSia({ constructors });
  }
  connect() {
    this.transport.on("message", (packet) => this.onPacket(packet));
    this.transport.on("connect", () => this.onConnect());
    this.transport.connect();
  }
  onConnect() {
    this.isConnected = true;
  }
  serialize(item) {
    return Buffer.from(this.sia.serialize(item));
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  onPacket(packet) {
    const payload = this.deserialize(packet[2]);
    const [id, type] = payload;
    if (type === EVENT) {
      const { emitter, send } = this.emitters.get(id);
      emitter.emitUnless(send, payload[2], ...payload[3]);
    } else {
      this.promises.get(id).resolve(payload[2]);
    }
  }
  call(path, args) {
    const id = this.packets++;
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const payload = this.serialize([id, CALL, args]);
    const packet = this.serialize([this.id, path, payload]);
    this.send(packet);
    return promise;
  }
  getFunction(path) {
    return (...args) => this.call(path, args);
  }
  async getFunctions(path) {
    const id = this.packets++;
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const payload = this.serialize([id, GET, path]);
    const packet = this.serialize([this.id, null, payload]);
    this.send(packet);
    const paths = await promise;
    const fns = {};
    for (const path of paths) {
      fns[path] = this.getFunction(path);
    }
    return fns;
  }
  send(data) {
    if (this.isConnected) {
      this.transport.send(data);
    } else {
      this.transport.on("connect", () => this.transport.send(data));
    }
  }
}
