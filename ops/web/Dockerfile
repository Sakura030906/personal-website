ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=public.ecr.aws/nginx/nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /site
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${NGINX_IMAGE}
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=build /site/dist /usr/share/nginx/html
COPY --from=build /site/admin /usr/share/nginx/html/admin
COPY ops/nginx/runtime /etc/nginx/conf.d
COPY ops/nginx/proxy_params /etc/nginx/proxy_params
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
