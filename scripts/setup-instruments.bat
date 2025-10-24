@echo off
REM Setup Instruments - Complete Initial Setup Script for Windows
REM This script will:
REM 1. Run database migration
REM 2. Sync instruments from external API
REM 3. Add default favorites to all existing users

echo.
echo Starting Instruments Setup...
echo.

REM Step 1: Generate Prisma Client
echo Step 1: Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo Error: Failed to generate Prisma client
    exit /b %errorlevel%
)
echo Prisma client generated successfully
echo.

REM Step 2: Run Database Migration
echo Step 2: Running database migration...
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo Error: Failed to run database migration
    exit /b %errorlevel%
)
echo Database migration completed
echo.

REM Step 3: Sync Instruments
echo Step 3: Syncing instruments from external API...
call npx ts-node scripts/sync-instruments.ts
if %errorlevel% neq 0 (
    echo Error: Failed to sync instruments
    exit /b %errorlevel%
)
echo Instruments synced successfully
echo.

REM Step 4: Add Default Favorites
echo Step 4: Adding default favorites to all users...
call npx ts-node scripts/add-default-favorites.ts
if %errorlevel% neq 0 (
    echo Error: Failed to add default favorites
    exit /b %errorlevel%
)
echo Default favorites added
echo.

echo.
echo Instruments setup completed successfully!
echo.
echo Default favorites configured:
echo   - EUR/USD
echo   - XAU/USD
echo   - GBP/USD
echo   - BTCUSD
echo   - ETHUSD
echo.
echo These pairs will be automatically added to:
echo   - All existing users (just added)
echo   - All new users on registration
echo   - All users on login (if they don't have any)
echo.
pause

