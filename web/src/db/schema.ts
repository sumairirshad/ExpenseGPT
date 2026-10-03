import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  defaultCurrency: text("default_currency").notNull().default("PKR"),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    message: text("message").notNull(),
    intent: text("intent"),
    /** Client idempotency key; set on the user's message only. */
    requestId: text("request_id"),
    /** Assistant rows: the user message this answers. */
    replyTo: uuid("reply_to"),
    /** Assistant rows: the full API reply, replayed on duplicate requests. */
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chat_messages_user_request_uq").on(t.userId, t.requestId).where(sql`${t.requestId} is not null`),
    index("chat_messages_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/** Finance categories for manual (Debit/Credit) entries. 12 defaults are seeded per user; see src/lib/finance-categories.ts. */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Lower-case, hyphenated; unique per user so duplicate names are rejected. */
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_user_slug_uq").on(t.userId, t.slug)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    /** Integer minor units (paisa / cents). Never floats. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    /** Category slug from src/lib/categories.ts (a table arrives with custom categories). */
    category: text("category").notNull(),
    description: text("description").notNull(),
    merchant: text("merchant"),
    person: text("person"),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    source: text("source", { enum: ["chat", "manual"] }).notNull(),
    chatMessageId: uuid("chat_message_id").references(() => chatMessages.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete powers Undo. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("transactions_amount_positive", sql`${t.amountMinor} > 0`),
    index("transactions_user_date_idx").on(t.userId, t.transactionDate.desc()),
    index("transactions_user_category_date_idx").on(t.userId, t.category, t.transactionDate),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
