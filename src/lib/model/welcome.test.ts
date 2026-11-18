import { describe, expect, it } from 'vitest';
import { archiveDelayText, type SetupState, setupProgress, setupSteps } from './welcome';

const fresh: SetupState = { panelSeen: false, side: 'right', sideKept: false, onToolbar: false };
const done = (state: SetupState) => Object.fromEntries(setupSteps(state).map((step) => [step.id, step.done]));

describe('setupSteps', () => {
  it('starts with nothing done on a fresh install', () => {
    expect(done(fresh)).toEqual({ open: false, side: false, pin: false });
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
    expect(setupSteps(fresh).map((step) => step.id)).toEqual(['open', 'side', 'pin']);
  });
});

describe('setupProgress', () => {
  it('counts the steps done', () => {
    expect(setupProgress(setupSteps({ ...fresh, panelSeen: true }))).toEqual({ done: 1, total: 3, allDone: false });
  });

  it('is all done once every step is', () => {
    const state = { panelSeen: true, side: 'left', sideKept: false, onToolbar: true } as const;
    expect(setupProgress(setupSteps(state))).toEqual({ done: 3, total: 3, allDone: true });
  });
});

describe('archiveDelayText', () => {
  it('names the delay the way Settings lists it', () => {
    expect(archiveDelayText(1)).toBe('an hour');
    expect(archiveDelayText(12)).toBe('12 hours');
    expect(archiveDelayText(24)).toBe('a day');
    expect(archiveDelayText(48)).toBe('2 days');
    expect(archiveDelayText(168)).toBe('a week');
  });

  it('is empty when tabs are never closed', () => {
    expect(archiveDelayText(0)).toBe('');
  });
});
