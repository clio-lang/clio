import { Progress } from "../progress.js";

describe("Progress", () => {
  test("progress", () => {
    const progress = new Progress();
    expect(progress.progress).toBeDefined();
  });

  test("progress silent", () => {
    const progress = new Progress(true);
    expect(progress.progress).toBeNull();
  });

  test("fail", () => {
    const progress = new Progress(false, "Foo");

    progress.fail("Failed");
    expect(progress.progress.isSpinning).toBe(false);
  });

  test("fail silent", () => {
    const progress = new Progress(true, "Foo");

    progress.fail("Failed");
    expect(progress.progress).toBeNull();
  });
});
