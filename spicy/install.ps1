# Spicy Lyrics for Wizzly - installer (per user, no admin).
#
#   iwr -useb https://raw.githubusercontent.com/Kingexplosion707/wizzly-lyrics/main/spicy/install.ps1 | iex
#
# Copies the loader to %LOCALAPPDATA%\SpicyWizzly, installs its one dependency (ws), starts it
# at sign-in, and starts it now. Wizzly itself is not changed. Node.js is installed with winget
# when it's missing. Run again to update.
$ErrorActionPreference = 'Stop'
$Owner = 'Kingexplosion707'; $Repo = 'wizzly-lyrics'; $Branch = 'main'
$Dest = Join-Path $env:LOCALAPPDATA 'SpicyWizzly'

function Step($t) { Write-Host "-> $t" -ForegroundColor Cyan }

Step 'Getting the files'
$src = $PSScriptRoot
if (-not $src -or -not (Test-Path (Join-Path $src 'loader.js'))) {
  $zip = Join-Path $env:TEMP 'spicy-wizzly.zip'
  $tmp = Join-Path $env:TEMP 'spicy-wizzly-src'
  Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Owner/$Repo/zip/refs/heads/$Branch" -OutFile $zip
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip $tmp -Force
  $src = Join-Path (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName 'spicy'
}

Step 'Stopping an older loader'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*SpicyWizzly*loader.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Step "Copying to $Dest"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
foreach ($f in 'loader.js', 'spicy-wizzly.js', 'package.json', 'start-loader.vbs', 'uninstall.ps1') {
  Copy-Item (Join-Path $src $f) (Join-Path $Dest $f) -Force
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Step 'Installing Node.js (winget)'
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent | Out-Null
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is needed: install it from nodejs.org, then run this again.' }
}

Step 'Installing the loader''s dependency (ws)'
Push-Location $Dest
try { npm install --omit=dev --no-audit --no-fund --silent | Out-Null } finally { Pop-Location }

Step 'Starting it at sign-in'
$startup = [Environment]::GetFolderPath('Startup')
$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut((Join-Path $startup 'Spicy Lyrics for Wizzly.lnk'))
$lnk.TargetPath = 'wscript.exe'
$lnk.Arguments = '"' + (Join-Path $Dest 'start-loader.vbs') + '"'
$lnk.WorkingDirectory = $Dest
$lnk.Save()
$menu = $sh.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Wizzly (Spicy).lnk'))
$menu.TargetPath = 'wscript.exe'
$menu.Arguments = '"' + (Join-Path $Dest 'start-loader.vbs') + '"'
$menu.WorkingDirectory = $Dest
$menu.Save()

Step 'Starting now'
Start-Process wscript.exe -ArgumentList ('"' + (Join-Path $Dest 'start-loader.vbs') + '"') -WorkingDirectory $Dest

Write-Host ''
Write-Host 'Done. Wizzly restarts once with Spicy Lyrics in its island.' -ForegroundColor Green
Write-Host 'Settings: open the island''s lyrics view (or the karaoke window) and click the pepper button.'
Write-Host 'Canvas and animated covers come from the Live Lyrics relay (github.com/Kingexplosion707/Live-Lyrics-for-Wallpaper-Engine).'
