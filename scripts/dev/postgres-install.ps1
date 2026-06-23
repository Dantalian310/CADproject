param(
  [string]$Version = "16.14",
  [string]$Password = "cloudcad_dev_password"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$local = Join-Path $root ".local"
$archive = Join-Path $local "postgresql-$Version-1-windows-x64-binaries.zip"
$install = Join-Path $local "postgresql-$Version"
$pgBin = Join-Path $install "pgsql\bin"
$pgData = Join-Path $local "pgdata"
$pwFile = Join-Path $local "pgpass-init.txt"
$url = "https://get.enterprisedb.com/postgresql/postgresql-$Version-1-windows-x64-binaries.zip"

New-Item -ItemType Directory -Force $local | Out-Null

if (-not (Test-Path $archive)) {
  Write-Host "Downloading PostgreSQL $Version..."
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive
}

if (-not (Test-Path $pgBin)) {
  Write-Host "Extracting PostgreSQL $Version..."
  New-Item -ItemType Directory -Force $install | Out-Null
  Expand-Archive -LiteralPath $archive -DestinationPath $install -Force
}

if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
  Write-Host "Initializing PostgreSQL data directory..."
  Set-Content -LiteralPath $pwFile -Value $Password -Encoding ASCII
  & (Join-Path $pgBin "initdb.exe") -D $pgData -U cloudcad -A scram-sha-256 --pwfile=$pwFile --encoding=UTF8 --locale=C
}

Write-Host "PostgreSQL is prepared at $install"
Write-Host "Data directory: $pgData"
