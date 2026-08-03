import { afterEach, describe, expect, it, vi } from 'vitest';
import { Baffle, baffle } from '../src/index';

/** Vitest does not fake animation frames by default, so opt in explicitly. */
const useFrameTimers = (): void => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
};

const stubReducedMotion = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches,
    media,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const textOf = (selector: string): string | null | undefined => document.querySelector(selector)?.textContent;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('baffle', () => {
  it('creates an instance from a selector and obfuscates text', () => {
    document.body.innerHTML = '<h1 class="headline">Hello world</h1>';

    const instance = baffle('.headline', {
      characters: 'x',
      random: () => 0,
    });

    expect(instance).toBeInstanceOf(Baffle);
    expect(instance).toHaveProperty('reveal');

    instance.once();

    expect(textOf('.headline')).toBe('xxxxx xxxxx');
  });

  it('respects excluded characters', () => {
    document.body.innerHTML = '<p id="copy">A/B C</p>';

    baffle('#copy', {
      characters: 'z',
      exclude: '/',
      random: () => 0,
    }).once();

    expect(textOf('#copy')).toBe('z/z z');
  });

  it('clamps custom random values to the configured character set', () => {
    document.body.innerHTML = '<p id="copy">AB</p>';

    baffle('#copy', { characters: 'xy', random: () => 1 }).once();
    expect(textOf('#copy')).toBe('yy');

    document.querySelector('#copy')!.textContent = 'AB';
    baffle('#copy', { characters: 'xy', random: () => -1 }).once();
    expect(textOf('#copy')).toBe('xx');
  });

  it('accepts elements and element collections as targets', () => {
    document.body.innerHTML = '<p>one</p><p>two</p>';

    baffle(document.querySelectorAll('p'), { characters: 'q', random: () => 0 }).once();
    expect([...document.querySelectorAll('p')].map((element) => element.textContent)).toEqual(['qqq', 'qqq']);

    document.body.innerHTML = '<span>abc</span>';
    baffle(document.querySelector('span')!, { characters: 'w', random: () => 0 }).once();
    expect(textOf('span')).toBe('www');
  });

  it('accepts array-like element collections', () => {
    document.body.innerHTML = '<p id="first">one</p><p id="second">two</p>';

    const elements = document.querySelectorAll('p');
    const arrayLike = { 0: elements[0]!, 1: elements[1]!, length: elements.length };

    baffle(arrayLike, { characters: 'q', random: () => 0 }).once();

    expect([...document.querySelectorAll('p')].map((element) => element.textContent)).toEqual(['qqq', 'qqq']);
  });

  it('treats selectors without matches as a no-op', () => {
    const instance = baffle('.missing', { characters: 'x', random: () => 0 });

    expect(() => instance.once().start().stop().destroy()).not.toThrow();
  });

  it('requires a document only for selector targets', () => {
    document.body.innerHTML = '<p id="copy">Server</p>';
    const element = document.querySelector('#copy')!;

    vi.stubGlobal('document', undefined);

    expect(() => baffle('#copy')).toThrowError('Selector targets require a DOM document.');
    expect(() => baffle(element, { characters: 'x', random: () => 0 }).once()).not.toThrow();
    expect(element.textContent).toBe('xxxxxx');
  });

  it('animates until reveal restores the managed text', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">Reveal</p>';

    const instance = baffle('#copy', {
      characters: 'x',
      speed: 10,
      random: () => 0,
    });

    const revealed = instance.reveal(100, 20);

    expect(textOf('#copy')).toBe('xxxxxx');

    await vi.advanceTimersByTimeAsync(300);
    await revealed;

    expect(textOf('#copy')).toBe('Reveal');
  });

  it('reveals immediately when duration is zero', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">Instant</p>';

    const instance = baffle('#copy', { characters: 'x', random: () => 0 });

    await expect(instance.reveal(0)).resolves.toBe(instance);

    expect(textOf('#copy')).toBe('Instant');
  });

  it('normalizes negative and non-finite reveal timings', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">Timing</p>';

    await baffle('#copy', { characters: 'x', random: () => 0 }).reveal({ duration: -1, delay: -1 });
    expect(textOf('#copy')).toBe('Timing');

    await baffle('#copy', { characters: 'x', random: () => 0 }).reveal({
      duration: 0,
      delay: Number.POSITIVE_INFINITY,
    });
    expect(textOf('#copy')).toBe('Timing');

    for (const duration of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const nonFinite = baffle('#copy', { characters: 'x', random: () => 0 }).reveal(duration);

      await vi.advanceTimersByTimeAsync(1000);
      await expect(nonFinite).resolves.toBeDefined();
    }

    expect(textOf('#copy')).toBe('Timing');
  });

  it('uses the default duration and delay for an empty reveal options object', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">Defaults</p>';

    const revealed = baffle('#copy', { characters: 'x', random: () => 0 }).reveal({});

    await vi.advanceTimersByTimeAsync(1000);
    await expect(revealed).resolves.toBeDefined();
    expect(textOf('#copy')).toBe('Defaults');
  });

  it('accepts an options object for reveal', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">Options</p>';

    const revealed = baffle('#copy', { characters: 'x', random: () => 0 }).reveal({ duration: 80, delay: 10 });

    await vi.advanceTimersByTimeAsync(300);
    await revealed;

    expect(textOf('#copy')).toBe('Options');
  });

  describe('reveal', () => {
    it('is a real promise and resolves with the instance', async () => {
      useFrameTimers();
      document.body.innerHTML = '<p id="copy">Resolved</p>';

      const instance = baffle('#copy', { characters: 'x', random: () => 0 });
      const revealed = instance.reveal(50);

      expect(revealed).toBeInstanceOf(Promise);

      await vi.advanceTimersByTimeAsync(300);

      expect(await revealed).toBe(instance);
    });

    it('composes with Promise.all', async () => {
      useFrameTimers();
      document.body.innerHTML = '<p id="a">AA</p><p id="b">BB</p>';

      const first = baffle('#a', { characters: 'x', random: () => 0 }).reveal(40);
      const second = baffle('#b', { characters: 'x', random: () => 0 }).reveal(60);

      await vi.advanceTimersByTimeAsync(300);
      await Promise.all([first, second]);

      expect(textOf('#a')).toBe('AA');
      expect(textOf('#b')).toBe('BB');
    });

    it('settles when stopped early, leaving text obfuscated', async () => {
      useFrameTimers();
      document.body.innerHTML = '<p id="copy">Halted</p>';

      const instance = baffle('#copy', { characters: 'x', speed: 10, random: () => 0 });
      const revealed = instance.reveal(1000);

      await vi.advanceTimersByTimeAsync(50);
      instance.stop();

      await expect(revealed).resolves.toBe(instance);
      expect(textOf('#copy')).not.toBe('Halted');
    });

    it('settles when a delayed reveal is stopped before it starts', async () => {
      useFrameTimers();
      document.body.innerHTML = '<p id="copy">Delayed</p>';

      const instance = baffle('#copy', { characters: 'x', random: () => 0 });
      const revealed = instance.reveal({ duration: 100, delay: 500 });

      instance.stop();

      await expect(revealed).resolves.toBe(instance);
      await vi.advanceTimersByTimeAsync(1000);
      expect(textOf('#copy')).not.toBe('Delayed');
    });

    it('switches back to obfuscation when start interrupts a reveal', async () => {
      useFrameTimers();
      document.body.innerHTML = '<p id="copy">Restart</p>';

      const instance = baffle('#copy', { characters: 'x', speed: 10, random: () => 0 });
      const revealed = instance.reveal(1000);

      instance.start();

      await expect(revealed).resolves.toBe(instance);
      expect(textOf('#copy')).toBe('xxxxxxx');

      instance.stop();
    });
  });

  it('updates managed text with a resolver', () => {
    document.body.innerHTML = '<p>one</p><p>two</p>';

    baffle(document.querySelectorAll('p')).text((currentText, _element, index) => {
      return `${index}:${currentText.toUpperCase()}`;
    });

    expect([...document.querySelectorAll('p')].map((element) => element.textContent)).toEqual(['0:ONE', '1:TWO']);
  });

  it('accepts a plain string for text', () => {
    document.body.innerHTML = '<p id="copy">before</p>';

    baffle('#copy').text('after');

    expect(textOf('#copy')).toBe('after');
  });

  it('starts and stops repeated scrambling on animation frames', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">ABC</p>';

    const instance = baffle('#copy', { characters: 'xyz', speed: 10, random: () => 0 });

    instance.start();
    expect(textOf('#copy')).toBe('xxx');

    await vi.advanceTimersByTimeAsync(50);
    expect(textOf('#copy')).toHaveLength(3);

    instance.stop();
    const afterStop = textOf('#copy');

    await vi.advanceTimersByTimeAsync(100);
    expect(textOf('#copy')).toBe(afterStop);
  });

  it('throttles repainting to the configured speed', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">ABCD</p>';

    const random = vi.fn(() => 0);

    baffle('#copy', { characters: 'x', speed: 1000, random }).start();

    const callsAfterFirstPaint = random.mock.calls.length;

    // Many frames elapse, but none reach the 1000ms throttle window.
    await vi.advanceTimersByTimeAsync(200);

    expect(random.mock.calls).toHaveLength(callsAfterFirstPaint);
  });

  it('applies option changes to a running animation', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">AB</p>';

    const instance = baffle('#copy', { characters: 'x', speed: 10, random: () => 0 });

    instance.start();
    instance.set({ characters: 'q' });

    await vi.advanceTimersByTimeAsync(50);

    expect(textOf('#copy')).toBe('qq');

    instance.stop();
  });

  it('refresh reads current DOM text back into the instance', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">old</p>';

    const instance = baffle('#copy', { characters: 'x', random: () => 0 });

    document.querySelector('#copy')!.textContent = 'new';
    instance.refresh();

    instance.reveal(0);

    expect(textOf('#copy')).toBe('new');
  });

  it('destroy stops animation and restores text', async () => {
    useFrameTimers();
    document.body.innerHTML = '<p id="copy">Original</p>';

    const instance = baffle('#copy', { characters: 'x', speed: 10, random: () => 0 });

    instance.start();
    instance.destroy();

    expect(textOf('#copy')).toBe('Original');

    await vi.advanceTimersByTimeAsync(100);

    expect(textOf('#copy')).toBe('Original');
  });

  describe('reduced motion', () => {
    it('skips obfuscation entirely when the user prefers reduced motion', async () => {
      useFrameTimers();
      stubReducedMotion(true);
      document.body.innerHTML = '<p id="copy">Readable</p>';

      const instance = baffle('#copy', { characters: 'x', speed: 10, random: () => 0 });

      instance.once();
      expect(textOf('#copy')).toBe('Readable');

      instance.start();
      await vi.advanceTimersByTimeAsync(100);
      expect(textOf('#copy')).toBe('Readable');

      await instance.reveal(500);
      expect(textOf('#copy')).toBe('Readable');
    });

    it('still animates when respectReducedMotion is false', () => {
      stubReducedMotion(true);
      document.body.innerHTML = '<p id="copy">Forced</p>';

      baffle('#copy', { characters: 'x', random: () => 0, respectReducedMotion: false }).once();

      expect(textOf('#copy')).toBe('xxxxxx');
    });

    it('animates normally when reduced motion is not requested', () => {
      stubReducedMotion(false);
      document.body.innerHTML = '<p id="copy">Normal</p>';

      baffle('#copy', { characters: 'x', random: () => 0 }).once();

      expect(textOf('#copy')).toBe('xxxxxx');
    });

    it('stops an active animation when reduced motion becomes preferred', async () => {
      useFrameTimers();
      stubReducedMotion(false);
      document.body.innerHTML = '<p id="copy">Changed</p>';

      const instance = baffle('#copy', { characters: 'x', speed: 10, random: () => 0 });
      instance.start();

      stubReducedMotion(true);
      instance.once();
      await vi.advanceTimersByTimeAsync(100);

      expect(textOf('#copy')).toBe('Changed');
    });
  });
});
