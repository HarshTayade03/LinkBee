# Multi-Stage Production Dockerfile

# Stage 1: Build the React Frontend Monorepo
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Node.js Server
FROM node:20-alpine AS runner
WORKDIR /app

# Run as an unprivileged non-root user for security (OWASP Docker Best Practices)
USER node

# Copy backend dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/

# Copy compiled React frontend from Stage 1
COPY --chown=node:node --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose internal HTTP port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "src/server.js"]

