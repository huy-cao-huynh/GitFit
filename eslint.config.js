// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions are a separate Deno runtime/toolchain (verified via
    // `deno check` / `deno test`, not this Node-based ESLint config) --
    // Deno globals and npm:/https: specifiers aren't valid here.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
