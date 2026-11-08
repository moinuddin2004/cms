# Static SPA image: the client-only build in `web-app` is plain HTML/JS/CSS,
# so it is served by nginx instead of a Node server. The same bundle is what
# the Tauri desktop shell loads (`desktop-app/src-tauri/tauri.conf.json`).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Baked into the bundle at build time (`src/lib/api.ts`).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/.output/public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
