import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const activityTable = pgTable("sms_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ActivityLog = typeof activityTable.$inferSelect;
