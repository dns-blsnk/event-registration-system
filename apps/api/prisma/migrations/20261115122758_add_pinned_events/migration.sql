-- CreateTable
CREATE TABLE "pinned_events" (
    "user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_events_pkey" PRIMARY KEY ("user_id","event_id")
);

-- CreateIndex
CREATE INDEX "pinned_events_event_id_idx" ON "pinned_events"("event_id");

-- AddForeignKey
ALTER TABLE "pinned_events" ADD CONSTRAINT "pinned_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_events" ADD CONSTRAINT "pinned_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
