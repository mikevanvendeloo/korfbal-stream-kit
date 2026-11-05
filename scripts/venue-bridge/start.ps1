<#
.SYNOPSIS
  Start (of herstart) de venue-bridge op Windows: naast de dev-omgeving, of met -Prod in de zaal.
  Zet API_URL, API_KEY, BRIDGE_NAME en eventueel BRIDGE_PAGE_URL in de omgeving of in een env-file (-EnvFile).

.EXAMPLE
  .\scripts\venue-bridge\start.ps1                       # standaard: de opgeslagen pagina, geen database
  .\scripts\venue-bridge\start.ps1 windows-robocopy
  .\scripts\venue-bridge\start.ps1 page-only -Base docker-compose-localtest.yml
  .\scripts\venue-bridge\start.ps1 cifs -Prod     # in de zaal: Docker Hub-image, STREAMZ_BRIDGE_VERSION uit de omgeving, zonder andere compose-bestanden
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
  $baseArgs = @()
  if ($Base) { $baseArgs = @('-f', $Base) }
  docker compose @envArgs @baseArgs -f $override @variantArgs up -d @build venue-bridge
} finally {
  Pop-Location
}
$label = if ($Variant) { $Variant } else { 'opgeslagen pagina' }
Write-Host "Venue-bridge gestart ($label). Controle: curl http://localhost:3340/health"
Write-Host 'Kijk bij Beheer > Instellingen > Venue of de bridge verbonden is, of open http://localhost:3340'
