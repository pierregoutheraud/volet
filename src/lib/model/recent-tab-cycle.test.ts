import { describe, expect, it, vi } from 'vitest';
import { RecentTabCycle } from './recent-tab-cycle';
import type { RecentTab, RecentTabsView } from './recent-tabs';

const tabs: RecentTab[] = Array.from({ length: 5 }, (_, id) => ({ id, title: `Tab ${id}`, url: '' }));

function fixture(load = async () => tabs) {
  const activate = vi.fn(async (_tabId: number) => {});
  const close = vi.fn(async (_tabId: number) => {});
  const onchange = vi.fn<(view: RecentTabsView | null) => void>();
  const onerror = vi.fn();
  const cycle = new RecentTabCycle({ client: { load, activate, close }, onchange, onerror });
  return { cycle, activate, close, onchange, onerror };
}

describe('recent tab cycle', () => {
  it.each([1, -1])('the first press in direction %s selects the previous tab even before loading completes', async (direction) => {
    let resolveTabs: (tabs: RecentTab[]) => void = () => {};
    const loaded = new Promise<RecentTab[]>((resolve) => { resolveTabs = resolve; });
    const { cycle, activate } = fixture(() => loaded);
    cycle.step(direction);
    cycle.commit();
    resolveTabs(tabs);
    await vi.waitFor(() => expect(activate).toHaveBeenCalledWith(1));
  });

  it('applies backward movement only after the first press and wraps from the current tab', async () => {
    const { cycle, onchange } = fixture();
    cycle.step(-1);
    await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith({ tabs, selected: 1 }));
    cycle.step(-1);
    await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith({ tabs, selected: 0 }));
    cycle.step(-1);
    await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith({ tabs, selected: 4 }));
    cycle.step(1);
    await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith({ tabs, selected: 0 }));
  });

  it('freezes one list while held, wraps, and activates only on release', async () => {
    const load = vi.fn(async () => tabs);
    const { cycle, activate, onchange } = fixture(load);
    cycle.step();
    cycle.step();
    await vi.waitFor(() => expect(onchange).toHaveBeenCalledWith({ tabs, selected: 2 }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
    cycle.step(4);
    cycle.commit();
    await vi.waitFor(() => expect(activate).toHaveBeenCalledWith(1));
  });

  it('commits a quick tap even when release precedes the async query', async () => {
    let resolveTabs: (tabs: RecentTab[]) => void = () => {};
    const loaded = new Promise<RecentTab[]>((resolve) => { resolveTabs = resolve; });
    const { cycle, activate, onchange } = fixture(() => loaded);
    cycle.step();
    cycle.commit();
    resolveTabs(tabs);
    await vi.waitFor(() => expect(activate).toHaveBeenCalledWith(1));
    expect(onchange.mock.calls.every(([view]) => view === null)).toBe(true);
  });

  it('serializes rapid separate taps so they toggle between the two latest tabs', async () => {
    let current = [...tabs];
    const activate = vi.fn(async (tabId: number) => {
      await Promise.resolve();
      current = [...current.filter((tab) => tab.id === tabId), ...current.filter((tab) => tab.id !== tabId)];
    });
    const cycle = new RecentTabCycle({
      client: { load: async () => [...current], activate, close: async () => {} }, onchange: () => {}, onerror: () => {},
    });
    cycle.step(); cycle.commit();
    cycle.step(); cycle.commit();
    await vi.waitFor(() => expect(activate.mock.calls).toEqual([[1], [0]]));
  });

  it('cancels without activation, including during loading', async () => {
    const { cycle, activate } = fixture();
    cycle.step(); cycle.cancel(); cycle.commit();
    await Promise.resolve();
    expect(activate).not.toHaveBeenCalled();
    expect(cycle.active).toBe(false);
  });

  it('handles no tabs and a rejected activation without blocking the next gesture', async () => {
    const empty = fixture(async () => []);
    empty.cycle.step(); empty.cycle.commit();
    await Promise.resolve();
    expect(empty.activate).not.toHaveBeenCalled();
    const { cycle, activate, onerror } = fixture();
    activate.mockRejectedValueOnce(new Error('Tab closed'));
    cycle.step(); cycle.commit();
    await vi.waitFor(() => expect(onerror).toHaveBeenCalledTimes(1));
    cycle.step(); cycle.commit();
    await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(2));
  });

  it('closes only the highlighted preview and keeps the next one selected without activating it', async () => {
    const { cycle, close, activate, onchange } = fixture();
    cycle.step();
    cycle.closeSelected();
    const remaining = tabs.filter((tab) => tab.id !== 1);
    await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith({ tabs: remaining, selected: 1 }));
    expect(close).toHaveBeenCalledWith(1);
    expect(activate).not.toHaveBeenCalled();
    cycle.commit();
    await vi.waitFor(() => expect(activate).toHaveBeenCalledWith(2));
  });

  it('waits for a pending close before committing and ignores repeated close events in flight', async () => {
    let finishClose: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishClose = resolve; });
    const { cycle, close, activate } = fixture();
    close.mockImplementation(() => pending);
    cycle.step();
    cycle.closeSelected();
    cycle.closeSelected();
    cycle.commit();
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(activate).not.toHaveBeenCalled();
    finishClose();
    await vi.waitFor(() => expect(activate).toHaveBeenCalledWith(2));
  });

  it('clamps the highlight when closing the last preview, and keeps hover independent of activation', async () => {
    const { cycle, close, onchange, activate } = fixture();
    cycle.step();
    cycle.select(4);
    cycle.closeSelected();
    await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith({ tabs: tabs.slice(0, 4), selected: 3 }));
    expect(close).toHaveBeenCalledWith(4);
    expect(activate).not.toHaveBeenCalled();
  });

  it('preserves a newly clicked tab when a previous close is still pending', async () => {
    let finishClose: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishClose = resolve; });
    const { cycle, close, activate } = fixture();
    close.mockImplementation(() => pending);
    cycle.step(); cycle.closeSelected(); cycle.commit(3);
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(1));
    finishClose();
    await vi.waitFor(() => expect(activate).toHaveBeenCalledWith(3));
  });

  it('keeps a tab in the switcher if closing it fails', async () => {
    const { cycle, close, onchange, onerror } = fixture();
    close.mockRejectedValueOnce(new Error('Close rejected'));
    cycle.step();
    cycle.closeSelected();
    await vi.waitFor(() => expect(onerror).toHaveBeenCalledTimes(1));
    expect(onchange).toHaveBeenLastCalledWith({ tabs, selected: 1 });
    expect(cycle.active).toBe(true);
  });

  it('dismisses when the last remaining preview closes', async () => {
    const { cycle, close, onchange } = fixture(async () => tabs.slice(0, 1));
    cycle.step();
    cycle.closeSelected();
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(0));
    await vi.waitFor(() => expect(cycle.active).toBe(false));
    expect(onchange).toHaveBeenLastCalledWith(null);
  });
});
