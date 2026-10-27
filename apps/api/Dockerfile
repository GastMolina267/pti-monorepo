# Contexto: raíz del monorepo. Targets: api (por defecto), web y landing.
FROM node:24-bookworm-slim AS workspace
WORKDIR /workspace
ENV CI=true NX_DAEMON=false HUSKY=0
RUN npm install --global pnpm@10.34.6
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM workspace AS build-api
# Webpack genera package.json y lockfile podados para este workspace integrado.
RUN pnpm nx build api

FROM workspace AS build-web
RUN pnpm nx run-many -t build -p backoffice tv-display

FROM nginx:1.28-alpine AS web
COPY infra/gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/gateway/proxy.conf /etc/nginx/includes/vitalia-proxy.conf
COPY --from=build-web /workspace/dist/apps/backoffice/browser /usr/share/nginx/backoffice
COPY --from=build-web /workspace/dist/apps/tv-display/browser /usr/share/nginx/tv
EXPOSE 8080 8081
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/gateway-health && wget -q -O /dev/null http://127.0.0.1:8081/gateway-health || exit 1

FROM workspace AS build-landing
RUN pnpm nx build landing

# Landing pública (perfil `landing` del compose): no habla con la API.
FROM nginx:1.28-alpine AS landing
COPY infra/gateway/landing.conf /etc/nginx/conf.d/default.conf
COPY --from=build-landing /workspace/dist/apps/landing/browser /usr/share/nginx/landing
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8082/gateway-health || exit 1

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production API_PORT=3000
RUN npm install --global pnpm@10.34.6
COPY --from=build-api --chown=node:node /workspace/dist/apps/api ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok||(await r.json()).status==='down')process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "main.js"]
