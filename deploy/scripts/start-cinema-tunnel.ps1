$ErrorActionPreference = "Stop"

$configPath = "$env:USERPROFILE\.cloudflared\config-cinema.yml"

if (!(Test-Path $configPath)) {
  Write-Error "Missing config file: $configPath"
}

cloudflared tunnel --config $configPath run cinema-web
