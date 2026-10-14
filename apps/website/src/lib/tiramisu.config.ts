import { defineConfig } from "@tiramisu-docs/kit";

export default defineConfig({
  title: "Kalandra",
  description:
    "A functional language for parallel and distributed programming. The next chapter of Clio.",
  url: "https://kalandra.dev",
  sidebar: { groupOrder: ["Project", "Learn", "Contributing", "Blog"] },
  nav: [
    { label: "Docs", href: "/docs" },
    { label: "Playground", href: "/docs/playground" },
    { label: "Blog", href: "/docs/blog" },
    { label: "GitHub", href: "https://github.com/kalandra-lang/kalandra" },
  ],
  footer: {
    copyright: "Kalandra · Apache-2.0",
    socials: { github: "https://github.com/kalandra-lang/kalandra" },
  },
});
