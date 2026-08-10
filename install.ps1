param(
  [string]$Version = "latest",
  [string]$InstallDir = "$env:LOCALAPPDATA\NeoCode\bin"
)

$ErrorActionPreference = "Stop"
$Repository = if ($env:NEOCODE_REPOSITORY) { $env:NEOCODE_REPOSITORY } else { "Hardik180704/NeoCode" }
$Headers = @{
  "User-Agent" = "NeoCode-Installer"
  "Accept" = "application/vnd.github+json"
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # PowerShell Core manages TLS automatically.
}

$Architecture = $env:PROCESSOR_ARCHITEW6432
if ([string]::IsNullOrWhiteSpace($Architecture)) {
  $Architecture = $env:PROCESSOR_ARCHITECTURE
}

switch -Regex ($Architecture) {
  "^(AMD64|x86_64)$" { $Target = "windows-x64"; break }
  "^(ARM64|AARCH64)$" { $Target = "windows-arm64"; break }
  default { throw "Unsupported CPU architecture: '$Architecture'" }
}

$VersionValue = [string]$Version
if ([string]::IsNullOrWhiteSpace($VersionValue) -or $VersionValue -eq "latest") {
  try {
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers $Headers
  } catch {
    throw "Unable to resolve the latest NeoCode release from GitHub for $Repository. Check your network connection or download a specific release from https://github.com/$Repository/releases."
  }
  $Tag = $Release.tag_name
} else {
  $Tag = if ($VersionValue -like "v*") { $VersionValue } else { "v$VersionValue" }
}

if ([string]::IsNullOrWhiteSpace($Tag) -or $Tag -notlike "v*") {
  throw "Invalid NeoCode release tag received from GitHub: '$Tag'"
}
$ResolvedVersion = $Tag -replace "^v", ""
$Asset = "neocode-v$ResolvedVersion-$Target.zip"
$BaseUrl = "https://github.com/$Repository/releases/download/$Tag"
$AssetUrl = "$BaseUrl/$Asset"
$ChecksumsUrl = "$BaseUrl/SHA256SUMS"

if ($Release -and $Release.assets) {
  $ReleaseAsset = $Release.assets | Where-Object { $_.name -eq $Asset } | Select-Object -First 1
  $ChecksumsAsset = $Release.assets | Where-Object { $_.name -eq "SHA256SUMS" } | Select-Object -First 1
  if ($ReleaseAsset -and $ReleaseAsset.browser_download_url) {
    $AssetUrl = $ReleaseAsset.browser_download_url
  }
  if ($ChecksumsAsset -and $ChecksumsAsset.browser_download_url) {
    $ChecksumsUrl = $ChecksumsAsset.browser_download_url
  }
}

$TemporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("neocode-" + [guid]::NewGuid())

try {
  New-Item -ItemType Directory -Path $TemporaryDirectory | Out-Null
  $ArchivePath = Join-Path $TemporaryDirectory $Asset
  $ChecksumsPath = Join-Path $TemporaryDirectory "SHA256SUMS"
  Invoke-WebRequest -Uri $AssetUrl -Headers $Headers -OutFile $ArchivePath
  Invoke-WebRequest -Uri $ChecksumsUrl -Headers $Headers -OutFile $ChecksumsPath

  $ChecksumLine = Get-Content $ChecksumsPath | Where-Object { $_ -match "(^|\s)\*{0,1}$([regex]::Escape($Asset))$" } | Select-Object -First 1
  if (-not $ChecksumLine) { throw "No checksum was published for $Asset" }
  $ExpectedChecksum = ($ChecksumLine -split "\s+")[0].ToLowerInvariant()
  $ActualChecksum = (Get-FileHash -Algorithm SHA256 $ArchivePath).Hash.ToLowerInvariant()
  if ($ExpectedChecksum -ne $ActualChecksum) { throw "Checksum verification failed for $Asset" }

  $ExtractedPath = Join-Path $TemporaryDirectory "extracted"
  Expand-Archive -Path $ArchivePath -DestinationPath $ExtractedPath
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item (Join-Path $ExtractedPath "neocode.exe") (Join-Path $InstallDir "neocode.exe") -Force

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $PathEntries = @($UserPath -split ";" | Where-Object { $_ })
  if ($PathEntries -notcontains $InstallDir) {
    $UpdatedPath = (@($InstallDir) + $PathEntries) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $UpdatedPath, "User")
  }
  $env:Path = "$InstallDir;$env:Path"

  Write-Host "NeoCode $ResolvedVersion installed at $InstallDir\neocode.exe"
  & (Join-Path $InstallDir "neocode.exe") --version
} finally {
  if (Test-Path $TemporaryDirectory) {
    Remove-Item -Recurse -Force $TemporaryDirectory
  }
}
