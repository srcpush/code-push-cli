import { defineConfig } from "vite";
import { resolve } from "pathe";
import { readFileSync, writeFileSync } from "fs";
import pkg from "./package.json";

const external = [
  /^node:/,
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

function preserveCliShebang(): import("vite").Plugin {
  return {
    name: "preserve-cli-shebang",
    closeBundle() {
      const cliPath = resolve(__dirname, "dist/cli.js");
      const content = readFileSync(cliPath, "utf8");
      if (!content.startsWith("#!/usr/bin/env node")) {
        writeFileSync(cliPath, `#!/usr/bin/env node\n${content}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [preserveCliShebang()],
  build: {
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    target: "node18",
    sourcemap: true,
    rollupOptions: {
      input: {
        cli: resolve(__dirname, "src/cli.ts"),
        index: resolve(__dirname, "src/index.ts"),
      },
      external,
      output: {
        format: "cjs",
        entryFileNames: "[name].js",
        exports: "auto",
      },
    },
  },
});
