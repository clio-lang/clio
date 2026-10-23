import matrix from "../../../../native/metal-source/matrix-graph.k?raw";
import arithmetic from "../../../../native/metal-source/pre-matmul.k?raw";
import placement from "../../../../native/benchmarks/gpu.k?raw";

// Read examples from the qualified native fixtures so the homepage cannot
// silently drift into an invented dialect or advertise browser GPU execution.
export function load() {
  return {
    examples: [
      {
        title: "Matrix graphs",
        file: "matrix-graph.k",
        path: "native/metal-source/matrix-graph.k",
        source: matrix.split("\nfn main")[0].trim(),
        heading: "Keep the graph on the GPU.",
        description:
          "Compose matrix products as ordinary functions. Intermediate tensors stay on the device, ready for the next operation.",
        stages: [
          "Input tensors",
          "Matrix product",
          "Projection",
          "Resident result",
        ],
      },
      {
        title: "Tensor arithmetic",
        file: "pre-matmul.k",
        path: "native/metal-source/pre-matmul.k",
        source: arithmetic.split("\nfn main")[0].trim(),
        heading: "Build with numerical primitives.",
        description:
          "Combine elementwise arithmetic, matrix products and typed scalar parameters in a single resident numerical graph.",
        stages: [
          "Input + scale",
          "Matrix product",
          "Bias + scale",
          "Resident result",
        ],
      },
      {
        title: "CPU ↔ GPU",
        file: "gpu.k",
        path: "native/benchmarks/gpu.k",
        source: placement.trim(),
        heading: "Choose where the work happens.",
        description:
          "Transfer tensors explicitly, place a typed task on the GPU, and await its result. CPU workers and GPU tasks belong to the same language.",
        stages: [
          "CPU tensor",
          "Transfer to GPU",
          "Spawn + await",
          "Transfer to CPU",
        ],
      },
    ],
  };
}
