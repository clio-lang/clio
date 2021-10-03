import { Buffer, TYPES } from "./lib/index.js";
import { DeSia, Sia, constructors as builtinConstructors } from "sializer";
import { EventEmitter, randomId } from "./common.js";

const { RESULT, CALL, REGISTER, EVENT } = TYPES;
export class Worker {
  constructor(transport) {
    this.transport = transport;
    this.transport.on("message", (packet) => this.onPacket(packet));
    this.transport.on("connect", () => this.handleConnect());
    this.transport.on("error", (error) => this.onError(error));
    this.functions = new Map();
    this.emitters = new Map();
    this.retries = 10;
    this.id = "worker://" + randomId();
    this.setupSia();
    this.packets = 0;
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
  register({ path, fn }) {
    this.transport.register(path, this);
    this.functions.set(path, fn);
  }
  getFn(path) {
    return this.functions.get(path);
  }
  connect() {
    this.transport.connect();
  }
  onError(error) {
    const { code } = error;
    if (code == "ECONNREFUSED") {
      if (!this.retries)
        throw new Error("Out of retries, cannot connect to the server.");
      this.retries--;
      setTimeout(() => this.connect(), 100);
    }
  }
  handleConnect() {
    this.retries = 10;
    const id = this.packets++;
    const paths = [...this.functions.keys()];
    const payload = this.serialize([id, REGISTER, paths]);
    const packet = this.serialize([this.id, null, payload]);
    this.send(packet);
  }
  onPacket(packet) {
    const [source, destination, payload] = packet;
    const deserialized = this.deserialize(payload);
    const [id, type] = deserialized;
    if (type === CALL) {
      this.handleCallInstruction(destination, deserialized[2], id, source);
    } else if (type === EVENT) {
      const { emitter, send } = this.emitters.get(id);
      emitter.emitUnless(send, deserialized[2], ...deserialized[3]);
    }
  }
  async handleCallInstruction(path, data, id, source) {
    const fn = this.getFn(path);
    const result = await fn(...data);
    this.sendResult(result, id, source);
  }
  serialize(data) {
    return Buffer.from(this.sia.serialize(data));
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  sendResult(result, id, destination) {
    this.destination = destination;
    const payload = this.serialize([id, RESULT, result]);
    const packet = this.serialize([this.id, destination, payload]);
    this.send(packet);
  }
  send(data) {
    this.transport.send(data);
  }
}
