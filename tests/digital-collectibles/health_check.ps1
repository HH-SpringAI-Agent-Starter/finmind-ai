$ErrorActionPreference = 'Continue'
cd 'C:\Users\Administrator\.qclaw\workspace\finmind-ai'
$p = Start-Process node -ArgumentList 'src/agents/digital-collectibles/nft_agent_server.js' -PassThru -NoNewWindow
Start-Sleep -Seconds 2
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:3200/health' -TimeoutSec 3
    Write-Output ('HEALTH OK: ' + ($r | ConvertTo-Json -Compress))
} catch {
    Write-Output ('HEALTH FAIL: ' + $_.Exception.Message)
}
# 清理本次启动的 node 进程
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq $p.Id } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output 'DONE'
