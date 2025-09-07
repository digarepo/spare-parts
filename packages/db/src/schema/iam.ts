import { pgTable, uuid, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 190 }).notNull().unique(),
  fullName: varchar('full_name', { length: 160 }),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
});
