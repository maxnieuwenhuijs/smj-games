# Zet het gebouwde spel (games/zoo/dist) op de eigen server, zodat https://zoo.smj.games de nieuwste versie heeft.
#
# Draaien vanuit de hoofdmap van de repo, na `npm run build`:
#   powershell -ExecutionPolicy Bypass -File tools/server/zet-op-server.ps1
#
# Het spel komt eerst in een nieuwe map naast de oude en wordt dan in één keer omgewisseld, zodat er nooit een half
# geüpload spel te zien is. nginx hoeft daarvoor niet herladen te worden.
param(
  [string]$Server = 'root@164.92.144.35',
  [string]$Map = '/var/www/smj-zoo'
)
$ErrorActionPreference = 'Stop'
$dist = Join-Path (Get-Location) 'games\zoo\dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'Geen games\zoo\dist\index.html: eerst npm run build draaien.' }
$pak = Join-Path ([System.IO.Path]::GetTempPath()) 'smj-zoo-dist.tgz'
tar -czf $pak -C $dist .
if ($LASTEXITCODE -ne 0) { throw 'Inpakken mislukt.' }
scp -o BatchMode=yes $pak "${Server}:/tmp/smj-zoo-dist.tgz"
if ($LASTEXITCODE -ne 0) { throw 'Uploaden mislukt.' }
$stappen = "set -e; rm -rf $Map.new $Map.old; mkdir -p $Map.new; tar -xzf /tmp/smj-zoo-dist.tgz -C $Map.new; rm /tmp/smj-zoo-dist.tgz; chown -R www-data:www-data $Map.new; if [ -d $Map ]; then mv $Map $Map.old; fi; mv $Map.new $Map; rm -rf $Map.old; grep -o 'index-[A-Za-z0-9_-]*\.js' $Map/index.html | head -1"
ssh -o BatchMode=yes $Server $stappen
if ($LASTEXITCODE -ne 0) { throw 'Omwisselen op de server mislukt.' }
Remove-Item $pak
Write-Output 'Klaar: zoo.smj.games heeft de nieuwe versie.'
