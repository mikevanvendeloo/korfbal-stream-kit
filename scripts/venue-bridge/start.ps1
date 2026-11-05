<#
.SYNOPSIS
  Start (of herstart) de statistics bridge naast de dev-omgeving, op Windows.

.EXAMPLE
  .\scripts\venue-bridge\start.ps1                       # standaard: de opgeslagen pagina, geen database
  .\scripts\venue-bridge\start.ps1 windows-robocopy
  .\scripts\venue-bridge\start.ps1 page-only -Base docker-compose-localtest.yml
  .\scripts\venue-bridge\start.ps1 cifs -Prod     # Docker Hub-image, STREAMZ_BRIDGE_VERSION uit de omgeving
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Variant,
  [string]$Base,
  [switch]$Prod,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dir = Join-Path $root 'apps\venue-bridge\compose'
$variantFile = if ($Variant) { Join-Path $dir "variants\$Variant.yml" } else { $null }
if ($Variant -and -not (Test-Path $variantFile)) {
  $names = (Get-ChildItem (Join-Path $dir 'variants') -Filter *.yml | ForEach-Object { $_.BaseName }) -join ', '
  throw "Onbekende variant '$Variant' (kies uit: $names)"
}

if ($Prod) {
  if (-not $Base) { $Base = 'docker-compose-prod.yml' }
  $override = Join-Path $dir 'docker-compose.venue-bridge.prod.yml'
  $build = @()
} else {
  if (-not $Base) { $Base = 'docker-compose.yml' }
  $override = Join-Path $dir 'docker-compose.venue-bridge.yml'
  $build = @('--build')
}

New-Item -ItemType Directory -Force -Path (Join-Path $root 'data\venue-bridge') | Out-Null
$envArgs = @()
if ($EnvFile) { $envArgs = @('--env-file', $EnvFile) }

Push-Location $root
try {
  $variantArgs = @()
  if ($variantFile) { $variantArgs = @('-f', $variantFile) }
  docker compose @envArgs -f $Base -f $override @variantArgs up -d @build venue-bridge
} finally {
  Pop-Location
}
$label = if ($Variant) { $Variant } else { 'opgeslagen pagina' }
Write-Host "Statistics bridge gestart ($label). Controle: curl http://localhost:3340/health"
Write-Host 'Vul bij Beheer > Instellingen > Statistieken in: Statistics bridge URL = http://venue-bridge:3340'
