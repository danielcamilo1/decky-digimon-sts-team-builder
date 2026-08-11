declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

/**
 * Inlined by @decky/rollup: imports of this module are replaced with the parsed
 * contents of plugin.json at build time.
 */
declare module "@decky/manifest" {
  const manifest: { name: string; author: string; [key: string]: unknown };
  export default manifest;
}
