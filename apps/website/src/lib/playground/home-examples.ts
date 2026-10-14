export const homeExamples = [
  {
    title: "Remote calls",
    description:
      "Import a typed service contract and call a function on another machine.",
    detail:
      "remote: loads the client contract. await waits for the service to return a calibrated reading.",
    source:
      'from "remote:./readings.client.json" import TaggedReading calibrate\n\nexport fn main:\n  reading = TaggedReading "north" 10\n  calibrated = await calibrate reading\n  calibrated.value',
    expected: "12",
    link: "/docs/guide/workflows#remote-batch-mapping-recovery-and-cleanup",
  },
  {
    title: "Make it parallel",
    description:
      "Map a function over three values. Dispatch independent calls to workers and await the results.",
    detail:
      "|double| dispatches the call; [await] collects the results. This tiny example demonstrates the syntax, not a speedup.",
    source:
      "@params Number\n@returns Number\nfn double value: value * 2\n\nexport fn main:\n  [1 2 3] -> * [await] |double|",
    expected: "[2, 4, 6]",
    link: "/docs/guide/parallel",
  },
  {
    title: "Check the boundary",
    description:
      "Workers need to know what they receive. Remove the parameter type and let the compiler explain.",
    detail:
      "Parallel calls require concrete serializable types. Add @params Number above the function to fix this example.",
    source:
      "@returns Number\nfn double value: value * 2\n\nexport fn main:\n  [1 2 3] -> * [await] |double|",
    expected: "A compiler diagnostic",
    link: "/docs/guide/types",
  },
];
