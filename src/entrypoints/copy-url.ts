import { mount } from 'svelte';
import { browser } from 'wxt/browser';
import { LINK_COPIED, PAGE_COPY_URL } from '@/lib/model/copy-url';
import { shadowMode } from '@/lib/ui/primitives/shadow-mode';
import PageToast from '@/lib/ui/toast/PageToast.svelte';
import { ToastState } from '@/lib/ui/toast/toast-state.svelte';
import css from '@/lib/ui/toast/toast.css?inline';

/** Set on the page (Volet's isolated world) once the script is there, so adding it again does nothing. */
const KEY = '__voletCopyUrl';
type Host = Window & { [KEY]?: true };

const isCopy = (value: unknown): value is { url: string; hue: number } =>
  typeof value === 'object' && value !== null && 'type' in value && value.type === PAGE_COPY_URL &&
  'url' in value && typeof value.url === 'string' && 'hue' in value && typeof value.hue === 'number';

/**
 * The copy shortcut on a page (`engine/copy-url.ts`), added by the worker to its top frame: the page has the keyboard,
 * so it can write the link to the clipboard, then says so at its top ("Link copied"), in a closed shadow root.
 */
export default defineUnlistedScript(() => {
  const page = window as Host;
  if (page[KEY]) return;
  page[KEY] = true;

  let toast: ToastState | undefined;
  /** Mounted on the first copy, then kept: it shows nothing between copies. */
  const confirm = (hue: number) => {
    if (!toast) {
      toast = new ToastState();
      const host = document.createElement('volet-toast');
      const shadow = host.attachShadow({ mode: shadowMode(import.meta.env.MODE) });
      const style = document.createElement('style');
      style.textContent = css;
      const target = document.createElement('div');
      shadow.append(style, target);
      document.documentElement.append(host);
      mount(PageToast, { target, props: { toast } });
    }
    toast.show(LINK_COPIED, hue);
  };

  browser.runtime.onMessage.addListener((message: unknown, _sender, respond: (response: unknown) => void) => {
    if (!isCopy(message)) return;
    navigator.clipboard.writeText(message.url).then(
      () => {
        confirm(message.hue);
        respond({ copied: true });
      },
      () => respond({ copied: false }),
    );
    return true;
  });
});
