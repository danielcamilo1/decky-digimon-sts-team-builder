import deckyPlugin from "@decky/rollup";
import copy from "rollup-plugin-copy";

// The Decky preset wipes ./dist at buildStart, so the asset copy has to happen
// afterwards. Everything under assets/ ends up in dist/assets/, which decky-loader
// serves (CSRF-exempt) at http://127.0.0.1:1337/plugins/<plugin name>/assets/<path>.
export default deckyPlugin({
  plugins: [
    copy({
      targets: [{ src: "assets/*", dest: "dist/assets" }],
      hook: "writeBundle",
      // 475 sprites: don't log a line per file.
      verbose: false,
    }),
  ],
});
