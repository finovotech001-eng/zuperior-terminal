-- Create missing tables for Instrument and UserFavorite

-- CreateTable: Instrument
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "group" TEXT,
    "digits" INTEGER NOT NULL DEFAULT 5,
    "contractSize" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "minVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "maxVolume" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "volumeStep" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "spread" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tradingHours" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- Indexes for Instrument
CREATE UNIQUE INDEX "Instrument_symbol_key" ON "Instrument"("symbol");

-- CreateTable: UserFavorite
CREATE TABLE "UserFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- Indexes for UserFavorite
CREATE UNIQUE INDEX "UserFavorite_userId_instrumentId_key" ON "UserFavorite"("userId", "instrumentId");
CREATE INDEX "UserFavorite_userId_idx" ON "UserFavorite"("userId");
CREATE INDEX "UserFavorite_instrumentId_idx" ON "UserFavorite"("instrumentId");

-- Foreign Keys
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

