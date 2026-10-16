import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const businessesTable = pgTable("sms_businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  businessName: text("business_name").notNull(),
  legalName: text("legal_name").notNull(),
  brandName: text("brand_name").notNull(),
  websiteUrl: text("website_url").notNull(),
  entityType: text("entity_type").notNull(),
  contactEmail: text("contact_email").notNull(),
  streetAddress: text("street_address").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("US"),
  useCase: text("use_case").notNull(),
  campaignDescription: text("campaign_description").notNull().default(""),
  messageFrequency: text("message_frequency").notNull().default(""),
  sampleMessages: jsonb("sample_messages").$type<string[]>().notNull().default([]),
  optInMethod: text("opt_in_method").notNull(),
  optInDescription: text("opt_in_description").notNull().default(""),
  consentCheckboxPresent: boolean("consent_checkbox_present")
    .notNull()
    .default(false),
  consentCopy: text("consent_copy"),
  privacyPolicyText: text("privacy_policy_text"),
  smsTermsText: text("sms_terms_text"),
  publicSlug: text("public_slug").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Business = typeof businessesTable.$inferSelect;
export type NewBusiness = typeof businessesTable.$inferInsert;
