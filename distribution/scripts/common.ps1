# Gedeelde functies voor de scripts in distribution/ (dot-source). Alleen ASCII: Windows PowerShell 5.1 leest
# een bestand zonder BOM als ANSI.

# De map distribution/ (compose-bestanden, env-bestanden, productiedata) en, in een checkout, de repo erboven
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RepoRoot = Split-Path -Parent $Root
$ProdCompose = Join-Path $Root 'docker-compose.yml'
$BridgeCompose = Join-Path $Root 'docker-compose.venue-bridge.yml'
$VariantDir = Join-Path $Root 'variants'
$Repos = @{
  api    = 'mvanvendeloo/korfbal-stream-api'
  kit    = 'mvanvendeloo/korfbal-stream-kit'
  bridge = 'mvanvendeloo/streamz-kit-venue-bridge'
}
$VersionKeys = @{
  api    = 'STREAMZ_API_VERSION'
  kit    = 'STREAMZ_KIT_VERSION'
  bridge = 'STREAMZ_BRIDGE_VERSION'
}
$ReleaseTag = '^\d{4}\.\d{1,2}\.\d+$'

function Resolve-ConfigPath([string]$Path) {
  if (-not $Path) { $Path = Join-Path $Root 'streamz.local.env' }
  if (-not (Test-Path $Path)) {
    throw "Configuratie $Path ontbreekt. Kopieer streamz.local.env.example naar streamz.local.env en vul hem in."
  }
  (Resolve-Path $Path).Path
}

function Read-StreamzConfig([string]$Path) {
  $cfg = @{}
  foreach ($line in [IO.File]::ReadAllLines($Path)) {
    $l = $line.TrimStart([char]0xFEFF).Trim()
    if ($l -eq '' -or $l.StartsWith('#')) { continue }
    $i = $l.IndexOf('=')
    if ($i -lt 1) { continue }
    $v = $l.Substring($i + 1).Trim()
    if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $cfg[$l.Substring(0, $i).Trim()] = $v
  }
  $cfg
}

# Zet KEY=value in het env-bestand (vervangt de regel of voegt hem toe), UTF-8 zonder BOM
function Set-StreamzConfigValue([string]$Path, [string]$Key, [string]$Value) {
  $lines = New-Object System.Collections.Generic.List[string]
  $found = $false
  foreach ($line in [IO.File]::ReadAllLines($Path)) {
    if ($line.TrimStart([char]0xFEFF) -match "^\s*$([regex]::Escape($Key))\s*=") {
      $lines.Add("$Key=$Value")
      $found = $true
    } else {
      $lines.Add($line)
    }
  }
  if (-not $found) { $lines.Add("$Key=$Value") }
  [IO.File]::WriteAllLines($Path, $lines, (New-Object System.Text.UTF8Encoding $false))
}

function Test-Enabled($Cfg, [string]$Key) {
  $v = "$($Cfg[$Key])".ToLowerInvariant()
  return @('true', '1', 'yes', 'ja', 'j') -contains $v
}

# Wacht tot Docker draait; start Docker Desktop als dat nodig is
function Confirm-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is niet gevonden. Installeer Docker Desktop.'
  }
  if (Test-DockerRunning) { return }
  $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $desktop) {
    Write-Host 'Docker Desktop starten...'
    Start-Process $desktop | Out-Null
  }
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    if (Test-DockerRunning) { Write-Host 'Docker draait.'; return }
  }
  throw 'Docker draait niet (na 3 minuten wachten). Start Docker Desktop en probeer opnieuw.'
}

function Test-DockerRunning {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { docker info 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) } finally { $ErrorActionPreference = $old }
}

function Invoke-Compose([string[]]$Arguments) {
  Push-Location $Root
  try {
    & docker compose @Arguments
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($code -ne 0) { throw "'docker compose $($Arguments -join ' ')' is mislukt (exitcode $code)." }
}

# Uitvoer van docker compose als tekst (zonder te stoppen op een fout)
function Get-ComposeOutput([string[]]$Arguments) {
  Push-Location $Root
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { return (& docker compose @Arguments 2>$null) } finally { $ErrorActionPreference = $old; Pop-Location }
}

function Get-StreamzArgs([string]$ConfigPath) {
  @('--env-file', $ConfigPath, '-f', $ProdCompose)
}

# Voor de verhuizing naar distribution/ stond de productiedata in de root van de repo. Zonder deze controle zou
# Streamz na een update met een lege database starten.
function Confirm-ProductionData {
  if ((Test-Path (Join-Path $RepoRoot 'dbdata')) -and -not (Test-Path (Join-Path $Root 'dbdata'))) {
    throw ("De database staat nog in $RepoRoot\dbdata, maar Streamz verwacht hem nu in $Root\dbdata. " +
      "Stop de oude containers en verplaats dbdata, storage, uploads, backups en secrets.prod.env (en data\venue-bridge) " +
      "naar $Root. Zie README.md in die map.")
  }
}

# Draait de service al in een ander compose-project (de installatie van voor distribution/, localtest of dev),
# dan botsen de poorten: eerst dat project stoppen.
function Confirm-NoOtherProject([string]$Service, [string]$Project) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $projects = & docker ps --filter "label=com.docker.compose.service=$Service" --format '{{.Label "com.docker.compose.project"}}' 2>$null
  } finally { $ErrorActionPreference = $old }
  $other = @($projects | Where-Object { $_ -and $_ -ne $Project } | Select-Object -Unique)
  if ($other.Count -gt 0) {
    throw ("$Service draait al in het compose-project '$($other -join "', '")' (een oudere installatie, localtest of dev). " +
      "Stop dat eerst: docker compose -p $($other[0]) down")
  }
}

# Een eigen project (name: venue-bridge in het compose-bestand), los van Streamz
function Get-BridgeArgs([string]$ConfigPath, $Cfg) {
  $variant = $Cfg['BRIDGE_VARIANT']
  $list = @('--env-file', $ConfigPath, '-f', $BridgeCompose)
  if ($variant) {
    $file = Join-Path $VariantDir "$variant.yml"
    if (-not (Test-Path $file)) {
      $names = (Get-ChildItem $VariantDir -Filter *.yml | ForEach-Object { $_.BaseName }) -join ', '
      throw "Onbekende BRIDGE_VARIANT '$variant' (kies uit: $names)"
    }
    $list += @('-f', $file)
  }
  $list
}

function Wait-Http([string]$Url, [string]$Name, [int]$Seconds = 120) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { Write-Host "$Name is bereikbaar ($Url)."; return $true }
    } catch { }
    Start-Sleep -Seconds 3
  }
  Write-Warning "$Name antwoordt niet op $Url na $Seconds seconden."
  return $false
}

function Initialize-Tls {
  # Windows PowerShell 5.1 gebruikt anders soms TLS 1.0, dat Docker Hub weigert
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

# Laatste release-tag (yyyy.mm.n) op Docker Hub
function Get-LatestTag([string]$Repo) {
  $url = "https://hub.docker.com/v2/repositories/$Repo/tags?page_size=100&ordering=last_updated"
  $tags = @()
  while ($url) {
    try {
      $page = Invoke-RestMethod -Uri $url -TimeoutSec 20
    } catch {
      throw "Kan de tags van $Repo niet ophalen van Docker Hub ($($_.Exception.Message)). Geef de versie mee of sla deze app over met -Only."
    }
    $tags += @($page.results | ForEach-Object { $_.name } | Where-Object { $_ -match $ReleaseTag })
    # De nieuwste staan vooraan; een tweede pagina is alleen nodig als de eerste geen release bevatte
    if ($tags.Count -gt 0) { break }
    $url = $page.next
  }
  if ($tags.Count -eq 0) { throw "Geen release-tag (yyyy.mm.n) gevonden voor $Repo op Docker Hub. Geef de versie mee of sla deze app over met -Only." }
  ($tags | Sort-Object { [version]$_ } | Select-Object -Last 1)
}

function Test-TagExists([string]$Repo, [string]$Tag) {
  try {
    Invoke-RestMethod -Uri "https://hub.docker.com/v2/repositories/$Repo/tags/$Tag" -TimeoutSec 20 | Out-Null
    return $true
  } catch {
    return $false
  }
}
