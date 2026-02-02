# =============================================================================
# Frontend Dockerfile - Multi-stage build following Docker Best Practices
# =============================================================================

# Stage 1: Dependencies
FROM --platform=linux/amd64 node:20-slim AS deps

WORKDIR /app

# Copy package files first (layer caching)
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
# Fix vulnerabilities automatically
RUN npm ci && npm audit fix || true

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM --platform=linux/amd64 node:20-slim AS builder

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
