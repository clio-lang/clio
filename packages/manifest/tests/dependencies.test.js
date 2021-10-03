import { logNoClioDeps } from "../dependencies.js";

describe("logNoClioDeps", () => {
  test("stdout is being written to", () => {
    let outputData = "";
    storeLog = (inputs) => (outputData += inputs);

    console["log"] = jest.fn(storeLog);

    logNoClioDeps();
    expect(outputData).not.toBe("");
  });
});
