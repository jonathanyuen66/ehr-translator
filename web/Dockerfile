# Stage 1: build the static assets
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite only reads import.meta.env.VITE_* values at `vite build` time, not at
# container runtime, so the API base URL has to be a build arg here rather
# than a Cloud Run env var like the backend's settings.py.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: serve the build as a static site. The "unprivileged" variant
# listens on 8080 and runs as a non-root user out of the box, matching
# server/Dockerfile's non-root convention without extra setup.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
