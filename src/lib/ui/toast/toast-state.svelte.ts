/** A short confirmation ("Link copied"), shown for a moment; a new one takes the old one's place. */
export class ToastState {
  message = $state<string | undefined>();
  /** The active Volet's hue, for one shown over a page (the panel has its own tint). */
  hue = $state(268);

  #timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, hue?: number, duration = 1600): void {
    clearTimeout(this.#timer);
    this.message = message;
    if (hue !== undefined) this.hue = hue;
    this.#timer = setTimeout(() => {
      this.message = undefined;
    }, duration);
  }
}
