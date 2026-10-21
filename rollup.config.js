import deckyPlugin from "@decky/rollup";
import { createRequire } from "module";
import copy from "rollup-plugin-copy";

// The second-screen page reuses the Rollup plugins @decky/rollup already depends on,
// so it adds no build dependencies of its own. pnpm keeps them nested, hence the require.
const fromDecky = createRequire(createRequire(import.meta.url).resolve("@decky/rollup/package.json"));
const load = (name) => {
  const mod = fromDecky(name);
  return mod.default ?? mod;
};
const typescript = load("@rollup/plugin-typescript");
const commonjs = load("@rollup/plugin-commonjs");
const json = load("@rollup/plugin-json");
const replace = load("@rollup/plugin-replace");
const { nodeResolve } = fromDecky("@rollup/plugin-node-resolve");

export default [
  // The Decky preset wipes ./dist at buildStart, so the asset copy has to happen
  // afterwards. Everything under assets/ ends up in dist/assets/, which decky-loader
  // serves (CSRF-exempt) at http://127.0.0.1:1337/plugins/<plugin name>/assets/<path>.
  deckyPlugin({
    plugins: [
      copy({
        targets: [{ src: "assets/*", dest: "dist/assets" }],
        hook: "writeBundle",
        // 475 sprites: don't log a line per file.
        verbose: false,
      }),
    ],
  }),

  // The touch builder for a browser on a second screen, served by py_modules/second_screen.py.
  // A plain web page rather than a Decky bundle: it brings its own React, and must not
  // import @decky/ui, which only exists inside Steam. Built after the Decky preset so
  // its dist wipe doesn't take this output with it.
  {
    input: "src/second-screen/main.tsx",
    plugins: [
      typescript({ outDir: "dist/second-screen", noEmitOnError: true }),
      json(),
      nodeResolve({ browser: true }),
      commonjs(),
      replace({ preventAssignment: true, "process.env.NODE_ENV": JSON.stringify("production") }),
      copy({
        targets: [{ src: "src/second-screen/static/*", dest: "dist/second-screen" }],
        hook: "writeBundle",
      }),
    ],
    output: { file: "dist/second-screen/app.js", format: "iife", sourcemap: false },
  },
];
