import { access } from "node:fs/promises";
import { resolve } from "node:path";

const executable = process.argv[2];
const expectedVersion = process.argv[3];
if (!executable || !expectedVersion) {
  console.error("Usage: bun scripts/smoke-release.ts <executable> <version>");
  process.exit(1);
}

const executablePath = resolve(executable);
await access(executablePath);

async function run(args: string[]) {
  const processHandle = Bun.spawn([executablePath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`${executablePath} ${args.join(" ")} failed (${exitCode}): ${stderr}`);
  }
  return stdout;
}

const versionOutput = await run(["--version"]);
if (!versionOutput.includes(`neocode ${expectedVersion}`)) {
  throw new Error(`Unexpected version output: ${versionOutput}`);
}

const helpOutput = await run(["--help"]);
if (!helpOutput.includes("Usage:") || !helpOutput.includes("API_URL")) {
  throw new Error(`Unexpected help output: ${helpOutput}`);
}

console.log(`Smoke test passed: ${executablePath}`);
