ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=public.ecr.aws/nginx/nginx:1.29-alpine@sha256:72c9b856fee09b02f9e5ee29ab2b55ae9a3c3b59cf094baef1d05f5914d8cb17

FROM ${NODE_IMAGE} AS build

WORKDIR /site
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${NGINX_IMAGE}
RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /var/cache/nginx /run /var/www/certbot \
    && chown -R nginx:nginx \
        /var/cache/nginx \
        /run \
        /var/www/certbot \
        /etc/nginx/conf.d \
        /usr/share/nginx/html
COPY --chown=nginx:nginx --from=build /site/dist /usr/share/nginx/html
COPY --chown=nginx:nginx --from=build /site/admin /usr/share/nginx/html/admin
COPY --chown=nginx:nginx ops/nginx/runtime /etc/nginx/conf.d
COPY --chown=nginx:nginx ops/nginx/proxy_params /etc/nginx/proxy_params
EXPOSE 80 443

USER nginx

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
