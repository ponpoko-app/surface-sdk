import type { SurfaceClient } from "./surface.mjs";
export declare function bindSurfaceTheme(client: Pick<SurfaceClient, "onPalette">, root?: HTMLElement): () => void;
