#!/bin/sh
set -eu

DOMAIN="${DOMAIN:-sakura000702.me}"
EMAIL="${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

$COMPOSE run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  -d "$DOMAIN" -d "www.$DOMAIN"

cp ops/nginx/tls.conf.template ops/nginx/runtime/tls.conf
$COMPOSE exec web nginx -t
$COMPOSE exec web nginx -s reload

echo "HTTPS enabled for $DOMAIN"
