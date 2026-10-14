import { codeToHtml } from "shiki";

/** Build-time only; return the highlighted content for an existing pre/code shell. */
export async function highlightSnippet(
  source: string,
  lang: "javascript" | "bash",
) {
  const html = await codeToHtml(source, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
  const code = html.match(/<code>([\s\S]*)<\/code>/)?.[1];
  if (code === undefined)
    throw new Error("Syntax highlighter returned no code");
  return code;
}
