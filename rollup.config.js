import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

const config = defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'build/bundle.esm.mjs',
      format: 'esm',
    },
    {
      file: 'build/bundle.umd.js',
      format: 'umd',
      name: 'zimulatoor',
      globals: {
        'ethers': 'ethers'
      }
    }
  ],
  external: [
    'react',
    'react-dom',
    'ethers'
  ],
  plugins: [
    replace({
      values: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      },
      preventAssignment: true,
    }),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      outputToFilesystem: true,
      compilerOptions: {
        declaration: true,
        declarationDir: "./build"
      }
    }),
    resolve({
      browser: true,
      dedupe: ['ethers'],
      preferBuiltins: false,
    }),
    commonjs(),
    terser()
  ]
})

export default [
  config,
]
