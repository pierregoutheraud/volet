import { describe, expect, it } from 'vitest';
import { canHostOverlay, isNewTabPage, sameUrl, shortUrl } from './url';

describe('sameUrl', () => {
  it('ignores differences that keep you on the same page', () => {
    expect(sameUrl('http://news.ycombinator.com', 'https://news.ycombinator.com/')).toBe(true);
    expect(sameUrl('https://www.example.com/a/', 'https://example.com/a#top')).toBe(true);
    expect(sameUrl('https://example.com/a?utm_source=x&id=2', 'https://example.com/a?id=2')).toBe(true);
  });

  it('notices when you moved to another page', () => {
    expect(sameUrl('https://news.ycombinator.com/', 'https://news.ycombinator.com/item?id=1')).toBe(false);
    expect(sameUrl('https://example.com/a', 'https://example.com/b')).toBe(false);
    expect(sameUrl('https://example.com/a?id=1', 'https://example.com/a?id=2')).toBe(false);
  });
});

describe('shortUrl', () => {
  it('drops the scheme and www, keeps the path', () => {
    expect(shortUrl('https://www.github.com/pulls')).toBe('github.com/pulls');
    expect(shortUrl('https://news.ycombinator.com/')).toBe('news.ycombinator.com');
  });
});

describe('isNewTabPage', () => {
  it("recognizes Chrome's New Tab page and tabs that haven't loaded anything yet", () => {
    expect(isNewTabPage('chrome://newtab/')).toBe(true);
    expect(isNewTabPage('chrome://new-tab-page/')).toBe(true);
    expect(isNewTabPage(undefined)).toBe(true);
    expect(isNewTabPage('https://google.com')).toBe(false);
    expect(isNewTabPage('chrome://settings')).toBe(false);
  });
});

describe('canHostOverlay', () => {
  it('shows over websites and local files', () => {
    expect(canHostOverlay('https://example.com/a')).toBe(true);
    expect(canHostOverlay('http://localhost:3000/')).toBe(true);
    expect(canHostOverlay('file:///Users/me/notes.html')).toBe(true);
  });

  it("never over Chrome's own pages, extensions' pages or the Web Store", () => {
    for (const url of ['chrome://newtab/', 'chrome://settings', 'chrome-search://local-ntp/', 'chrome-extension://abc/options.html',
      'about:blank', 'view-source:https://example.com', 'https://chromewebstore.google.com/detail/x',
      'https://chrome.google.com/webstore/detail/x', '', undefined]) {
      expect(canHostOverlay(url)).toBe(false);
    }
  });
});
