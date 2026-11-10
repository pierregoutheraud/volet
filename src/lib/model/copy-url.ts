/**
 * The copy shortcut (`copy-url`): the worker can't write to the clipboard, and Volet asks for no clipboard permission,
 * so whatever has the keyboard writes it: the window's Volet panel, or else the page in front.
 */

/** The worker's message to the window's Volet panel: copy `url` if you have the keyboard. */
export const PANEL_COPY_URL = 'copy-url:panel';

/** The worker's message to the copy script on a page (`entrypoints/copy-url.ts`): copy `url`, then say so. */
export const PAGE_COPY_URL = 'copy-url:page';

/** What a copy says, briefly (`ToastState`). */
export const LINK_COPIED = 'Link copied';

/** Whether an answer says the link was copied (`{ copied: true }`); anything else, or no answer, means no. */
export function wasCopied(answer: unknown): boolean {
  return typeof answer === 'object' && answer !== null && 'copied' in answer && answer.copied === true;
}
