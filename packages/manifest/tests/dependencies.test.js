const dependencies = require("../dependencies");

describe("logNoClioDeps", () => {
  test("stdout is being written to", () => {
    let outputData = "";
    storeLog = inputs => (outputData += inputs);

    console["log"] = jest.fn(storeLog);

    dependencies.logNoClioDeps();
    expect(outputData).not.toBe("");
  });
});
