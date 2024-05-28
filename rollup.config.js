import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'build/bundle.mjs',
      format: 'esm',
    }
  ],
  external: [
    'react',
    'react-dom',
  ],
  plugins: [
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      outputToFilesystem: true,
      compilerOptions: {
        declaration: true,
        declarationDir: "./build"
      }
    }),
    resolve(),
    commonjs(),
    terser()
  ]
})
