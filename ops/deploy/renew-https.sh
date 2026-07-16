#!/bin/sh
set -eu

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE run --rm certbot renew --webroot --webroot-path /var/www/certbot --quiet
$COMPOSE exec web nginx -t
$COMPOSE exec web nginx -s reload
