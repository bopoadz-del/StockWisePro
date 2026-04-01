-- Enterprise Migration: Convert single-user to multi-tenant
-- This migration handles existing data

-- Step 1: Create enums first
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED');
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'ANALYST', 'MEMBER', 'VIEWER', 'API');
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'MFA_ENABLED', 'MFA_DISABLED', 'TOKEN_REFRESHED', 'SESSION_REVOKED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_INVITED', 'USER_ROLE_CHANGED', 'USER_SUSPENDED', 'USER_ACTIVATED', 'ORG_CREATED', 'ORG_UPDATED', 'ORG_SETTINGS_CHANGED', 'PLAN_CHANGED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'API_KEY_USED', 'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED', 'WEBHOOK_DELIVERED', 'WEBHOOK_FAILED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'DATA_DELETED', 'PERMISSION_DENIED', 'RATE_LIMITED', 'IP_BLOCKED');
CREATE TYPE "AlertType" AS ENUM ('PRICE', 'PERCENT_CHANGE', 'VOLUME', 'MARKET_CAP');
CREATE TYPE "AlertCondition" AS ENUM ('ABOVE', 'BELOW', 'EQUALS', 'PERCENT_UP', 'PERCENT_DOWN');
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'MERGER');

-- Step 2: Create organizations table
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "maxApiCalls" INTEGER NOT NULL DEFAULT 1000,
    "maxWebhooks" INTEGER NOT NULL DEFAULT 0,
    "maxTeams" INTEGER NOT NULL DEFAULT 0,
    "storageQuota" INTEGER NOT NULL DEFAULT 100,
    "features" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "allowedEmailDomains" TEXT[],
    "ipWhitelist" TEXT[],
    "sessionTimeout" INTEGER NOT NULL DEFAULT 480,
    "passwordPolicy" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- Step 3: Create default organization for existing data
INSERT INTO "organizations" ("id", "name", "slug", "plan", "subscriptionStatus", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization', 'default-org', 'ENTERPRISE', 'ACTIVE', CURRENT_TIMESTAMP);

-- Step 4: Add new columns to existing users table
ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "users" ADD COLUMN "role" "UserRole" DEFAULT 'OWNER';
ALTER TABLE "users" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "mfaEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "failedLoginAttempts" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "passwordHistory" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "invitedBy" TEXT;
ALTER TABLE "users" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Step 5: Migrate existing users to default organization
UPDATE "users" SET "organizationId" = '00000000-0000-0000-0000-000000000000' WHERE "organizationId" IS NULL;

-- Step 6: Make organizationId required
ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 7: Add foreign key
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes on users
CREATE UNIQUE INDEX "users_email_organizationId_key" ON "users"("email", "organizationId");
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- Step 8: Create new enterprise tables (simplified)
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" TEXT[] NOT NULL,
    "allowedIps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "api_keys_keyHash_key" UNIQUE ("keyHash")
);
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] NOT NULL,
    "retryPolicy" JSONB NOT NULL DEFAULT '{}',
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_token_key" UNIQUE ("token")
);
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update existing tables with organization context
ALTER TABLE "watchlists" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "watchlists" ADD COLUMN "teamId" TEXT;
ALTER TABLE "watchlists" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "watchlists" ADD COLUMN "isDefault" BOOLEAN DEFAULT false;
ALTER TABLE "watchlists" ADD COLUMN "isPublic" BOOLEAN DEFAULT false;
ALTER TABLE "watchlists" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "watchlists" SET "organizationId" = '00000000-0000-0000-0000-000000000000' WHERE "organizationId" IS NULL;
ALTER TABLE "watchlists" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "watchlists" ALTER COLUMN "createdBy" SET NOT NULL;
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watchlist_items" ADD COLUMN "addedBy" TEXT;
UPDATE "watchlist_items" SET "addedBy" = 'system' WHERE "addedBy" IS NULL;
ALTER TABLE "watchlist_items" ALTER COLUMN "addedBy" SET NOT NULL;

ALTER TABLE "portfolios" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "portfolios" ADD COLUMN "teamId" TEXT;
ALTER TABLE "portfolios" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "portfolios" ADD COLUMN "isDefault" BOOLEAN DEFAULT false;
ALTER TABLE "portfolios" ADD COLUMN "mimicInvestor" TEXT;
ALTER TABLE "portfolios" ADD COLUMN "mimicAllocation" JSONB;
ALTER TABLE "portfolios" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "portfolios" SET "organizationId" = '00000000-0000-0000-0000-000000000000' WHERE "organizationId" IS NULL;
ALTER TABLE "portfolios" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "portfolios" ALTER COLUMN "createdBy" SET NOT NULL;
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alerts" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "alerts" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "alerts" ADD COLUMN "type" "AlertType" DEFAULT 'PRICE';
ALTER TABLE "alerts" ADD COLUMN "condition" "AlertCondition" DEFAULT 'ABOVE';
ALTER TABLE "alerts" ADD COLUMN "notifyEmail" BOOLEAN DEFAULT true;
ALTER TABLE "alerts" ADD COLUMN "notifyWebhook" BOOLEAN DEFAULT false;
ALTER TABLE "alerts" ADD COLUMN "notifyInApp" BOOLEAN DEFAULT true;
ALTER TABLE "alerts" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "alerts" ADD COLUMN "triggeredCount" INTEGER DEFAULT 0;
ALTER TABLE "alerts" ADD COLUMN "lastTriggeredAt" TIMESTAMP(3);
ALTER TABLE "alerts" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "alerts" SET "organizationId" = '00000000-0000-0000-0000-000000000000' WHERE "organizationId" IS NULL;
ALTER TABLE "alerts" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "alerts" ALTER COLUMN "createdBy" SET NOT NULL;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "alert_logs" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT,
    "triggeredPrice" DECIMAL(65,30) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notificationMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_alertId_fkey" 
    FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiments" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "experiments" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "experiments" ADD COLUMN "isPublic" BOOLEAN DEFAULT false;
ALTER TABLE "experiments" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "experiments" SET "organizationId" = '00000000-0000-0000-0000-000000000000' WHERE "organizationId" IS NULL;
ALTER TABLE "experiments" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "experiments" ALTER COLUMN "createdBy" SET NOT NULL;
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
