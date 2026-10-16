import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const registrationsTable = pgTable("sms_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("submitted"),
  mode: text("mode").notNull().default("mock"),
  isMock: boolean("is_mock").notNull().default(true),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const registrationsRelations = relations(registrationsTable, ({ one }) => ({
  business: one(businessesTable, {
    fields: [registrationsTable.businessId],
    references: [businessesTable.id],
  }),
}));

export type Registration = typeof registrationsTable.$inferSelect;
