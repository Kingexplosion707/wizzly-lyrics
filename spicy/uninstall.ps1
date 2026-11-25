# Spicy Lyrics for Wizzly - uninstaller. Wizzly itself is untouched; restart it afterwards.
$Dest = Join-Path $env:LOCALAPPDATA 'SpicyWizzly'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*SpicyWizzly*loader.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) 'Spicy Lyrics for Wizzly.lnk') -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Wizzly (Spicy).lnk') -ErrorAction SilentlyContinue
Remove-Item $Dest -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Spicy Lyrics for Wizzly removed. Restart Wizzly to get it back to normal.'
