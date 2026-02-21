# Instellingen
$url = "http://10.12.0.75/api/sponsors?limit=100"
$directory = "C:\Pad\Naar\Jouw\Logos"
$veldNaam = "logoUrl"

# 1. Haal de JSON data op
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
} catch {
    Write-Error "Kon de JSON niet ophalen van $url"
    exit
}

# 2. Extraheer bestandsnamen uit de JSON (alleen de naam van het bestand, zonder pad)
$jsonBestanden = $response.$veldNaam | ForEach-Object { Split-Path $_ -Leaf } | Sort-Object -Unique

# 3. Haal de PNG bestanden op uit de lokale map
if (-not (Test-Path $directory)) {
    Write-Error "De map $directory bestaat niet."
    exit
}
$lokaleBestanden = Get-ChildItem -Path $directory -Filter *.png | Select-Object -ExpandProperty Name | Sort-Object

# 4. Vergelijken
$missendInMap = Compare-Object -ReferenceObject $lokaleBestanden -DifferenceObject $jsonBestanden -PassThru | Where-Object { $_.SideIndicator -eq "=>" }
$missendInJson = Compare-Object -ReferenceObject $lokaleBestanden -DifferenceObject $jsonBestanden -PassThru | Where-Object { $_.SideIndicator -eq "<=" }

# 5. Rapportage
Write-Host "--- Resultaten Controle ---" -ForegroundColor Cyan

if ($missendInMap) {
    Write-Host "[!] Genoemd in JSON, maar NIET aanwezig in de map:" -ForegroundColor Yellow
    $missendInMap | ForEach-Object { Write-Host " - $_" }
} else {
    Write-Host "[V] Alle JSON-verwijzingen zijn lokaal aanwezig." -ForegroundColor Green
}

Write-Host ""

if ($missendInJson) {
    Write-Host "[!] In de map gevonden, maar NIET genoemd in de JSON:" -ForegroundColor Yellow
    $missendInJson | ForEach-Object { Write-Host " - $_" }
} else {
    Write-Host "[V] Alle lokale bestanden staan netjes in de JSON." -ForegroundColor Green
}
