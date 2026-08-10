param(
  [string]$Version = "latest",
  [string]$InstallDir = "$env:LOCALAPPDATA\NeoCode\bin"
)

$ErrorActionPreference = "Stop"
$Repository = if ($env:NEOCODE_REPOSITORY) { $env:NEOCODE_REPOSITORY } else { "Hardik180704/NeoCode" }

$Architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
switch ($Architecture) {
  "x64" { $Target = "windows-x64" }
  "arm64" { $Target = "windows-arm64" }
  default { throw "Unsupported CPU architecture: $Architecture" }
}

if ($Version -eq "latest") {
  $Release = Invoke-RestMethod "https://api.github.com/repos/$Repository/releases/latest"
  $Tag = $Release.tag_name
} else {
  $Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
}

if (-not $Tag.StartsWith("v")) { throw "Invalid NeoCode release tag: $Tag" }
$ResolvedVersion = $Tag.Substring(1)
$Asset = "neocode-v$ResolvedVersion-$Target.zip"
$BaseUrl = "https://github.com/$Repository/releases/download/$Tag"
$TemporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("neocode-" + [guid]::NewGuid())

try {
  New-Item -ItemType Directory -Path $TemporaryDirectory | Out-Null
  $ArchivePath = Join-Path $TemporaryDirectory $Asset
  $ChecksumsPath = Join-Path $TemporaryDirectory "SHA256SUMS"
  Invoke-WebRequest "$BaseUrl/$Asset" -OutFile $ArchivePath
  Invoke-WebRequest "$BaseUrl/SHA256SUMS" -OutFile $ChecksumsPath

  $ChecksumLine = Get-Content $ChecksumsPath | Where-Object { $_ -match "\s$([regex]::Escape($Asset))$" } | Select-Object -First 1
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
