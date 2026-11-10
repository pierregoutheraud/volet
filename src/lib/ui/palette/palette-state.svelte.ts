import type { PaletteClient, PaletteItem } from '@/lib/model/palette';
import type { PaletteKey } from '@/lib/model/palette-relay';

/** The palette's query, results and selection. Out-of-order search answers are dropped. */
export class PaletteState {
  query = $state('');
  items = $state.raw<PaletteItem[]>([]);
  selected = $state(0);
  /** The active Space's hue, which comes with each answer, so hosts can tint themselves. */
  hue = $state<number | undefined>();

  #client: PaletteClient;
  #latest = 0;

  constructor(client: PaletteClient) {
    this.#client = client;
  }

  async search(text: string): Promise<void> {
    this.query = text;
    const request = ++this.#latest;
    const results = await this.#client.search(text);
    if (request !== this.#latest) return;
    this.items = results.items;
    this.hue = results.hue;
    this.selected = 0;
  }

  move(delta: number): void {
    const count = this.items.length;
    if (count) this.selected = (this.selected + delta + count) % count;
  }

  select(index: number): void {
    this.selected = index;
  }

  /** What a key does, typed here or in the Volet panel: move through the results, run one, or close (`done`). */
  async press(key: PaletteKey, done: () => void): Promise<void> {
    if (key === 'next') this.move(1);
    else if (key === 'previous') this.move(-1);
    else if (key === 'close') done();
    else if (await this.run()) done();
  }

  /** Run the selected (or given) result. Resolves once it has run. */
  async run(index = this.selected): Promise<boolean> {
    const item = this.items[index];
    if (!item) return false;
    await this.#client.run(item);
    return true;
  }
}
