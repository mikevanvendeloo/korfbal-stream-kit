<#
.SYNOPSIS
  Maakt een backup van de Streamz-database (pg_dump, gewone SQL) in backups\ naast docker-compose.yml.

.DESCRIPTION
  De database moet draaien (start.cmd). Het bestand heet backups\streamz-<label>-<datum-tijd>.sql en is met
  restore.cmd terug te zetten. De afbeeldingen (storage\, uploads\) zitten niet in de database: met -WithFiles komt
  er een zip van die mappen naast.

.EXAMPLE
  .\backup.ps1                       # backups\streamz-backup-20261120-101500.sql
  .\backup.ps1 -Label voor-seizoen   # backups\streamz-voor-seizoen-20261120-101500.sql
  .\backup.ps1 -WithFiles            # ook backups\streamz-bestanden-<datum-tijd>.zip
#>
[CmdletBinding()]
param(
  [string]$Label = 'backup',
  [switch]$WithFiles,
  [string]$ConfigFile
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$configPath = Resolve-ConfigPath $ConfigFile
Confirm-Docker
$streamzArgs = Get-StreamzArgs $configPath

$file = Backup-StreamzDatabase $streamzArgs $Label
if (-not $file) { throw 'De database draait niet. Start Streamz eerst met start.cmd.' }

if ($WithFiles) {
  $folders = @('storage', 'uploads') | ForEach-Object { Join-Path $Root $_ } | Where-Object { Test-Path $_ }
  if ($folders) {
    $zip = Join-Path $Root ("backups\streamz-bestanden-{0}.zip" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Write-Host "Afbeeldingen naar $zip ..."
    Compress-Archive -Path $folders -DestinationPath $zip
  } else {
    Write-Warning 'Geen storage\ of uploads\ gevonden; geen zip gemaakt.'
  }
}

Write-Host ''
Write-Host "Klaar. Terugzetten: restore.cmd `"$file`""
