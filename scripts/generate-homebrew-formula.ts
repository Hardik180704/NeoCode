import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [version, checksumsPath, outputPath = "Formula/neocode.rb"] = process.argv.slice(2);
if (!version || !checksumsPath) {
  console.error("Usage: bun scripts/generate-homebrew-formula.ts <version> <SHA256SUMS> [output]");
  process.exit(1);
}

const repository = process.env.NEOCODE_REPOSITORY ?? "Hardik180704/NeoCode";
const checksums = new Map(
  (await readFile(resolve(checksumsPath), "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const [checksum, filename] = line.trim().split(/\s+/, 2);
      if (!checksum || !filename) throw new Error(`Invalid checksum line: ${line}`);
      return [filename, checksum];
    }),
);

function asset(target: string) {
  const filename = `neocode-v${version}-${target}.tar.gz`;
  const checksum = checksums.get(filename);
  if (!checksum) throw new Error(`Missing checksum for ${filename}`);
  return {
    url: `https://github.com/${repository}/releases/download/v${version}/${filename}`,
    checksum,
  };
}

const darwinArm = asset("darwin-arm64");
const darwinIntel = asset("darwin-x64");
const linuxArm = asset("linux-arm64");
const linuxIntel = asset("linux-x64");

const formula = `# typed: strict
# frozen_string_literal: true

# Homebrew formula for the NeoCode standalone CLI.
class Neocode < Formula
  desc "AI-powered terminal coding agent"
  homepage "https://github.com/${repository}"
  version "${version}"

  on_macos do
    on_arm do
      url "${darwinArm.url}"
      sha256 "${darwinArm.checksum}"
    end
    on_intel do
      url "${darwinIntel.url}"
      sha256 "${darwinIntel.checksum}"
    end
  end

  on_linux do
    on_arm do
      url "${linuxArm.url}"
      sha256 "${linuxArm.checksum}"
    end
    on_intel do
      url "${linuxIntel.url}"
      sha256 "${linuxIntel.checksum}"
    end
  end

  def install
    bin.install "neocode"
  end

  test do
    assert_match "neocode #{version}", shell_output("#{bin}/neocode --version")
  end
end
`;

const destination = resolve(outputPath);
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, formula);
console.log(destination);
