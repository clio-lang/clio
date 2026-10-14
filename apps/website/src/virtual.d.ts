declare module "virtual:tiramisu-docs" {
  import type {
    VirtualDoc,
    SidebarGroup,
    ResolvedSection,
    SearchIndexEntry,
    LocaleData,
  } from "@tiramisu-docs/kit";

  export const docs: VirtualDoc[];
  export const sidebar: SidebarGroup[];
  export const sections: ResolvedSection[] | undefined;
  export const docImports: Record<string, () => Promise<{ default: any }>>;
  export const searchIndex: SearchIndexEntry[];
  export const locales: Record<string, LocaleData> | undefined;
  export const defaultLocale: string | undefined;
}
