$readmePath = "README.md"
$content = Get-Content $readmePath -Raw

# Find and replace the SSL section
$pattern = '### HTTPS y Cabeceras de Seguridad[\s\S]*?Configuración alternativa lista para producción: `reverse-proxy/nginx\.prod\.conf` usa directamente los certificados de Let''s Encrypt\. Puedes montar este archivo en lugar de `nginx\.conf` en producción una vez emitidos los certificados\.'

$replacement = @'
### HTTPS y Cabeceras de Seguridad

**Configuración en producción (Ubuntu)** - Ver `reverse-proxy/SSL-SETUP.md` para guía completa.

1. Verificar prerrequisitos (DNS, puertos 80/443)
2. Obtener certificados: `cd reverse-proxy && ./issue-cert.sh`
3. Activar producción: `./switch-to-prod.sh`
4. Verificar: `curl https://archsoft-system.duck.dns.org/healthz`

Scripts disponibles: `issue-cert.sh`, `switch-to-prod.sh`, `renew-certs.sh`

Renovación: Automática cada 12h. Manual: `./renew-certs.sh`

Cabeceras: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
'@

$newContent = $content -replace $pattern, $replacement

$newContent | Set-Content $readmePath -NoNewline

Write-Host "✓ README.md actualizado con instrucciones de SSL para Ubuntu"
