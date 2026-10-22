# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

# Install build tools required by better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create data and upload directories
RUN mkdir -p data public/uploads

# Non-root user for security
RUN addgroup -S tourbine && adduser -S tourbine -G tourbine \
    && chown -R tourbine:tourbine /app
USER tourbine

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
