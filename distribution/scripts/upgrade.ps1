<#
.SYNOPSIS
  Upgrade (of zet terug) de Docker-images van Streamz (API, Kit) en/of de venue-bridge.

.DESCRIPTION
  Zonder versie: per app de laatste release-tag (yyyy.mm.n) op Docker Hub. Een release bouwt alleen de apps
  die veranderd zijn, dus API, Kit en bridge kunnen elk een andere versie hebben.
  De gekozen versies komen in streamz.local.env, zodat start.cmd daarna dezelfde versies start.
  Verandert de API-versie, dan maakt het script eerst een backup van de database in backups\
  (terugzetten naar een oudere versie draait de migraties niet terug). De database-image (postgres:16-alpine)
  wordt ook opgehaald, zodat de laatste 16.x-patch erin komt.

.EXAMPLE
  .\upgrade.ps1                                  # alles naar de laatste release
  .\upgrade.ps1 -Version 2026.11.2               # die versie voor alle apps (moet voor elke app bestaan)
  .\upgrade.ps1 -Api 2026.11.2 -Kit 2026.11.1    # per app
  .\upgrade.ps1 -Only bridge -Bridge 2026.11.3
  .\upgrade.ps1 -Yes                             # zonder te vragen
#>
[CmdletBinding()]
param(
  [string]$Version,
  [string]$Api,
  [string]$Kit,
  [string]$Bridge,
  [ValidateSet('all', 'streamz', 'bridge')]
  [string]$Only = 'all',
  [string]$ConfigFile,
  [switch]$SkipBackup,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
Initialize-Tls

$configPath = Resolve-ConfigPath $ConfigFile
$cfg = Read-StreamzConfig $configPath
$doStreamz = ($Only -eq 'streamz') -or ($Only -eq 'all' -and (Test-Enabled $cfg 'RUN_STREAMZ'))
$doBridge = ($Only -eq 'bridge') -or ($Only -eq 'all' -and (Test-Enabled $cfg 'RUN_BRIDGE'))
if (-not $doStreamz -and -not $doBridge) {
  throw "Er staat niets aan: zet RUN_STREAMZ en/of RUN_BRIDGE op true in $configPath"
}

$apps = @()
if ($doStreamz) { $apps += @('api', 'kit') }
if ($doBridge) { $apps += 'bridge' }
$explicit = @{ api = $Api; kit = $Kit; bridge = $Bridge }

# Doelversies bepalen en controleren
$target = @{}
foreach ($app in $apps) {
  $repo = $Repos[$app]
  $tag = $explicit[$app]
  if (-not $tag) { $tag = $Version }
  if ($tag) {
    if (-not (Test-TagExists $repo $tag)) {
      $latest = Get-LatestTag $repo
      throw "$repo`:$tag bestaat niet op Docker Hub (laatste release: $latest)."
    }
  } else {
    $tag = Get-LatestTag $repo
  }
  $target[$app] = $tag
}

Write-Host ''
Write-Host 'Upgrade:'
foreach ($app in $apps) {
  $current = $cfg[$VersionKeys[$app]]
  if (-not $current) { $current = '(standaard uit compose)' }
  $mark = if ($current -eq $target[$app]) { '  (ongewijzigd)' } else { '' }
  Write-Host ("  {0,-7} {1} -> {2}{3}" -f $app, $current, $target[$app], $mark)
}
Write-Host ''
if (-not $Yes) {
  $answer = Read-Host 'Doorgaan? (j/n)'
  if (@('j', 'ja', 'y', 'yes') -notcontains $answer.Trim().ToLowerInvariant()) { Write-Host 'Gestopt.'; return }
}

Confirm-Docker
if ($doStreamz) {
  Confirm-ProductionData
  Confirm-NoOtherProject "korfbal-streamz-api" "streamz"
}
if ($doBridge) { Confirm-NoOtherProject "venue-bridge" "venue-bridge" }

if ($doStreamz) {
  $streamzArgs = Get-StreamzArgs $configPath
  $oldApi = $cfg['STREAMZ_API_VERSION']
  $oldKit = $cfg['STREAMZ_KIT_VERSION']

  # Backup van de database als de API (en dus mogelijk het schema) verandert
  $backupFile = $null
  if (-not $SkipBackup -and $oldApi -ne $target['api']) {
    $running = Get-ComposeOutput ($streamzArgs + @('ps', '--status', 'running', '-q', 'streamz-db'))
    if ($running) {
      $backupDir = Join-Path $Root 'backups'
      New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
      $label = if ($oldApi) { $oldApi } else { 'standaard' }
      $backupFile = Join-Path $backupDir ("streamz-{0}-{1}.sql" -f $label, (Get-Date -Format 'yyyyMMdd-HHmmss'))
      Write-Host "Backup van de database naar $backupFile ..."
      Invoke-Compose ($streamzArgs + @('exec', '-T', 'streamz-db', 'pg_dump', '-U', 'fortuna', '-d', 'streamz', '-f', '/tmp/streamz-upgrade.sql'))
      Invoke-Compose ($streamzArgs + @('cp', 'streamz-db:/tmp/streamz-upgrade.sql', $backupFile))
      Invoke-Compose ($streamzArgs + @('exec', '-T', 'streamz-db', 'rm', '-f', '/tmp/streamz-upgrade.sql'))
    } else {
      Write-Warning 'De database draait niet; geen backup gemaakt.'
    }
  }

  Set-StreamzConfigValue $configPath 'STREAMZ_API_VERSION' $target['api']
  Set-StreamzConfigValue $configPath 'STREAMZ_KIT_VERSION' $target['kit']
  try {
    # Ook postgres:16-alpine: die tag volgt de laatste 16.x-patch (beveiligingsupdates), nooit een nieuwe major
    Invoke-Compose ($streamzArgs + @('pull', 'streamz-db', 'migrate-streamz', 'korfbal-streamz-api', 'korfbal-streamz-kit'))
    Invoke-Compose ($streamzArgs + @('up', '-d'))
  } catch {
    Write-Host ''
    Write-Warning 'Streamz is niet goed gestart. Laatste regels van de migratie:'
    Get-ComposeOutput ($streamzArgs + @('logs', '--tail', '40', 'migrate-streamz')) | Write-Host
    Write-Host ''
    Write-Host 'Terugzetten naar de vorige versie:'
    $prevApi = if ($oldApi) { $oldApi } else { '<vorige versie>' }
    $prevKit = if ($oldKit) { $oldKit } else { '<vorige versie>' }
    Write-Host "  upgrade.cmd -Only streamz -Api $prevApi -Kit $prevKit -SkipBackup"
    if ($backupFile) { Write-Host "  Database-backup van voor de upgrade: $backupFile" }
    throw
  }
  Wait-Http 'http://localhost:3333/api/health' 'De API' | Out-Null
}

if ($doBridge) {
  Set-StreamzConfigValue $configPath 'STREAMZ_BRIDGE_VERSION' $target['bridge']
  $cfg = Read-StreamzConfig $configPath
  if (-not $cfg['API_URL'] -or -not $cfg['API_KEY']) {
    throw "Zet API_URL en API_KEY in $configPath voor de venue-bridge."
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data\venue-bridge') | Out-Null
  $bridgeArgs = Get-BridgeArgs $configPath $cfg
  Invoke-Compose ($bridgeArgs + @('pull', 'venue-bridge'))
  Invoke-Compose ($bridgeArgs + @('up', '-d', 'venue-bridge'))
  Wait-Http 'http://localhost:3340/health' 'De venue-bridge' | Out-Null
}

Write-Host ''
Write-Host "Klaar. De versies staan in $configPath; start.cmd start voortaan deze versies."
