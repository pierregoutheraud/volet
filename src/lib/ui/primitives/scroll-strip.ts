import type { Attachment } from 'svelte/attachments';
import { prefersReducedMotion } from 'svelte/motion';

/**
 * A row that scrolls sideways when its items don't fit: no scrollbar, a fade on each edge that
 * hides more items (the `scroll-strip` utility in `app.css`), and the mouse wheel scrolls it too. Wheel
 * events it uses stop there, so they don't also reach a swipe listening further up.
 */

/** Width of the edge fades, in px; `reveal` keeps items clear of them. */
export const FADE_PX = 14;

interface Extent {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/** Which edges hide more items. */
export function hiddenEdges({ scrollLeft, scrollWidth, clientWidth }: Extent): { start: boolean; end: boolean } {
  return { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
}

/**
 * How far to scroll so an item shows fully, clear of the fades (0 when it already does).
 * Positions are viewport x coordinates, as `getBoundingClientRect` gives them.
 */
export function revealOffset(strip: { left: number; right: number }, item: { left: number; right: number }): number {
  if (item.left < strip.left + FADE_PX) return item.left - strip.left - FADE_PX;
  if (item.right > strip.right - FADE_PX) return item.right - strip.right + FADE_PX;
  return 0;
}

const overflows = (node: HTMLElement) => node.scrollWidth > node.clientWidth + 1;

export const scrollStrip: Attachment<HTMLElement> = (node) => {
  const update = () => {
    const edges = overflows(node) ? hiddenEdges(node) : { start: false, end: false };
    node.toggleAttribute('data-hidden-start', edges.start);
    node.toggleAttribute('data-hidden-end', edges.end);
  };
  const onWheel = (event: WheelEvent) => {
    if (!overflows(node)) return; // nothing to scroll: let the event through
    event.preventDefault();
    event.stopPropagation();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    node.scrollLeft += delta;
  };

  update();
  node.addEventListener('scroll', update, { passive: true });
  node.addEventListener('wheel', onWheel, { passive: false });
  // Items come and go (and change width): re-check the edges.
  const resized = new ResizeObserver(update);
  resized.observe(node);
  const changed = new MutationObserver(update);
  changed.observe(node, { childList: true });
  return () => {
    node.removeEventListener('scroll', update);
    node.removeEventListener('wheel', onWheel);
    resized.disconnect();
    changed.disconnect();
  };
};

/** Scroll the strip so the item matching `selector` shows (on the next frame, once it's rendered). */
export function reveal(node: HTMLElement, selector: string, smooth = true): () => void {
  const frame = requestAnimationFrame(() => {
    const item = node.querySelector(selector);
    if (!item) return;
    const offset = revealOffset(node.getBoundingClientRect(), item.getBoundingClientRect());
    const glide = smooth && !prefersReducedMotion.current;
    if (offset) node.scrollBy({ left: offset, behavior: glide ? 'smooth' : 'instant' });
  });
  return () => cancelAnimationFrame(frame);
}
