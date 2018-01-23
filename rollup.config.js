
import buble from 'rollup-plugin-buble';
import eslint from 'rollup-plugin-eslint';
import pkg from './package.json';

export default [
    {
        input: pkg.module,
        output: [
            { file: pkg.main, format: 'cjs', sourcemap: true },
        ],
        external: ['stream', 'debug', 'usb'],
        plugins: [
            eslint(),
            buble(),
        ]
    }
];
