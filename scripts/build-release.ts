import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SUPPORTED_TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64-baseline",
  "bun-linux-arm64-musl",
  "bun-linux-x64-musl-baseline",
  "bun-windows-arm64",
  "bun-windows-x64-baseline",
] as const;

type ReleaseTarget = (typeof SUPPORTED_TARGETS)[number];

const target = process.argv[2] as ReleaseTarget | undefined;
if (!target || !SUPPORTED_TARGETS.includes(target)) {
  console.error(`Usage: bun scripts/build-release.ts <target>\n\nTargets:\n${SUPPORTED_TARGETS.join("\n")}`);
  process.exit(1);
}

const packageJson = JSON.parse(
  await readFile(resolve("packages/cli/package.json"), "utf8"),
) as { version?: string };
const version = process.env.NEOCODE_RELEASE_VERSION ?? packageJson.version;
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid NeoCode release version: ${version ?? "missing"}`);
}

const expectedTag = process.env.GITHUB_REF_NAME;
if (expectedTag?.startsWith("v") && expectedTag.slice(1) !== version) {
  throw new Error(`Git tag ${expectedTag} does not match CLI version ${version}`);
}

const artifactTarget = target
  .replace(/^bun-/, "")
  .replace(/-baseline$/, "");
const isWindows = target.includes("windows");
const isMusl = target.includes("musl");
const outputDirectory = resolve("artifacts", artifactTarget);
const outputPath = resolve(outputDirectory, isWindows ? "neocode.exe" : "neocode");
await mkdir(outputDirectory, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve("packages/cli/src/index.tsx")],
  minify: true,
  define: {
    NEOCODE_VERSION: JSON.stringify(version),
    NEOCODE_OPENTUI_LIBC: JSON.stringify(isMusl ? "musl" : ""),
  },
  compile: {
    target,
    outfile: outputPath,
    autoloadDotenv: false,
    autoloadBunfig: false,
    autoloadTsconfig: true,
    autoloadPackageJson: true,
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(outputPath);
