import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const input = 'dist/esm/index.js';
const minify = terser({
  compress: {
    passes: 2,
  },
  mangle: true,
  module: true,
});

export default [
  {
    input,
    output: [
      {
        file: 'dist/index.js',
        format: 'esm',
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        exports: 'named',
      },
    ],
    plugins: [minify],
  },
  {
    input,
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'Baffle',
      exports: 'named',
    },
  },
  {
    input,
    output: {
      file: 'dist/index.umd.min.js',
      format: 'umd',
      name: 'Baffle',
      exports: 'named',
    },
    plugins: [minify],
  },
  {
    input: 'dist/types/index.d.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
