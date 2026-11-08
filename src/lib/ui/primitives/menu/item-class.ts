/**
 * The look shared by every menu row (actions and submenu triggers). The highlight follows
 * focus, or the pointer while the panel has no focus (`data-unfocused`, see dismiss.ts).
 */
export const MENU_ITEM_CLASS =
  'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] outline-none select-none data-disabled:opacity-40 data-highlighted:bg-hover [[data-unfocused]_&:not([data-disabled]):hover]:bg-hover';
