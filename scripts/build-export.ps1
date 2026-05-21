param(
  [string]$ImageRef = "agent_spaces-server:latest",
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path -LiteralPath (Join-Path $ScriptDir "..")
$Dockerfile = Join-Path $RootDir "Dockerfile.server"

if (-not $OutputPath) {
  $OutputPath = Join-Path $RootDir "agent_spaces-server.latest.tar"
}

$OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$OutputDir = Split-Path -Parent $OutputPath

if (-not (Test-Path -LiteralPath $Dockerfile)) {
  throw "Dockerfile not found: $Dockerfile"
}

if ($OutputDir -and -not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}

Write-Host "[build-export] Building image $ImageRef"
& docker build --file "$Dockerfile" --tag "$ImageRef" "$RootDir"
if ($LASTEXITCODE -ne 0) {
  throw "docker build failed with exit code $LASTEXITCODE"
}

Write-Host "[build-export] Exporting image to $OutputPath"
& docker save --output "$OutputPath" "$ImageRef"
if ($LASTEXITCODE -ne 0) {
  throw "docker save failed with exit code $LASTEXITCODE"
}

$File = Get-Item -LiteralPath $OutputPath
Write-Host "[build-export] Done: $($File.FullName) ($($File.Length) bytes)"
