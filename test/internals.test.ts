import { afterEach, describe, expect, it, vi } from 'vitest';
import { baffle } from '../src/index';
import { DEFAULT_CHARACTERS, createTicker, normalize, timestamp } from '../src/util';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('internal helpers', () => {
  it('normalizes character arrays and empty values', () => {
    expect(normalize(['a', 'b'])).toBe('ab');
    expect(normalize('')).toBe(DEFAULT_CHARACTERS);
    expect(normalize([])).toBe(DEFAULT_CHARACTERS);
  });

  it('uses Date.now when performance timing is unavailable', () => {
    vi.stubGlobal('performance', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(123);

    expect(timestamp()).toBe(123);
  });

  it('uses timeout frames when animation frames are unavailable', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);

    const ticker = createTicker();
    const onTick = vi.fn();

    ticker.start(onTick);
    ticker.start(onTick);
    vi.advanceTimersByTime(16);

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(ticker.isRunning()).toBe(true);

    ticker.stop();
    vi.advanceTimersByTime(32);

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(ticker.isRunning()).toBe(false);
  });

  it('ignores a reveal frame that arrives after the reveal was stopped', async () => {
    const frames: FrameRequestCallback[] = [];

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);

      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    document.body.innerHTML = '<p id="copy">Race</p>';

    const instance = baffle('#copy', { characters: 'x', random: () => 0 });
    const revealed = instance.reveal(100);

    instance.stop();
    expect(() => frames[0]!(0)).not.toThrow();
    instance.stop();

    await expect(revealed).resolves.toBe(instance);
  });
});
