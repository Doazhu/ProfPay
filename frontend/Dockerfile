# =============================================================================
# Frontend Dockerfile - Multi-stage build following Docker Best Practices
# =============================================================================

# Stage 1: Dependencies
FROM node:20-slim AS deps

WORKDIR /app

# Сначала только файлы зависимостей — слой переиспользуется, пока они не менялись.
COPY package.json package-lock.json ./

# npm ci ставит ровно то, что записано в package-lock.json.
#
# Здесь раньше стояло `npm ci && npm audit fix || true`. Две проблемы:
# audit fix менял дерево зависимостей прямо во время сборки, из-за чего образ
# переставал соответствовать файлу блокировки; а `|| true` глушил падение
# npm ci, и сборка обваливалась позже с невнятным «node_modules not found».
# Уязвимости лечим обновлением зависимостей в репозитории, а не при сборке.
RUN npm ci --no-audit --no-fund

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build the application
RUN npm run build

# =============================================================================
# Stage 3: Production with nginx
# =============================================================================
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Security: Run nginx as non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
