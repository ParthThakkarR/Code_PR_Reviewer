FROM node:22-alpine

# Set production environment
ENV NODE_ENV=production
WORKDIR /app

# Create unprivileged group and user (Req #58)
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

# Install production dependencies only with clean npm ci
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source
COPY --chown=appuser:appgroup . .

# Run as non-root user (Req #58)
USER appuser

EXPOSE 5001

# Container healthcheck (Req #58)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:5001/healthz || exit 1

CMD ["node", "index.js"]
