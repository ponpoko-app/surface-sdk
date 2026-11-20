export interface BuildSurfaceOptions {
  entry?: string;
  assets?: string[];
  backends?: string[];
  executables?: { backend?: string; cli?: string };
  styles?: readonly ("tokens" | "components")[];
}

export declare function buildSurface(options?: BuildSurfaceOptions): Promise<void>;
