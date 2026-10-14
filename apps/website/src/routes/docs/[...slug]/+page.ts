import * as docModule from "virtual:tiramisu-docs";
import { error, redirect } from "@sveltejs/kit";
import type {
  VirtualModule,
  LocaleData,
  ResolvedSection,
  SidebarGroup,
} from "@tiramisu-docs/kit";

export async function load({ params }: { params: { slug?: string } }) {
  const rawSlug = params.slug || "index";
  const mod: VirtualModule = docModule;

  if (mod.locales && mod.defaultLocale) {
    const segments = rawSlug.split("/");
    const possibleLocale = segments[0];
    const localeData = mod.locales[possibleLocale];

    if (localeData) {
      const locale = possibleLocale;
      const slug = segments.slice(1).join("/") || "index";
      return loadDoc(localeData, slug, locale, mod);
    } else {
      throw redirect(302, `/docs/${mod.defaultLocale}/${rawSlug}`);
    }
  }

  return loadLegacy(mod, rawSlug);
}

function loadLegacy(mod: VirtualModule, slug: string) {
  let importFn = mod.docImports[slug] ?? mod.docImports[slug + "/index"];

  // Root /docs with no page — redirect to first section
  if (!importFn && slug === "index" && mod.sections) {
    const firstSection = mod.sections.find((s) => s.path);
    if (firstSection) throw redirect(302, `/docs/${firstSection.path}`);
  }

  if (!importFn) throw error(404, "Page not found");
  if (!mod.docImports[slug]) slug = slug + "/index";

  return importFn().then((c) => {
    const doc = mod.docs.find((d) => d.slug === slug);
    let activeSidebar: SidebarGroup[] = mod.sidebar;
    if (mod.sections) {
      activeSidebar =
        findActiveSectionSidebar(mod.sections, slug) ?? mod.sidebar;
    }
    return {
      component: c.default ?? c,
      meta: doc?.meta ?? {},
      headings: doc?.headings ?? [],
      lastEdited: doc?.lastEdited,
      markdown: doc?.markdown,
      slug,
      sections: mod.sections ?? undefined,
      activeSidebar,
    };
  });
}

async function loadDoc(
  localeData: LocaleData,
  slug: string,
  locale: string,
  mod: VirtualModule,
) {
  type ImportFn = () => Promise<{ default: any }>;
  let importFn: ImportFn | undefined =
    localeData.docImports[slug] ?? localeData.docImports[slug + "/index"];
  if (!localeData.docImports[slug] && localeData.docImports[slug + "/index"])
    slug = slug + "/index";
  let showFallbackBanner = false;

  if (!importFn) {
    const defaultData = mod.locales?.[mod.defaultLocale!];
    importFn =
      defaultData?.docImports[slug] ?? defaultData?.docImports[slug + "/index"];
    if (
      !defaultData?.docImports[slug] &&
      defaultData?.docImports[slug + "/index"]
    )
      slug = slug + "/index";
    if (!importFn) {
      // Root /docs/<locale> with no index page — redirect to first section
      if (slug === "index" && localeData.sections) {
        const firstSection = localeData.sections.find((s) => s.path);
        if (firstSection)
          throw redirect(302, `/docs/${locale}/${firstSection.path}`);
      }
      throw error(404, "Page not found");
    }
    showFallbackBanner = true;
  }

  const component = await importFn();
  const doc =
    localeData.docs.find((d) => d.slug === slug) ??
    mod.locales?.[mod.defaultLocale!]?.docs.find((d) => d.slug === slug);

  const sections = localeData.sections;
  let activeSidebar: SidebarGroup[] = localeData.sidebar;
  if (sections) {
    activeSidebar =
      findActiveSectionSidebar(sections, slug) ?? localeData.sidebar;
  }

  return {
    component: component.default ?? component,
    meta: doc?.meta ?? {},
    headings: doc?.headings ?? [],
    lastEdited: doc?.lastEdited,
    markdown: doc?.markdown,
    slug,
    locale,
    locales: Object.keys(mod.locales!),
    sections,
    activeSidebar,
    showFallbackBanner,
  };
}

function findActiveSectionSidebar(
  sections: ResolvedSection[],
  slug: string,
): SidebarGroup[] | null {
  for (const section of sections) {
    if (
      section.path &&
      (slug === section.path || slug.startsWith(section.path + "/"))
    ) {
      return section.sidebar ?? null;
    }
    if (section.children) {
      const found = findActiveSectionSidebar(section.children, slug);
      if (found) return found;
    }
  }
  if (sections.length > 0 && sections[0].sidebar && !sections[0].path) {
    return sections[0].sidebar;
  }
  return null;
}
