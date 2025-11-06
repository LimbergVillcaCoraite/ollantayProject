Param(
  [string]$Domain = "archsoft-system.duck.dns.org"
)

Write-Host "Issuing Let's Encrypt certificate for $Domain ..."
Write-Host "Ensure DNS for $Domain points to this server's public IP and ports 80/443 are open."

# Initial issuance (webroot method)
docker compose run --rm certbot certbot certonly --webroot -w /var/www/certbot -d $Domain --agree-tos --register-unsafely-without-email

Write-Host "If successful, certificate files are under reverse-proxy/letsencrypt/live/$Domain/"
Write-Host "Switch nginx.conf to production cert lines and restart reverse_proxy:"
Write-Host "  docker compose restart reverse_proxy"
