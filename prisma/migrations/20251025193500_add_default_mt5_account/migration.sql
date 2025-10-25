-- Create table for storing default MT5 account per user

CREATE TABLE "DefaultMT5Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mt5AccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DefaultMT5Account_pkey" PRIMARY KEY ("id")
);

-- A user can have only one default account
CREATE UNIQUE INDEX "DefaultMT5Account_userId_key" ON "DefaultMT5Account" ("userId");
CREATE INDEX "DefaultMT5Account_mt5AccountId_idx" ON "DefaultMT5Account" ("mt5AccountId");

-- FKs: userId -> User.id, mt5AccountId -> MT5Account.accountId
ALTER TABLE "DefaultMT5Account"
  ADD CONSTRAINT "DefaultMT5Account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DefaultMT5Account"
  ADD CONSTRAINT "DefaultMT5Account_mt5AccountId_fkey"
  FOREIGN KEY ("mt5AccountId") REFERENCES "MT5Account"("accountId") ON DELETE RESTRICT ON UPDATE CASCADE;

