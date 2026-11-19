<#
.SYNOPSIS
  Zet een backup (pg_dump, gewone SQL) terug in de Streamz-database. De huidige database wordt vervangen.

.DESCRIPTION
  Zonder bestand: de nieuwste backup in backups\. Het script vraagt eerst om bevestiging en maakt een backup van de
  huidige database (backups\streamz-voor-restore-...), stopt de API en de Kit, maakt de database leeg, leest de backup
  in en start Streamz weer. De migratie-job brengt een backup van een oudere versie daarna op het schema van de
  huidige API. OWNER-regels worden overgeslagen, zodat ook een backup van een andere installatie past.

.EXAMPLE
  .\restore.ps1                                        # de nieuwste backup in backups\
  .\restore.ps1 backups\streamz-backup-20261120-101500.sql
  .\restore.ps1 D:\oud\streamz-2025.sql -Yes           # zonder te vragen
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$File,
  [string]$ConfigFile,
  [switch]$SkipBackup,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$configPath = Resolve-ConfigPath $ConfigFile

# Welke backup
if (-not $File) {
  $newest = Get-ChildItem (Join-Path $Root 'backups') -Filter '*.sql' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $newest) { throw 'Geen backup gevonden in backups\. Geef het bestand op: restore.cmd <bestand.sql>' }
  $File = $newest.FullName
}
if (-not [IO.Path]::IsPathRooted($File)) {
  $inRoot = Join-Path $Root $File
  $File = if (Test-Path $inRoot) { $inRoot } else { Join-Path (Get-Location) $File }
}
if (-not (Test-Path $File -PathType Leaf)) { throw "Backup $File bestaat niet." }
$item = Get-Item $File
if ($item.Length -lt 1000) { throw "Backup $File is verdacht klein ($($item.Length) bytes)." }

Write-Host ''
Write-Host ("Backup:  {0}" -f $item.FullName)
Write-Host ("Grootte: {0:N1} MB, gemaakt {1:dd-MM-yyyy HH:mm}" -f ($item.Length / 1MB), $item.LastWriteTime)
Write-Host 'De huidige database van Streamz wordt hiermee VERVANGEN. Streamz is een paar minuten niet bereikbaar.'
if (-not $Yes) {
  $answer = Read-Host 'Doorgaan? Typ ja'
  if ($answer.Trim().ToLowerInvariant() -ne 'ja') { Write-Host 'Gestopt, er is niets veranderd.'; return }
}

Confirm-Docker
Confirm-NoOtherProject 'korfbal-streamz-api' 'streamz'
$streamzArgs = Get-StreamzArgs $configPath

# De database moet draaien (de rest niet)
if (-not (Test-DatabaseRunning $streamzArgs)) {
  Write-Host 'De database starten...'
  Invoke-Compose ($streamzArgs + @('up', '-d', '--wait', 'streamz-db'))
}

$safety = $null
if (-not $SkipBackup) {
  $safety = Backup-StreamzDatabase $streamzArgs 'voor-restore'
}

Write-Host 'API en Kit stoppen...'
Invoke-Compose ($streamzArgs + @('stop', 'korfbal-streamz-api', 'korfbal-streamz-kit'))

try {
  Write-Host 'Backup naar de database-container kopieren...'
  Invoke-Compose ($streamzArgs + @('cp', $item.FullName, 'streamz-db:/tmp/streamz-restore.sql'))
  # Eigenaar-regels van een andere installatie zouden de restore laten stoppen; alles komt van de eigen gebruiker
  Invoke-Compose ($streamzArgs + @('exec', '-T', 'streamz-db', 'sed', '-i', '/ OWNER TO /d', '/tmp/streamz-restore.sql'))

  Write-Host 'Database leegmaken...'
  Invoke-Compose ($streamzArgs + @('exec', '-T', 'streamz-db', 'psql', '-U', $DbUser, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
    '-c', "DROP DATABASE IF EXISTS $DbName WITH (FORCE);", '-c', "CREATE DATABASE $DbName OWNER $DbUser;"))

  Write-Host 'Backup inlezen (dit kan even duren)...'
  Invoke-Compose ($streamzArgs + @('exec', '-T', 'streamz-db', 'psql', '-q', '-U', $DbUser, '-d', $DbName, '-v', 'ON_ERROR_STOP=1',
    '-f', '/tmp/streamz-restore.sql', '-o', '/dev/null'))
} catch {
  Write-Host ''
  Write-Warning "De restore is mislukt: $($_.Exception.Message)"
  if ($safety) {
    Write-Host "De database van voor de restore staat in $safety. Terugzetten:"
    Write-Host "  restore.cmd `"$safety`" -SkipBackup"
  }
  throw
} finally {
  Get-ComposeOutput ($streamzArgs + @('exec', '-T', 'streamz-db', 'rm', '-f', '/tmp/streamz-restore.sql')) | Out-Null
}

Write-Host 'Streamz starten (de migratie-job brengt de database op het schema van deze versie)...'
Invoke-Compose ($streamzArgs + @('up', '-d'))
Wait-Http 'http://localhost:3333/api/health' 'De API' | Out-Null

Write-Host ''
Write-Host "Klaar: $($item.Name) staat terug."
if ($safety) { Write-Host "De database van voor de restore staat in $safety." }
