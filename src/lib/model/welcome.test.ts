import { describe, expect, it } from 'vitest';
import { type SetupState, setupProgress, setupSteps, welcomeShortcuts } from './welcome';

const fresh: SetupState = {
  panelSeen: false,
  side: 'right',
  sideKept: false,
  onToolbar: false,
  arcInvite: true,
  arcImported: false,
};
const done = (state: SetupState) => Object.fromEntries(setupSteps(state).map((step) => [step.id, step.done]));
const arcStep = (state: SetupState) => setupSteps(state).find((step) => step.id === 'arc')!;

describe('setupSteps', () => {
  it('starts with nothing done on a fresh install', () => {
    expect(done(fresh)).toEqual({ open: false, side: false, pin: false, arc: false });
  });

  it('counts the panel once it has shown', () => {
    expect(done({ ...fresh, panelSeen: true }).open).toBe(true);
  });

  it('counts the side as settled on the left', () => {
    expect(done({ ...fresh, side: 'left' }).side).toBe(true);
  });

  it('counts the side as settled when kept on the right', () => {
    expect(done({ ...fresh, sideKept: true }).side).toBe(true);
  });

  it('leaves the side open where Chrome cannot tell it, until the user settles it', () => {
    expect(done({ ...fresh, side: null }).side).toBe(false);
    expect(done({ ...fresh, side: null, sideKept: true }).side).toBe(true);
  });

  it('counts the icon once pinned', () => {
    expect(done({ ...fresh, onToolbar: true }).pin).toBe(true);
  });

  it('lists the steps in page order', () => {
    expect(setupSteps(fresh).map((step) => step.id)).toEqual(['open', 'side', 'pin', 'arc']);
  });

  it('offers the Arc import as an optional step while the invite stands', () => {
    expect(arcStep(fresh)).toEqual({ id: 'arc', done: false, optional: true, skipped: false });
  });

  it('counts the Arc step done once Arc Spaces came in', () => {
    expect(arcStep({ ...fresh, arcInvite: false, arcImported: true })).toMatchObject({ done: true, skipped: false });
  });

  it('counts the Arc step skipped once its invite was dismissed without importing', () => {
    expect(arcStep({ ...fresh, arcInvite: false })).toMatchObject({ done: false, skipped: true });
  });
});

describe('setupProgress', () => {
  it('counts the steps done', () => {
    expect(setupProgress(setupSteps({ ...fresh, panelSeen: true }))).toEqual({ done: 1, total: 2, allDone: false });
  });

  it('is all done once every step it needs is, the optional ones aside', () => {
    const state = { ...fresh, panelSeen: true, side: 'left' } as const;
    expect(setupProgress(setupSteps(state))).toEqual({ done: 2, total: 2, allDone: true });
  });

  it('never counts the optional steps (the pinned icon, the Arc import), done or not', () => {
    const both = { ...fresh, onToolbar: true, arcInvite: false, arcImported: true };
    expect(setupProgress(setupSteps(both))).toEqual({ done: 0, total: 2, allDone: false });
  });
});

describe('welcomeShortcuts', () => {
  const shortcut = (name: string, keys: string) => ({ name, description: '', keys });

  it('lists the sidebar, Search and the tab switcher, by short names, in that order', () => {
    const assigned = [shortcut('cycle-recent-tabs', '⌃Q'), shortcut('toggle-sidebar', '⌃B'), shortcut('open-palette', '⌃M')];
    expect(welcomeShortcuts(assigned)).toEqual([
      { label: 'Sidebar', keys: 'Ctrl+B' },
      { label: 'Search', keys: 'Ctrl+M' },
      { label: 'Recent tabs', keys: 'Ctrl+Q' },
    ]);
  });

  it('leaves out the shortcuts the user unassigned, and the ones it does not show', () => {
    const assigned = [shortcut('toggle-sidebar', ''), shortcut('open-palette', 'Ctrl+M'), shortcut('next-space', 'Ctrl+1')];
    expect(welcomeShortcuts(assigned)).toEqual([{ label: 'Search', keys: 'Ctrl+M' }]);
  });
});
