import { browser } from 'wxt/browser';
import { activeSpaceOf, loadContext } from './context';
import type { Engine } from './engine';
import { openSearch } from './palette/open';
import { searchPalette } from './palette/search';
import { toCommand } from './palette/to-command';
import type { CommandResult, RuntimeMessage } from './protocol';
import { errorMessage } from './retry';

const failure = (error: unknown): CommandResult => ({ ok: false, error: errorMessage(error) });

/** Answer messages from side panels and Search over a page. */
export function listenForMessages(engine: Engine): void {
  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
    const respond = (work: Promise<unknown>) => {
      work.then(
        (value) => sendResponse({ ok: true, value } satisfies CommandResult),
        (error: unknown) => {
          console.warn('message failed', message, error);
          sendResponse(failure(error));
        },
      );
      return true; // keep the channel open for the async response
    };
    // The in-page palette doesn't know its window; its tab does.
    const windowOf = (windowId: number | undefined) => windowId ?? sender.tab?.windowId;

    switch (message?.type) {
      case 'command':
        return respond(engine.run(message.command));
      case 'hello':
        return respond(engine.reconcile(message.windowId));
      case 'palette:query': {
        const windowId = windowOf(message.windowId);
        return windowId === undefined ? undefined : respond(searchPalette(windowId, message.text));
      }
      case 'palette:run': {
        const windowId = windowOf(message.windowId);
        if (windowId === undefined) return undefined;
        return respond(
          (async () => {
            const ctx = await loadContext(windowId);
            const command = toCommand(message.item, windowId, activeSpaceOf(ctx));
            if (command) await engine.run(command);
          })(),
        );
      }
      case 'palette:open':
        // From Volet's own pages only (the panel), never a website.
        if (!sender.url?.startsWith(`${location.origin}/`) || !Number.isInteger(message.windowId)) return undefined;
        return respond(openSearch(message.windowId));
      default:
        return undefined;
    }
  });
}
