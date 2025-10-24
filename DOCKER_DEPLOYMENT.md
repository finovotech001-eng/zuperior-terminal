# Docker Deployment Guide - Zuperior Trading Terminal

This guide explains how to containerize and deploy the Zuperior Trading Terminal using Docker and Docker Compose.

---

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- PostgreSQL 14+ (or use Docker container)
- Redis 7+ (or use Docker container)

---

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd zuperior-terminal

# Copy environment file
cp .env.example .env

# Update environment variables
nano .env
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

### 3. Access Application

- **Application:** http://localhost:3000
- **Health Check:** http://localhost:3000/apis/health

---

## File Structure

```
zuperior-terminal/
├── Dockerfile                  # Production Docker image
├── Dockerfile.dev             # Development Docker image
├── docker-compose.yml         # Full stack (app + db + redis)
├── docker-compose.dev.yml     # Development setup
├── .dockerignore              # Files to exclude from image
└── scripts/
    ├── docker-entrypoint.sh   # Container startup script
    └── wait-for-it.sh         # Wait for dependencies
```

---

## Dockerfile (Production)

```dockerfile
# Base image
FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Dependencies
FROM base AS deps

COPY package*.json ./
RUN npm ci --only=production

# Builder
FROM base AS builder

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Runner
FROM base AS runner

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

---

## Docker Compose Configuration

### Production (docker-compose.yml)

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  db:
    image: postgres:16-alpine
    container_name: zuperior-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: zuperior
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secure_password_here}
      POSTGRES_DB: zuperior_terminal
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zuperior"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - zuperior-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: zuperior-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redis_password_here}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - zuperior-network

  # Next.js Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: zuperior-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://zuperior:${DB_PASSWORD:-secure_password_here}@db:5432/zuperior_terminal?connection_limit=20
      - REDIS_URL=redis://:${REDIS_PASSWORD:-redis_password_here}@redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
      - MANAGER_USERNAME=${MANAGER_USERNAME}
      - MANAGER_PASSWORD=${MANAGER_PASSWORD}
      - MANAGER_SERVER_IP=${MANAGER_SERVER_IP}
      - MANAGER_PORT=${MANAGER_PORT}
      - MANAGER_LOGIN_PATH=${MANAGER_LOGIN_PATH}
      - MARKET_DATA_SYMBOLS_PATH=${MARKET_DATA_SYMBOLS_PATH}
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/apis/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - zuperior-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  zuperior-network:
    driver: bridge
```

### Development (docker-compose.dev.yml)

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    container_name: zuperior-db-dev
    environment:
      POSTGRES_USER: zuperior
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: zuperior_terminal_dev
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - zuperior-dev-network

  redis:
    image: redis:7-alpine
    container_name: zuperior-redis-dev
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data
    ports:
      - "6379:6379"
    networks:
      - zuperior-dev-network

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: zuperior-app-dev
    depends_on:
      - db
      - redis
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://zuperior:dev_password@db:5432/zuperior_terminal_dev
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-secret-key-32-characters-long
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev
    networks:
      - zuperior-dev-network

volumes:
  postgres_dev_data:
  redis_dev_data:

networks:
  zuperior-dev-network:
    driver: bridge
```

---

## Development Dockerfile (Dockerfile.dev)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
```

---

## .dockerignore

```
# Dependencies
node_modules
npm-debug.log*

# Next.js
.next
out

# Testing
coverage

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Prisma
prisma/dev.db
prisma/dev.db-journal

# Git
.git
.gitignore
README.md

# IDE
.vscode
.idea
*.swp
*.swo

# Docker
Dockerfile*
docker-compose*
.dockerignore
```

---

## Deployment Commands

### Local Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Rebuild after changes
docker-compose -f docker-compose.dev.yml up -d --build

# Run Prisma migrations
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev

# Access database
docker-compose -f docker-compose.dev.yml exec db psql -U zuperior -d zuperior_terminal_dev
```

### Production

```bash
# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Run migrations
docker-compose exec app npx prisma migrate deploy

# Scale instances
docker-compose up -d --scale app=3

# Stop and remove
docker-compose down

# Remove volumes (CAUTION: Deletes data)
docker-compose down -v
```

### Backup & Restore

```bash
# Backup database
docker-compose exec -T db pg_dump -U zuperior zuperior_terminal > backup_$(date +%Y%m%d).sql

# Restore database
docker-compose exec -T db psql -U zuperior zuperior_terminal < backup_20250124.sql

# Backup Redis
docker-compose exec redis redis-cli --rdb /data/dump.rdb
docker cp zuperior-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

---

## Cloud Deployment

### AWS ECS

1. **Build and push to ECR**

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t zuperior-terminal .

# Tag image
docker tag zuperior-terminal:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/zuperior-terminal:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/zuperior-terminal:latest
```

2. **Create ECS task definition** (see AWS console or CLI)

3. **Create ECS service** with:
   - Load balancer
   - Auto-scaling
   - Health checks

### Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/zuperior-terminal
gcloud run deploy zuperior-terminal \
  --image gcr.io/PROJECT_ID/zuperior-terminal \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### DigitalOcean App Platform

```bash
# Use their web interface or doctl CLI
doctl apps create --spec .do/app.yaml
```

---

## Monitoring

### Health Checks

```bash
# Check application health
curl http://localhost:3000/apis/health

# Check database
docker-compose exec db pg_isready -U zuperior

# Check Redis
docker-compose exec redis redis-cli ping
```

### Logs

```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f db

# Redis logs
docker-compose logs -f redis

# All logs
docker-compose logs -f
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Check container status
docker-compose ps

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection issues

```bash
# Verify database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker-compose exec app npx prisma db push
```

### Redis connection issues

```bash
# Test Redis
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis
```

---

## Best Practices

1. **Use multi-stage builds** to keep images small
2. **Run as non-root user** in production
3. **Use health checks** for all services
4. **Implement proper logging** with log rotation
5. **Use secrets management** for sensitive data
6. **Regular backups** of database and Redis
7. **Monitor resource usage** (CPU, memory, disk)
8. **Use specific image tags** instead of `latest`
9. **Scan images for vulnerabilities** regularly
10. **Implement CI/CD pipeline** for automated deployments

---

## Next Steps

1. Set up Kubernetes for orchestration (see `KUBERNETES_DEPLOYMENT.md`)
2. Implement monitoring with Prometheus/Grafana
3. Set up centralized logging with ELK stack
4. Configure CDN for static assets
5. Implement blue-green deployment strategy

---

**Last Updated:** October 24, 2025  
**Version:** 1.0

