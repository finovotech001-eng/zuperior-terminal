#!/bin/bash

# Setup Instruments - Complete Initial Setup Script
# This script will:
# 1. Run database migration
# 2. Sync instruments from external API
# 3. Add default favorites to all existing users

set -e  # Exit on error

echo "🚀 Starting Instruments Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Generate Prisma Client
echo -e "${BLUE}📦 Step 1: Generating Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"
echo ""

# Step 2: Run Database Migration
echo -e "${BLUE}📦 Step 2: Running database migration...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✅ Database migration completed${NC}"
echo ""

# Step 3: Sync Instruments
echo -e "${BLUE}📥 Step 3: Syncing instruments from external API...${NC}"
npx ts-node scripts/sync-instruments.ts
echo -e "${GREEN}✅ Instruments synced successfully${NC}"
echo ""

# Step 4: Add Default Favorites
echo -e "${BLUE}⭐ Step 4: Adding default favorites to all users...${NC}"
npx ts-node scripts/add-default-favorites.ts
echo -e "${GREEN}✅ Default favorites added${NC}"
echo ""

echo -e "${GREEN}🎉 Instruments setup completed successfully!${NC}"
echo ""
echo "Default favorites configured:"
echo "  • EUR/USD"
echo "  • XAU/USD"
echo "  • GBP/USD"
echo "  • BTCUSD"
echo "  • ETHUSD"
echo ""
echo "These pairs will be automatically added to:"
echo "  • All existing users (just added)"
echo "  • All new users on registration"
echo "  • All users on login (if they don't have any)"
echo ""

