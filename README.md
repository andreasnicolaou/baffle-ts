<h1 align="center">baffle-ts</h1>

<p align="center">Tiny, dependency-free DOM text obfuscation and reveal effects for JavaScript &amp; TypeScript.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/baffle-ts"><img src="https://img.shields.io/npm/v/baffle-ts.svg?style=flat-square&colorB=51C838" alt="NPM Version"></a>
  <a href="https://bundlephobia.com/package/baffle-ts"><img src="https://img.shields.io/bundlephobia/minzip/baffle-ts?style=flat-square&color=45cc11" alt="Gzip Size"></a>
</p>

![TypeScript](https://img.shields.io/badge/TS-TypeScript-3178c6?logo=typescript&logoColor=white)
![GitHub contributors](https://img.shields.io/github/contributors/andreasnicolaou/baffle-ts)
![GitHub License](https://img.shields.io/github/license/andreasnicolaou/baffle-ts)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/andreasnicolaou/baffle-ts/build.yaml)
![GitHub package.json version](https://img.shields.io/github/package-json/v/andreasnicolaou/baffle-ts)
![Bundle Size](https://deno.bundlejs.com/badge?q=baffle-ts&treeshake=[*])

![ESLint](https://img.shields.io/badge/linter-eslint-4B32C3.svg?logo=eslint)
![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?logo=prettier)
![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18.svg?logo=vitest)
![Maintenance](https://img.shields.io/maintenance/yes/2026)
[![Socket Badge](https://badge.socket.dev/npm/package/baffle-ts)](https://badge.socket.dev/npm/package/baffle-ts)

![NPM Downloads](https://img.shields.io/npm/dm/baffle-ts)

<p align="center"><b><a href="https://andreasnicolaou.github.io/baffle-ts/">Live demo</a></b></p>

---

> baffle-ts targets DOM text, obfuscates it with configurable characters, and reveals it over time. It is dependency-free, framework-agnostic, typed, and ships ESM, CommonJS, UMD, minified UMD, and TypeScript declarations.

```ts
import { baffle } from 'baffle-ts';

const title = baffle('.headline', {
  characters: 'abcdefghijklmnopqrstuvwxyz0123456789',
  speed: 45,
});

title.start();
await title.reveal(900);
```

- **Dependency-free runtime** - no framework or utility dependencies.
- **Tiny bundle** - Bundlewatch checks every JavaScript output.
- **Framework-agnostic** - pass a selector, `Element`, `NodeList`, or any element collection.
- **Typed API** - TypeScript declarations are included.
- **Multiple builds** - ESM, CommonJS, UMD, and minified UMD.

## Credit

baffle-ts is a modern TypeScript rewrite inspired by [**baffle.js**](https://github.com/camwiegert/baffle) by [Cam Wiegert](http://camwiegert.com), which has been archived since 2020. The original is MIT licensed and its copyright notice is retained in [LICENSE](./LICENSE).

This is a from-scratch implementation, not a fork. It keeps the shape of baffle's API because that API was good, while modernising the internals and the build. See [Differences from baffle.js](#differences-from-bafflejs) before migrating.

## Getting Started

### Installation

```bash
npm install baffle-ts
```

### Live demo

The demo is hosted on GitHub Pages:

**[andreasnicolaou.github.io/baffle-ts](https://andreasnicolaou.github.io/baffle-ts/)**

You can also run `npm run build`, serve the repository root with any static file server, and open [`docs/index.html`](./docs/index.html).

### Browser Usage

```html
<h1 data-headline>baffle-ts</h1>

<script src="https://unpkg.com/baffle-ts/dist/index.umd.min.js"></script>
<script>
  const title = Baffle.baffle('[data-headline]');
  title.start();
  title.reveal(900);
</script>
```

### API

```ts
const instance = baffle(target, options);
```

`target` can be a CSS selector, a single `Element`, or an iterable/array-like collection of elements.

```ts
baffle('.headline');
baffle(document.querySelector('.headline')!);
baffle(document.querySelectorAll('.headline'));
```

`baffle()` is the convenience factory and returns a `Baffle` instance. You can also construct the class directly when that better fits your code:

```ts
import { Baffle } from 'baffle-ts';

const instance = new Baffle('.headline', { speed: 45 });
```

### Framework integration

`baffle-ts` works with React, Vue, Angular, Svelte, and other browser frameworks because it operates on real DOM elements rather than framework-specific components. Create an instance only after the element has mounted, and call `destroy()` when the owning component unmounts.

For server-side rendering, initialize baffle-ts on the client. Selector targets require `document`; passing an existing `Element` is safe in environments where a DOM element is available.

The library updates `textContent` directly, so let it own the animated element's text while an effect is active. Avoid rendering competing text into that same element from the framework until the effect has finished or been destroyed.

### Options

- `characters`: string or array of characters used while text is obfuscated.
- `exclude`: string or array of characters that should not be replaced.
- `speed`: minimum milliseconds between obfuscation frames.
- `random`: custom random number function, useful for deterministic tests.
- `respectReducedMotion`: honour `prefers-reduced-motion`. Defaults to `true`.

### Instance Methods

- `start()`: repeatedly obfuscates unrevealed text.
- `stop()`: stops active animation without revealing.
- `once()`: performs one obfuscation frame.
- `reveal(duration?, delay?)`: reveals text over time and resolves with the instance when the reveal finishes or is stopped.
- `set(options)`: updates animation options, including mid-animation.
- `text(valueOrResolver)`: replaces the managed text.
- `refresh()`: reads the current DOM text back into the instance.
- `destroy()`: stops animation and restores the managed text.

### Waiting for a reveal

`reveal()` returns a real promise, so code can wait for the reveal to settle:

```ts
// Configure with the usual chain, then reveal
const title = baffle('.headline')
  .start()
  .set({ speed: 100 })
  .text(() => 'Hi dad!');

// Await completion before starting the next action
await title.reveal(900);
showTheNextThing();

// It is a genuine promise, so it composes
await Promise.all([title.reveal(400), subtitle.reveal(600)]);
```

Calling `stop()`, `start()`, or a new reveal interrupts an active `reveal()` call and resolves its promise with the instance.

### Accessibility

When the user has `prefers-reduced-motion: reduce` set, baffle-ts skips obfuscation entirely and leaves text readable: `start()` and `once()` render the real text, and `reveal()` restores it and resolves immediately. Scrambled-but-static text would be less readable than the animation it replaces, so nothing is obfuscated at all.

Opt out with `respectReducedMotion: false`. Outside a browser, or where `matchMedia` is unavailable, animation runs normally.

### Rendering

The animation loop is driven by `requestAnimationFrame`, so it stays in step with the display, avoids interval drift, and pauses automatically in background tabs. `speed` throttles how often characters churn. Where frames are unavailable, it falls back to `setTimeout`.

## Differences from baffle.js

All six baffle.js methods keep their names and argument shapes, so most code moves across unchanged. The remaining differences are defaults and additions:

|                             | baffle.js `0.3.6`                   | baffle-ts                        |
| --------------------------- | ----------------------------------- | -------------------------------- |
| `reveal()` default duration | `0`                                 | `600`                            |
| `reveal()` return value     | instance                            | `Promise<Baffle>`                |
| Default `characters`        | `Aa…Zz~!@#$%^&*()-+=[]{}\|;:,./<>?` | `A–Z a–z 0–9 #%&*+-=?@`          |
| Default `exclude`           | `[' ']`                             | `' \t\n\r'`                      |
| `exclude` semantics         | replaces the default                | **appends** to the default       |
| `text()` argument           | function only                       | string **or** function           |
| `text()` resolver signature | `(currentText)`                     | `(currentText, element, index)`  |
| Animation loop              | `setInterval`                       | `requestAnimationFrame`          |
| Reduced motion              | not handled                         | obfuscation skipped by default   |
| Extra methods               | —                                   | `refresh()`, `destroy()`         |
| Extra options               | —                                   | `random`, `respectReducedMotion` |

### Migrating from baffle.js

Most method calls move across unchanged. `reveal()` now returns a promise, so retain the instance when later code needs to configure or stop it. The other changes that alter behaviour are the defaults:

```ts
// Restore baffle.js's character set and instant reveal
const b = baffle('.headline', {
  characters: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz~!@#$%^&*()-+=[]{}|;:,./<>?',
});

await b.reveal(0);
```

Whitespace beyond the space character (`\t`, `\n`, `\r`) is excluded by default, and anything you pass to `exclude` is added to that set rather than replacing it.

Users with `prefers-reduced-motion: reduce` will see no obfuscation at all. If you need the previous unconditional behaviour, pass `respectReducedMotion: false`.

## Development

```bash
npm install
npm run check
npm run test:coverage
```

The check script runs ESLint, Prettier validation, Vitest, the Rollup build, and Bundlewatch. `test:coverage` runs the same test suite with V8 coverage enabled and enforces 100% statements, lines, and functions, plus at least 95% branch coverage.

## License

baffle-ts is licensed under the [MIT License](./LICENSE) (c) Andreas Nicolaou, incorporating the MIT-licensed copyright notice of baffle.js (c) Cam Wiegert.
