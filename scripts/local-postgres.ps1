$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskLocal = Join-Path $taskRoot '.local'
$taskData = Join-Path $taskLocal 'postgres'
$taskBin = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' } | Where-Object { Test-Path (Join-Path $_ 'initdb.exe') } | Select-Object -First 1
if (-not $taskBin) { throw 'PostgreSQL nije instaliran. Instalirajte PostgreSQL ili podesite DATABASE_URL.' }
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
$taskPasswordFile = Join-Path $taskLocal 'postgres-password'
if (-not (Test-Path $taskPasswordFile)) {
  $taskBytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($taskBytes)
  [Convert]::ToBase64String($taskBytes) | Set-Content -LiteralPath $taskPasswordFile -NoNewline
}
$taskPassword = Get-Content -LiteralPath $taskPasswordFile -Raw
if (-not (Test-Path (Join-Path $taskData 'PG_VERSION'))) {
  & (Join-Path $taskBin 'initdb.exe') -D $taskData -U lensos --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$taskPasswordFile
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL initdb nije uspio.' }
}
& (Join-Path $taskBin 'pg_ctl.exe') status -D $taskData 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $taskBin 'pg_ctl.exe') start -D $taskData -l (Join-Path $taskLocal 'postgres.log') -o '-h 127.0.0.1 -p 55432 -c timezone=Europe/Sarajevo -c max_connections=40 -c shared_buffers=64MB' -w
  if ($LASTEXITCODE -ne 0) { throw 'Pokretanje PostgreSQL nije uspjelo. Provjerite .local/postgres.log.' }
}
$taskPreviousPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $taskPassword
  foreach ($taskDatabase in @('lensos_demo', 'lensos_dev', 'lensos_test')) {
    $taskExists = & (Join-Path $taskBin 'psql.exe') -h 127.0.0.1 -p 55432 -U lensos -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$taskDatabase'"
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL konekcija nije uspjela.' }
    if ($taskExists -ne '1') {
      & (Join-Path $taskBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U lensos $taskDatabase
      if ($LASTEXITCODE -ne 0) { throw "Kreiranje baze $taskDatabase nije uspjelo." }
    }
  }
} finally { $env:PGPASSWORD = $taskPreviousPassword }
$taskEnvFile = Join-Path $taskRoot '.env'
if (-not (Test-Path $taskEnvFile)) {
  $taskEncodedPassword = [Uri]::EscapeDataString($taskPassword)
  @"
DATABASE_URL=postgresql://lensos:$taskEncodedPassword@127.0.0.1:55432/lensos_demo?schema=public&connection_limit=5
TEST_DATABASE_URL=postgresql://lensos:$taskEncodedPassword@127.0.0.1:55432/lensos_test?schema=public&connection_limit=5
APP_MODE=demo
LENSOS_TIME_ZONE=Europe/Sarajevo
PORT=3001
"@ | Set-Content -LiteralPath $taskEnvFile -Encoding UTF8
  Write-Host 'Kreiran je lokalni .env za demo. Lozinka baze nije prikazana.'
} else { Write-Host '.env vec postoji i nije promijenjen.' }
Write-Host 'PostgreSQL je spreman na 127.0.0.1:55432; demo, razvojna i testna baza su odvojene.'
