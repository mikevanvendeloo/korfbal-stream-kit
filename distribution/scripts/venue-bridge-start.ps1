<#
.SYNOPSIS
  Start (of herstart) de venue-bridge op Windows: naast de dev-omgeving, of met -Prod in de zaal.
  Zet API_URL, API_KEY, BRIDGE_NAME en eventueel BRIDGE_PAGE_URL in de omgeving of in een env-file (-EnvFile).
  In de zaal is start.cmd (RUN_BRIDGE=true in streamz.local.env) de gewone weg; localtest: start-localtest.cmd.

.EXAMPLE
  .\scripts\venue-bridge-start.ps1                       # standaard: de opgeslagen pagina, geen database
  .\scripts\venue-bridge-start.ps1 windows-robocopy
  .\scripts\venue-bridge-start.ps1 page-only -Base docker-compose-localtest.yml
  .\scripts\venue-bridge-start.ps1 cifs -Prod -EnvFile streamz.local.env   # in de zaal: Docker Hub-image
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
# distribution/ (de compose-bestanden) en de repo erboven
$dist = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$variantFile = if ($Variant) { Join-Path $dist "variants\$Variant.yml" } else { $null }
if ($Variant -and -not (Test-Path $variantFile)) {
  $names = (Get-ChildItem (Join-Path $dist 'variants') -Filter *.yml | ForEach-Object { $_.BaseName }) -join ', '
  throw "Onbekende variant '$Variant' (kies uit: $names)"
}

if ($Prod) {
  # Een eigen project (venue-bridge); de data komt in distribution\data\venue-bridge
  $override = Join-Path $dist 'docker-compose.venue-bridge.yml'
  $build = @()
  $data = Join-Path $dist 'data\venue-bridge'
} else {
  # Naast dev of localtest, in hun project; de data komt in data\venue-bridge in de root van de repo
  if (-not $Base) { $Base = 'docker-compose-dev.yml' }
  $override = Join-Path $dist 'docker-compose.venue-bridge-dev.yml'
  $build = @('--build')
  $data = Join-Path (Split-Path -Parent $dist) 'data\venue-bridge'
}

New-Item -ItemType Directory -Force -Path $data | Out-Null
$envArgs = @()
if ($EnvFile) { $envArgs = @('--env-file', (Resolve-Path $EnvFile).Path) }

Push-Location $dist
try {
  $variantArgs = @()
  if ($variantFile) { $variantArgs = @('-f', $variantFile) }
  $baseArgs = @()
  if ($Base) { $baseArgs = @('-f', $Base) }
  docker compose @envArgs @baseArgs -f $override @variantArgs up -d @build venue-bridge
  if ($LASTEXITCODE -ne 0) { throw "docker compose is mislukt (exitcode $LASTEXITCODE)." }
} finally {
  Pop-Location
}
$label = if ($Variant) { $Variant } else { 'opgeslagen pagina' }
Write-Host "Venue-bridge gestart ($label). Controle: curl http://localhost:3340/health"
Write-Host 'Kijk bij Beheer > Instellingen > Venue of de bridge verbonden is, of open http://localhost:3340'
