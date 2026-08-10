#!/usr/bin/env sh
set -eu

repository="${NEOCODE_REPOSITORY:-Hardik180704/NeoCode}"
install_dir="${NEOCODE_INSTALL_DIR:-${HOME}/.local/bin}"
requested_version="${NEOCODE_VERSION:-latest}"

command -v curl >/dev/null 2>&1 || {
  echo "NeoCode installer requires curl." >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *)
    echo "Unsupported operating system: $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64|aarch64) architecture="arm64" ;;
  x86_64|amd64) architecture="x64" ;;
  *)
    echo "Unsupported CPU architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

suffix="${os}-${architecture}"
if [ "$os" = "linux" ] && ldd --version 2>&1 | grep -qi musl; then
  suffix="${suffix}-musl"
fi

if [ "$requested_version" = "latest" ]; then
  release_url="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/${repository}/releases/latest")"
  tag="${release_url##*/}"
else
  case "$requested_version" in
    v*) tag="$requested_version" ;;
    *) tag="v${requested_version}" ;;
  esac
fi

case "$tag" in
  v*) version="${tag#v}" ;;
  *)
    echo "Could not determine the NeoCode release version." >&2
    exit 1
    ;;
esac

asset="neocode-v${version}-${suffix}.tar.gz"
base_url="https://github.com/${repository}/releases/download/${tag}"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT INT TERM

curl -fsSL "${base_url}/${asset}" -o "${temporary_directory}/${asset}"
curl -fsSL "${base_url}/SHA256SUMS" -o "${temporary_directory}/SHA256SUMS"

expected_checksum="$(awk -v filename="$asset" '$2 == filename { print $1 }' "${temporary_directory}/SHA256SUMS")"
if [ -z "$expected_checksum" ]; then
  echo "No checksum was published for ${asset}." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  actual_checksum="$(sha256sum "${temporary_directory}/${asset}" | awk '{ print $1 }')"
else
  actual_checksum="$(shasum -a 256 "${temporary_directory}/${asset}" | awk '{ print $1 }')"
fi

if [ "$expected_checksum" != "$actual_checksum" ]; then
  echo "Checksum verification failed for ${asset}." >&2
  exit 1
fi

tar -xzf "${temporary_directory}/${asset}" -C "$temporary_directory"
mkdir -p "$install_dir"
cp "${temporary_directory}/neocode" "${install_dir}/neocode"
chmod 755 "${install_dir}/neocode"

echo "NeoCode ${version} installed at ${install_dir}/neocode"
case ":${PATH}:" in
  *":${install_dir}:"*) ;;
  *)
    echo "Add ${install_dir} to PATH, then restart your shell:"
    echo "  export PATH=\"${install_dir}:\$PATH\""
    ;;
esac
"${install_dir}/neocode" --version
