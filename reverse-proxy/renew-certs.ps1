Write-Host "Renewing Let's Encrypt certificates..."
# This triggers the certbot container's renew, which is also scheduled every 12h inside the container
# Running manually ensures renewal when needed

docker compose run --rm certbot certbot renew --webroot -w /var/www/certbot --deploy-hook "true"

Write-Host "Remember to reload Nginx to pick up renewed certs:"
Write-Host "  docker compose exec reverse_proxy nginx -s reload"
