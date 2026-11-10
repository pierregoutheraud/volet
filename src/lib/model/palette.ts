import type { PaletteItem, PaletteResults } from '@/lib/engine/palette/types';

export type { PaletteItem, PaletteResults };

/** What Search needs: search, and run a result. */
export interface PaletteClient {
  search(text: string): Promise<PaletteResults>;
  run(item: PaletteItem): Promise<void>;
}
