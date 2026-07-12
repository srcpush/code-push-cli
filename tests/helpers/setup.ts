import { afterEach } from "vitest";

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});
