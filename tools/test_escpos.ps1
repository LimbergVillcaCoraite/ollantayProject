# Simple smoke test for ESC/POS endpoint
$uri = 'http://localhost:8004/ventas/1/factura/escpos'
try {
    $res = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 10
    if ($res.ok -and $res.escpos_base64 -and $res.rawbt_url) {
        Write-Host "OK: endpoint returned escpos_base64 length = $($res.escpos_base64.Length), rawbt_url preview: $($res.rawbt_url.Substring(0,[Math]::Min(80,$res.rawbt_url.Length)))"
        exit 0
    } else {
        Write-Host "FAIL: response missing expected fields"
        Write-Host ($res | ConvertTo-Json -Depth 3)
        exit 2
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 3
}