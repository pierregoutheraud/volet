import type { RecentTab, RecentTabsClient } from '@/lib/model/recent-tabs';

interface SamplePage {
  title: string;
  url: string;
  /** The favicon's color; its letter is the title's first. */
  color: string;
  /** A screenshot's background and ink, or none (the switcher shows a placeholder). */
  screenshot?: [string, string];
}

/** Five tabs for the switcher's preview page, most recent first: some with a screenshot, some without. */
const PAGES: SamplePage[] = [
  { title: 'Volet: vertical tabs in Chrome', url: 'https://github.com/pierregoutheraud/volet', color: '#24292f', screenshot: ['#ffffff', '#24292f'] },
  { title: 'What are runes? • Svelte docs', url: 'https://svelte.dev/docs/svelte/what-are-runes', color: '#ff3e00', screenshot: ['#fdf6f3', '#ff3e00'] },
  { title: 'Quarterly plan', url: 'https://docs.google.com/document/d/quarterly', color: '#1a73e8' },
  { title: 'Inbox (3)', url: 'https://mail.google.com/mail/u/0/', color: '#d93025', screenshot: ['#f6f8fc', '#1f1f1f'] },
  { title: 'Tailwind CSS: Theme variables', url: 'https://tailwindcss.com/docs/theme', color: '#0ea5e9' },
];

/** A page-like screenshot drawn on a canvas: a header, a heading and lines of text in the page's colors. */
function screenshot([background, ink]: [string, string]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const context = canvas.getContext('2d')!;
  context.fillStyle = background;
  context.fillRect(0, 0, 640, 400);
  context.fillStyle = ink;
  context.globalAlpha = 0.9;
  context.fillRect(0, 0, 640, 44);
  context.globalAlpha = 0.85;
  context.fillRect(48, 88, 340, 26);
  context.globalAlpha = 0.22;
  for (let line = 0; line < 7; line++) context.fillRect(48, 140 + line * 28, 540 - (line % 3) * 110, 11);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/** A favicon: the title's first letter on a rounded square in the page's color. */
function favicon({ title, color }: SamplePage): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(0, 0, 64, 64, 14);
  context.fill();
  context.fillStyle = '#fff';
  context.font = '600 38px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title.charAt(0), 32, 35);
  return canvas.toDataURL('image/png');
}

/** The sample tabs; closing one drops it from the next gesture, choosing one does nothing. */
export function fakeRecentTabsClient(): RecentTabsClient {
  const tabs: RecentTab[] = PAGES.map((page, id) => ({
    id,
    title: page.title,
    url: page.url,
    icon: favicon(page),
    preview: page.screenshot ? screenshot(page.screenshot) : undefined,
  }));
  const closed = new Set<number>();
  return {
    load: async () => tabs.filter((tab) => !closed.has(tab.id)),
    activate: async () => {},
    close: async (tabId) => { closed.add(tabId); },
    settle: async () => {},
  };
}
