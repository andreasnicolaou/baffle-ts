import {
  DEFAULT_CHARACTERS,
  DEFAULT_EXCLUDE,
  DEFAULT_REVEAL_DURATION,
  DEFAULT_SPEED,
  createTicker,
  normalize,
  prefersReducedMotion,
  resolveElements,
  timestamp,
  type TickHandler,
} from './util';

export type BaffleTarget = string | Element | Iterable<Element> | ArrayLike<Element>;

export interface BaffleOptions {
  characters?: string | readonly string[];
  exclude?: string | readonly string[];
  speed?: number;
  random?: () => number;
  respectReducedMotion?: boolean;
}

export interface RevealOptions {
  duration?: number;
  delay?: number;
}

export type TextResolver = string | ((currentText: string, element: Element, index: number) => string);

interface TextState {
  element: Element;
  original: string;
  text: string;
}

interface RevealJob {
  startedAt?: number;
  duration: number;
  timeout?: ReturnType<typeof setTimeout>;
  resolve: (value: Baffle) => void;
}

/**
 * Manages the obfuscation and reveal lifecycle for one or more DOM elements.
 * Instances retain their original text until {@link Baffle.text} or
 * {@link Baffle.refresh} replaces it.
 *
 * @author Andreas Nicolaou
 */
export class Baffle {
  private readonly states: TextState[];
  private readonly ticker = createTicker();
  private characters = DEFAULT_CHARACTERS;
  private exclude = DEFAULT_EXCLUDE;
  private speed = DEFAULT_SPEED;
  private random = Math.random;
  private respectReducedMotion = true;
  private lastPaint = Number.NEGATIVE_INFINITY;
  private revealJob: RevealJob | undefined;

  /**
   * Creates an effect for the supplied target elements.
   * Selector targets require a browser `document`; element targets can be
   * created wherever those elements already exist.
   *
   * @memberof Baffle
   */
  constructor(target: BaffleTarget, options: BaffleOptions = {}) {
    this.states = resolveElements(target).map((element) => {
      const text = element.textContent!;

      return { element, original: text, text };
    });
    this.configure(options);
  }

  /**
   * Starts repeatedly scrambling text until {@link Baffle.stop},
   * {@link Baffle.reveal}, or {@link Baffle.destroy} is called.
   *
   * @memberof Baffle
   */
  public start(): this {
    this.stop();

    if (this.animationDisabled()) {
      this.restore();

      return this;
    }

    this.once();
    this.ticker.start(this.obfuscateTick);

    return this;
  }

  /**
   * Stops the current animation without restoring text. An active
   * {@link Baffle.reveal} promise resolves with this instance.
   *
   * @memberof Baffle
   */
  public stop(): this {
    this.ticker.stop();
    this.clearRevealJob()?.resolve(this);

    return this;
  }

  /**
   * Applies one obfuscation frame without starting a repeating animation.
   *
   * @memberof Baffle
   */
  public once(): this {
    if (this.animationDisabled()) {
      this.stop();
      this.restore();

      return this;
    }

    this.paintAll();
    this.lastPaint = timestamp();

    return this;
  }

  /**
   * Starts revealing the original text and resolves when it finishes or is
   * interrupted by {@link Baffle.stop}, {@link Baffle.start}, or another reveal.
   *
   * @memberof Baffle
   */
  public reveal(durationOrOptions: number | RevealOptions = DEFAULT_REVEAL_DURATION, delay = 0): Promise<Baffle> {
    return new Promise((resolve) => {
      this.beginReveal(durationOrOptions, delay, resolve);
    });
  }

  /**
   * Updates options. Changes apply to subsequent animation frames immediately.
   *
   * @memberof Baffle
   */
  public set(nextOptions: BaffleOptions): this {
    this.configure(nextOptions);

    return this;
  }

  /**
   * Replaces the text managed by this instance.
   *
   * @memberof Baffle
   */
  public text(value: TextResolver): this {
    this.states.forEach((state, index) => {
      const text = typeof value === 'function' ? value(state.text, state.element, index) : value;

      state.original = text;
      state.text = text;
      state.element.textContent = text;
    });

    return this;
  }

  /**
   * Reads each managed element's current DOM text as the next reveal value.
   *
   * @memberof Baffle
   */
  public refresh(): this {
    for (const state of this.states) {
      const text = state.element.textContent!;

      state.original = text;
      state.text = text;
    }

    return this;
  }

  /**
   * Stops any animation and restores the managed text.
   *
   * @memberof Baffle
   */
  public destroy(): this {
    this.stop();
    this.restore();

    return this;
  }

  private configure(next: BaffleOptions): void {
    this.characters = next.characters === undefined ? this.characters : normalize(next.characters);
    this.exclude = next.exclude === undefined ? this.exclude : DEFAULT_EXCLUDE + normalize(next.exclude);
    this.speed = next.speed === undefined || !Number.isFinite(next.speed) || next.speed <= 0 ? this.speed : next.speed;
    this.random = next.random ?? this.random;
    this.respectReducedMotion = next.respectReducedMotion ?? this.respectReducedMotion;
  }

  private animationDisabled(): boolean {
    return this.respectReducedMotion && prefersReducedMotion();
  }

  private pick(): string {
    const position = Math.min(Math.max(this.random() || 0, 0), 1 - Number.EPSILON);

    return this.characters[Math.floor(position * this.characters.length)]!;
  }

  private paint(state: TextState, revealed = 0): void {
    let output = '';
    let index = 0;

    for (const character of state.text) {
      output += index++ < revealed || this.exclude.includes(character) ? character : this.pick();
    }

    state.element.textContent = output;
  }

  private paintAll(progress = 0): void {
    for (const state of this.states) {
      this.paint(state, Math.floor(state.text.length * progress));
    }
  }

  private restore(): void {
    for (const state of this.states) {
      state.element.textContent = state.original;
    }
  }

  private dueForPaint(now: number): boolean {
    if (now - this.lastPaint < this.speed) {
      return false;
    }

    this.lastPaint = now;

    return true;
  }

  private clearRevealJob(): RevealJob | undefined {
    const job = this.revealJob;

    if (job?.timeout !== undefined) {
      clearTimeout(job.timeout);
    }

    this.revealJob = undefined;

    return job;
  }

  private finishReveal(): void {
    const job = this.clearRevealJob();

    this.ticker.stop();
    this.restore();
    job?.resolve(this);
  }

  private readonly obfuscateTick: TickHandler = (now) => {
    if (this.dueForPaint(now)) {
      this.paintAll();
    }
  };

  private readonly revealTick: TickHandler = (now) => {
    if (!this.revealJob) {
      return;
    }

    this.revealJob.startedAt ??= now;

    const progress = Math.min((now - this.revealJob.startedAt) / this.revealJob.duration, 1);

    if (progress >= 1) {
      this.finishReveal();

      return;
    }

    if (this.dueForPaint(now)) {
      this.paintAll(progress);
    }
  };

  private startReveal(duration: number): void {
    if (duration <= 0) {
      this.finishReveal();

      return;
    }

    this.ticker.stop();
    this.ticker.start(this.revealTick);
  }

  private beginReveal(
    durationOrOptions: number | RevealOptions,
    delay: number,
    resolve: (value: Baffle) => void
  ): void {
    const settings: RevealOptions =
      typeof durationOrOptions === 'number' ? { duration: durationOrOptions, delay } : durationOrOptions;
    const requestedDuration = settings.duration ?? DEFAULT_REVEAL_DURATION;
    const duration = Number.isFinite(requestedDuration) ? Math.max(requestedDuration, 0) : DEFAULT_REVEAL_DURATION;
    const requestedWait = settings.delay ?? 0;
    const wait = Number.isFinite(requestedWait) ? Math.max(requestedWait, 0) : 0;

    this.stop();

    if (this.animationDisabled()) {
      this.restore();
      resolve(this);

      return;
    }

    this.once();
    this.revealJob = { duration, resolve };

    if (wait > 0) {
      this.revealJob.timeout = setTimeout(() => this.startReveal(duration), wait);

      return;
    }

    this.startReveal(duration);
  }
}

/** Creates a {@link Baffle} instance for the supplied DOM target. */
export const baffle = (target: BaffleTarget, options: BaffleOptions = {}): Baffle => new Baffle(target, options);
