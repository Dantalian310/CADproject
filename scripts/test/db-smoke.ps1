param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 5432,
  [string]$Database = "cloudcad",
  [string]$Username = "cloudcad",
  [string]$Password = "cloudcad_dev_password"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$psql = Join-Path $root ".local\postgresql-16.14\pgsql\bin\psql.exe"
$env:PGPASSWORD = $Password

$tables = & $psql -h $HostName -p $Port -U $Username -d $Database -Atc "select table_name from information_schema.tables where table_schema='public' order by table_name;"
if ($LASTEXITCODE -ne 0) {
  throw "psql failed"
}

$required = @(
  "document_versions",
  "documents",
  "operation_logs",
  "project_invitations",
  "project_members",
  "projects",
  "system_events",
  "users"
)

foreach ($table in $required) {
  if ($tables -notcontains $table) {
    throw "Missing table: $table"
  }
  Write-Host "[PASS] table exists: $table"
}

Write-Host "Database smoke test completed."
