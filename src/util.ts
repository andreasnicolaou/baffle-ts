export const DEFAULT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+-=?@';

export const DEFAULT_EXCLUDE = ' \t\n\r';

export const DEFAULT_SPEED = 50;

export const DEFAULT_REVEAL_DURATION = 600;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type ElementTarget = string | Element | Iterable<Element> | ArrayLike<Element>;

/** Flattens a character option to a string, falling back to the default set. */
export const normalize = (value: string | readonly string[]): string => {
  const characters = typeof value === 'string' ? value : value.join('');

  return characters || DEFAULT_CHARACTERS;
};

/** Whether a value is a DOM element, including elements from another realm. */
export const isElement = (value: unknown): value is Element => {
  return typeof value === 'object' && value !== null && 'nodeType' in value && value.nodeType === 1;
};

/** Resolves a supported target into a concrete list of DOM elements. */
export const resolveElements = (target: ElementTarget): Element[] => {
  if (typeof target === 'string') {
    if (typeof document === 'undefined') {
      throw new ReferenceError('Selector targets require a DOM document.');
    }

    return Array.from(document.querySelectorAll(target));
  }

  return isElement(target) ? [target] : Array.from(target).filter(isElement);
};

/** Whether the user has asked for reduced motion in a browser environment. */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

export type TickHandler = (now: number) => void;

const FALLBACK_FRAME_MS = 16;

/** Frame-compatible clock, so throttling shares the timebase rAF reports. */
export const timestamp = (): number => {
  return typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : Date.now();
};

const requestFrame = (handler: TickHandler): number => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(handler);
  }

  return setTimeout(() => handler(timestamp()), FALLBACK_FRAME_MS) as unknown as number;
};

const cancelFrame = (handle: number): void => {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);

    return;
  }

  clearTimeout(handle);
};

export interface Ticker {
  start: (onTick: TickHandler) => void;
  stop: () => void;
  isRunning: () => boolean;
}

/** Creates an animation-frame loop with a timeout fallback. */
export const createTicker = (): Ticker => {
  let handle: number | undefined;

  const ticker: Ticker = {
    start: (onTick) => {
      if (handle !== undefined) {
        return;
      }

      const step: TickHandler = (now) => {
        handle = requestFrame(step);
        onTick(now);
      };

      handle = requestFrame(step);
    },

    stop: () => {
      if (handle === undefined) {
        return;
      }

      cancelFrame(handle);
      handle = undefined;
    },

    isRunning: () => handle !== undefined,
  };

  return ticker;
};
