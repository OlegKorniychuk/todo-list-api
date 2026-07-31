DROP INDEX "tasks_list_id_idx";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "position" double precision;--> statement-breakpoint
WITH ranked AS (
  SELECT id, (row_number() OVER (PARTITION BY list_id ORDER BY created_at, id)) * 65536 AS new_position
  FROM "tasks"
)
UPDATE "tasks" t SET position = ranked.new_position
FROM ranked WHERE ranked.id = t.id;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_list_id_position_idx" ON "tasks" USING btree ("list_id","position");