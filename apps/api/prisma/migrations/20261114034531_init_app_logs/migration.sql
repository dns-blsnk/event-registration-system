-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('ERROR', 'SECURITY');

-- CreateTable
CREATE TABLE "app_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL,
    "category" "LogCategory" NOT NULL,
    "request_id" VARCHAR(64),
    "method" VARCHAR(10),
    "route" VARCHAR(512),
    "status_code" SMALLINT,
    "error_code" VARCHAR(64),
    "message" VARCHAR(2000) NOT NULL,
    "stack" VARCHAR(8000),
    "user_id" UUID,
    "user_role" VARCHAR(16),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "duration_ms" INTEGER,
    "context" JSONB,

    CONSTRAINT "app_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_logs_created_at_idx" ON "app_logs"("created_at");

-- CreateIndex
CREATE INDEX "app_logs_request_id_idx" ON "app_logs"("request_id");

-- CreateIndex
CREATE INDEX "app_logs_status_code_created_at_idx" ON "app_logs"("status_code", "created_at");

-- CreateIndex
CREATE INDEX "app_logs_category_created_at_idx" ON "app_logs"("category", "created_at");
