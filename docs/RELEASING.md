# Releasing NeoCode

NeoCode releases consist of a Railway API deployment and standalone CLI binaries
published through GitHub Releases. The CLI embeds no credentials and uses the
production Railway API by default.

## One-time repository configuration

1. Protect `main` and require the `CI / validate` check.
2. Create the `Hardik180704/homebrew-tap` public repository with a `Formula`
   directory and a protected `main` branch.
3. Add this Actions variable to the NeoCode repository:
   - `HOMEBREW_TAP_REPOSITORY=Hardik180704/homebrew-tap`
4. Add `HOMEBREW_TAP_TOKEN` as an Actions secret. Use a fine-grained token or
   GitHub App token restricted to the tap repository with Contents and Pull
   requests write access.
5. Ensure Railway defines `CLERK_FRONTEND_API` and `CLERK_OAUTH_CLIENT_ID`; the
   public `/auth/config` endpoint supplies these public OAuth identifiers to the
   installed CLI.

Do not place database URLs, Clerk secret keys, provider API keys, billing keys,
or other credentials in GitHub variables used by the binary build.

## Creating a release

1. Merge the release changes into `main`.
2. Update `packages/cli/package.json` to the intended semantic version.
3. Confirm Railway is deployed and healthy.
4. Run the CI workflow successfully on `main`.
5. Create and push a matching tag:

   ```sh
   git tag -s v0.1.0 -m "NeoCode v0.1.0"
   git push origin v0.1.0
   ```

The tag must match the CLI version. Tags with a prerelease suffix, such as
`v0.1.0-beta.1`, are published as GitHub prereleases.

The release workflow validates the project, builds eight platform targets,
creates archives and checksums, generates GitHub provenance attestations, and
publishes the GitHub Release. If Homebrew is configured, it then tests the new
formula and opens an update PR in the tap repository.

## Verifying release assets

```sh
gh release download v0.1.0
shasum -a 256 -c SHA256SUMS
gh attestation verify neocode-v0.1.0-darwin-arm64.tar.gz \
  --repo Hardik180704/NeoCode
```

Before promoting the first stable release, test the TUI, login, chat, local
tools, billing flow, and NeoLens on clean macOS, Linux, and Windows machines.

## Homebrew

Users install the formula directly from the tap:

```sh
brew install Hardik180704/tap/neocode
```

After the automated formula PR is reviewed and merged, `brew update` and
`brew upgrade neocode` deliver the new version.

## Code signing

GitHub checksums and attestations are enabled by default. Apple Developer ID
signing/notarization and Windows Authenticode signing require organization-owned
certificates and must be added before removing prerelease status from public
downloads.
