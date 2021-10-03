import random from "../random.js";

describe("Test random functionality", () => {
  test("Random should make random string of length n", () => {
    const randomA = random(8);
    const randomB = random(8);
    expect(randomA).not.toEqual(randomB);
    expect(randomA.length).toEqual(8);
  });
});
