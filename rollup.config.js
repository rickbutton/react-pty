import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs"
import typescript from "@rollup/plugin-typescript"

export default {
    input: "src/index.ts",
    output: [
        { 
            dir: "lib",
            name: "ReactPty",
            format: "umd",
            sourcemap: true,
            entryFileNames: "[name].[format].js",
        },
        { 
            dir: "lib",
            format: "es",
            sourcemap: true,
            entryFileNames: "[name].[format].js",
        },
    ],
    external: [
        "cli-highlight",
        "json5",
        "react",
        "react-reconciler",
        "string-width",
        "yoga-wasm",
    ],
    watch: {
        include: "src/**/*",
    },
    plugins: [
        typescript({
            declaration: true,
            declarationDir: "lib/",
            rootDir: "src/",
        }),
        commonjs(),
        resolve(),
    ],
};
