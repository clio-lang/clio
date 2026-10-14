/** Embedded helpers only handle compiler-declared records; wire envelopes are not user records. */
export const recordHelpersSource = `(() => {
  const constructors = new Map();
  const registerRecord = (id, constructor) => {
    if (!constructors.has(id)) constructors.set(id, constructor);
    return constructors.get(id);
  };
  const plainField = (value, name) => {
    const property = Object.getOwnPropertyDescriptor(value, name);
    if (!property || !("value" in property) || !property.enumerable)
      throw new TypeError("Record fields must be enumerable data properties");
    return property.value;
  };
  const match = (type, value, unpack, scope = "") => {
    if (typeof type === "string") return type === "null" ? value === null : type === "void" ? value === undefined : typeof value === type;
    if (type.record) return !!value && typeof value === "object" && (unpack
      ? Object.getOwnPropertyDescriptor(value, "$record")?.value === type.record.id
      : Object.getPrototypeOf(value) === constructors.get(scope + type.record.id)?.prototype);
    if (type.array) {
      if (!Array.isArray(value) || value.length > 1000000) return false;
      for (let index = 0; index < value.length; index++) if (!match(type.array, plainField(value, String(index)), unpack, scope)) return false;
      return true;
    }
    return type.union.some(member => match(member, value, unpack, scope));
  };
  const transform = (schema, values, unpack, scope = "") => {
    let nodes = 0;
    const visit = (type, value, depth) => {
      if (++nodes > 1000000 || depth > 256) throw new TypeError("Record data exceeds structural limits");
      if (typeof type === "string") return value;
      if (type.union) {
        const selected = type.union.find(member => match(member, value, unpack, scope));
        if (!selected) throw new TypeError("Value does not match a declared union variant");
        return visit(selected, value, depth + 1);
      }
      if (type.array) {
        if (!Array.isArray(value) || value.length > 1000000 - nodes || Reflect.ownKeys(value).length !== value.length + 1)
          throw new TypeError("Expected a bounded dense array without metadata");
        return Array.from({ length: value.length }, (_, index) => visit(type.array, plainField(value, String(index)), depth + 1));
      }
      const record = type.record, ctor = constructors.get(scope + record.id);
      if (!ctor) throw new TypeError("Missing declared record constructor: " + record.id);
      if (!match(type, value, unpack, scope)) throw new TypeError("Value is not the declared record " + record.id);
      if (unpack) {
        if (Reflect.ownKeys(value).length !== 2) throw new TypeError("Invalid record envelope");
        const fields = plainField(value, "fields");
        if (!fields || typeof fields !== "object" || Array.isArray(fields) || Reflect.ownKeys(fields).length !== record.fields.length)
          throw new TypeError("Record field count mismatch");
        const result = Object.create(ctor.prototype);
        record.fields.forEach(([name, type]) => Object.defineProperty(result, name, {
          value: visit(type, plainField(fields, name), depth + 1), enumerable: true, writable: true, configurable: true
        }));
        return result;
      }
      if (Reflect.ownKeys(value).length !== record.fields.length) throw new TypeError("Record has missing or extra fields");
      return { $record: record.id, fields: Object.fromEntries(record.fields.map(([name, type]) => [name, visit(type, plainField(value, name), depth + 1)])) };
    };
    return schema.map((type, index) => visit(type, values[index], 0));
  };
  return { registerRecord, getRecord: id => constructors.get(id),
    recordField: (object, name, value) => Object.defineProperty(object, name, { value, enumerable: true, writable: true, configurable: true }),
    packTaskArgs: (schema, args, scope = "") => transform(schema.args, args, false, scope),
    unpackTaskArgs: (schema, args) => transform(schema.args, args, true),
    packTaskResult: (schema, value) => transform([schema.result], [value], false)[0],
    unpackTaskResult: (schema, value, scope = "") => transform([schema.result], [value], true, scope)[0]
  };
})()`;
