declare const NEOCODE_VERSION: string | undefined;
declare const NEOCODE_OPENTUI_LIBC: string | undefined;

const version = typeof NEOCODE_VERSION === "string" ? NEOCODE_VERSION : "dev";
const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  console.log(`neocode ${version}`);
} else if (args.includes("--help") || args.includes("-h")) {
  console.log(`NeoCode ${version}

Usage:
  neocode [options]

Options:
  -h, --help       Show this help message
  -v, --version    Show the installed NeoCode version

Environment:
  API_URL          Override the NeoCode API endpoint`);
} else if (args.length > 0) {
  console.error(`Unknown option: ${args[0]}\nRun 'neocode --help' for usage.`);
  process.exitCode = 1;
} else {
  if (typeof NEOCODE_OPENTUI_LIBC === "string" && NEOCODE_OPENTUI_LIBC) {
    process.env.OPENTUI_LIBC = NEOCODE_OPENTUI_LIBC;
  }
  await import("./app");
}
