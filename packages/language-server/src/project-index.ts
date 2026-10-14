import {
  analyzeProject,
  type AnalysisOptions,
  type ProjectResult,
  type ProjectHost,
} from "@kalandra/compiler";

interface Entry {
  result: ProjectResult;
  external: boolean;
  inputs: ReadonlyMap<string, string | null>;
}
/** Session-persistent graph cache. Validate every input, including missing imports, before reuse. */
export class ProjectIndex {
  private entries = new Map<string, Entry>();
  private epoch = 0;
  constructor(
    private options: AnalysisOptions = {},
    private capacity = 32,
    private parseKalandraManifest?: ProjectHost["parseKalandraManifest"],
  ) {}
  clear() {
    this.epoch++;
    this.entries.clear();
  }
  async analyze(
    root: string,
    entry: string,
    read: (path: string) => Promise<string | null>,
    resolveExternal?: ProjectHost["resolveExternal"],
  ): Promise<ProjectResult> {
    const epoch = this.epoch;
    const key = JSON.stringify([root, entry]);
    const previous = this.entries.get(key);
    if (previous && !previous.external) {
      let unchanged = true;
      for (const [path, text] of previous.inputs) {
        if ((await read(path)) !== text) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) {
        if (epoch === this.epoch) {
          this.entries.delete(key);
          this.entries.set(key, previous);
        }
        return previous.result;
      }
    }
    let external = false;
    const inputs = new Map<string, string | null>();
    const result = await analyzeProject(
      entry,
      {
        parseKalandraManifest: this.parseKalandraManifest,
        ...(resolveExternal
          ? {
              resolveExternal: async (
                dependency: Parameters<
                  NonNullable<ProjectHost["resolveExternal"]>
                >[0],
                importer: string,
              ) => {
                external = true;
                return resolveExternal(dependency, importer);
              },
            }
          : {}),
        readSource: async (path) => {
          const text = await read(path);
          inputs.set(path, text);
          return text;
        },
      },
      this.options,
    );
    if (epoch === this.epoch) {
      this.entries.delete(key);
      this.entries.set(key, { result, inputs, external });
      while (this.entries.size > this.capacity)
        this.entries.delete(this.entries.keys().next().value!);
    }
    return result;
  }
}
