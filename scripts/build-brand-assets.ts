import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(
  new URL("../apps/website/static/", import.meta.url),
);
await mkdir(`${directory}social`, { recursive: true });
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#101014"/><path d="M14 12h8v23l15-17h10L30 37l18 17H37L22 40v14h-8Z" fill="#fafafa"/><circle cx="53" cy="51" r="3.5" fill="#a6b7ff"/></svg>`;
await writeFile(`${directory}favicon.svg`, icon);
for (const [name, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
] as const) {
  await writeFile(
    `${directory}${name}`,
    new Resvg(icon, { fitTo: { mode: "width", value: size } }).render().asPng(),
  );
}
const particles = Array.from({ length: 380 }, (_, i) => {
  const x = 630 + ((i * 73) % 540);
  const y = 115 + Math.sin((x - 630) / 110) * 70 + ((i * 31) % 90);
  return `<circle cx="${x}" cy="${y.toFixed(1)}" r="${0.7 + (i % 4) * 0.35}" fill="${i % 2 ? "#b8a6ff" : "#87d7ee"}" opacity="${0.15 + (i % 6) * 0.08}"/>`;
}).join("");
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#09090b"/>
${particles}
<g font-family="Helvetica, Arial, sans-serif">
<text x="64" y="116" fill="#fafafa" font-size="68" font-weight="700" letter-spacing="-4">kalandra.</text>
<text x="66" y="191" fill="#a1a1aa" font-size="16" letter-spacing="3">FUNCTIONAL · PARALLEL · DISTRIBUTED</text>
<text x="62" y="298" fill="#fafafa" font-size="61" font-weight="700" letter-spacing="-2">Functions here.</text>
<text x="62" y="371" fill="#fafafa" font-size="61" font-weight="700" letter-spacing="-2">Compute anywhere.</text>
<text x="66" y="435" fill="#b4b4bd" font-size="22">A language and framework for</text>
<text x="66" y="467" fill="#b4b4bd" font-size="22">parallel and distributed applications.</text>
<rect x="680" y="249" width="454" height="212" rx="12" fill="#121216" stroke="#303038"/>
<text x="708" y="287" fill="#a1a1aa" font-size="14">main.kalandra</text>
<path d="M680 308H1134" stroke="#303038"/>
<g font-family="Menlo, monospace" font-size="16">
<text x="708" y="337" fill="#c9d1d9">@params <tspan fill="#d2a8ff">Number</tspan></text>
<text x="708" y="365" fill="#d2a8ff"><tspan fill="#ff7b72">fn</tspan> double n: n * <tspan fill="#79c0ff">2</tspan></text>
<text x="708" y="400" fill="#ff7b72">export fn <tspan fill="#d2a8ff">main:</tspan></text>
<text x="728" y="428" fill="#c9d1d9">[<tspan fill="#79c0ff">1 2 3</tspan>] -&gt; * <tspan fill="#ff7b72">[await]</tspan> <tspan fill="#d2a8ff">|double|</tspan></text>
</g>
<path d="M64 536H1136" stroke="#27272a"/>
<text x="66" y="581" fill="#fafafa" font-size="18">kalandra.dev</text>
<text x="1134" y="581" text-anchor="end" fill="#a1a1aa" font-size="17">The next chapter of Clio</text>
</g></svg>`;
await writeFile(`${directory}social/kalandra.svg`, card);
await writeFile(
  `${directory}social/kalandra.png`,
  new Resvg(card).render().asPng(),
);
console.log("Generated favicon, touch icon, and 1200 × 630 social card.");
