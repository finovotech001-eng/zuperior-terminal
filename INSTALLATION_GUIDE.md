# Zuperior Trading Terminal - Installation & Setup Guide

Complete guide to set up the optimized Zuperior Trading Terminal for production deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Deployment](#deployment)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** 20.x or higher
- **npm** or **bun** package manager
- **PostgreSQL** 14.x or higher
- **Redis** 7.x or higher (required for production)
- **Docker** (optional, for containerized deployment)

### System Requirements

**Development:**
- RAM: 4GB minimum
- Disk: 2GB free space
- OS: Windows, macOS, or Linux

**Production:**
- RAM: 8GB minimum (16GB recommended)
- Disk: 10GB free space
- CPU: 2 cores minimum (4+ recommended)

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd zuperior-terminal
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using bun (faster)
bun install
```

### 3. Install Required Dependencies

The optimization requires these additional packages:

```bash
npm install ioredis zod
npm install -D @types/ioredis
```

---

## Configuration

### 1. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your actual values:

```env
# ============================================
# Node Environment
# ============================================
NODE_ENV=production

# ============================================
# Database Configuration
# ============================================
# PostgreSQL with connection pooling
DATABASE_URL="postgresql://username:password@localhost:5432/zuperior_terminal?connection_limit=20&pool_timeout=60&connect_timeout=10"

# ============================================
# Redis Cache (Required for Production)
# ============================================
REDIS_URL="redis://localhost:6379"
# OR use individual parameters
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=your_secure_redis_password

# ============================================
# JWT Authentication
# ============================================
# IMPORTANT: Change this to a secure random string (minimum 32 characters)
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long-CHANGE-THIS"
NEXT_PUBLIC_JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long-CHANGE-THIS"

# ============================================
# MT5 Trading Platform API
# ============================================
NEXT_PUBLIC_API_BASE_URL="http://18.130.5.209:5003"
MANAGER_USERNAME="your_mt5_manager_username"
MANAGER_PASSWORD="your_mt5_manager_password"
MANAGER_SERVER_IP="your_mt5_server_ip"
MANAGER_PORT="443"
MANAGER_LOGIN_PATH="/api/manager/login"
MARKET_DATA_SYMBOLS_PATH="/api/symbols/all"

# ============================================
# Application Configuration
# ============================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
```

### 3. Generate Secure Secrets

Generate a secure JWT secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Database Setup

### Option 1: Local PostgreSQL

#### Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE zuperior_terminal;
CREATE USER zuperior WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE zuperior_terminal TO zuperior;

# Exit
\q
```

### Option 2: Docker PostgreSQL

```bash
docker run -d \
  --name zuperior-postgres \
  -e POSTGRES_USER=zuperior \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=zuperior_terminal \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Run Database Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Or for development with migration history
npx prisma migrate dev
```

---

## Redis Setup

### Option 1: Local Redis

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Windows:**
Use [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL

### Option 2: Docker Redis

```bash
docker run -d \
  --name zuperior-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --requirepass your_redis_password
```

### Verify Redis Connection

```bash
redis-cli ping
# Expected output: PONG

# With password
redis-cli -a your_redis_password ping
```

---

## Running the Application

### Development Mode

```bash
# Start development server
npm run dev

# Or with bun
bun dev
```

Access at: http://localhost:3000

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Background Process (Production)

Using **PM2** (recommended):

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "zuperior-terminal" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

---

## Deployment

### Option 1: Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for detailed Docker instructions.

### Option 2: Cloud Deployment

#### Vercel

```bash
npm install -g vercel
vercel --prod
```

**Note:** Add PostgreSQL and Redis URLs in Vercel environment variables.

#### AWS / DigitalOcean / Google Cloud

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for cloud-specific instructions.

---

## Verification

### 1. Health Check

```bash
curl http://localhost:3000/apis/health
```

Expected response:
```json
{
  "timestamp": "2025-10-24T...",
  "status": "healthy",
  "uptime": 123.45,
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "api": "healthy"
  },
  "version": "1.0.0",
  "responseTime": "45ms"
}
```

### 2. Check Services

```bash
# Check PostgreSQL
psql -U zuperior -d zuperior_terminal -c "SELECT 1"

# Check Redis
redis-cli ping

# Check application logs
pm2 logs zuperior-terminal
```

### 3. Test Application

1. Open browser: http://localhost:3000
2. Register a new account
3. Log in
4. Verify terminal loads
5. Check market data loads
6. Test placing an order (demo)

---

## Performance Optimization Checklist

After installation, verify these optimizations are working:

- [ ] **Database Connection Pooling:** Check `DATABASE_URL` has connection_limit parameter
- [ ] **Redis Cache:** Verify Redis is running and connected
- [ ] **Rate Limiting:** Test by making >10 rapid requests to `/apis/auth/login`
- [ ] **Health Checks:** `/apis/health` endpoint returns all services as healthy
- [ ] **Environment Validation:** No errors about missing environment variables in logs
- [ ] **Prisma Indexes:** Run `npx prisma db push` to apply performance indexes

---

## Troubleshooting

### Database Connection Issues

**Error:** "Can't reach database server"

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U zuperior -d zuperior_terminal

# Verify DATABASE_URL format
echo $DATABASE_URL
```

### Redis Connection Issues

**Error:** "Redis connection refused"

```bash
# Check if Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping

# Check Redis configuration
redis-cli config get *
```

### Port Already in Use

**Error:** "Port 3000 is already in use"

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

### Prisma Migration Errors

**Error:** "Migration failed"

```bash
# Reset database (CAUTION: Deletes all data)
npx prisma migrate reset

# Or manually fix
npx prisma db push --force-reset
```

### Build Errors

**Error:** Build fails

```bash
# Clear cache and rebuild
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Memory Issues

**Error:** "JavaScript heap out of memory"

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Post-Installation

### 1. Set Up Monitoring

- [ ] Configure application monitoring (Sentry, DataDog, etc.)
- [ ] Set up log aggregation
- [ ] Configure alerts for health check failures
- [ ] Set up performance monitoring

### 2. Security Hardening

- [ ] Change all default passwords
- [ ] Enable firewall rules
- [ ] Configure SSL/TLS certificates
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable CORS properly
- [ ] Review and update security headers

### 3. Backup Strategy

- [ ] Set up automated database backups
- [ ] Configure Redis persistence
- [ ] Test backup restoration process
- [ ] Document recovery procedures

### 4. Load Testing

```bash
# Install k6 or Artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://localhost:3000
```

---

## Support & Resources

- **Documentation:** [TERMINAL_ANALYSIS.md](./TERMINAL_ANALYSIS.md)
- **Scaling Guide:** [SCALING_OPTIMIZATION_PLAN.md](./SCALING_OPTIMIZATION_PLAN.md)
- **Docker Guide:** [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)

---

## Next Steps

1. Review [SCALING_OPTIMIZATION_PLAN.md](./SCALING_OPTIMIZATION_PLAN.md) for phase 2-4 optimizations
2. Implement WebSocket for real-time updates
3. Set up CI/CD pipeline
4. Configure CDN for static assets
5. Implement comprehensive monitoring

---

**Version:** 1.0  
**Last Updated:** October 24, 2025  
**Status:** Production Ready

