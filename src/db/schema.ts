import { relations, sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// --- Enums -----------------------------------------------------------------

export const taskStatus = pgEnum('task_status', [
  'todo',
  'in_progress',
  'done',
]);
export const shareRole = pgEnum('share_role', ['viewer', 'editor']);

// --- Reusable column groups ------------------------------------------------

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

// --- Tables ----------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    ...timestamps,
  },
  (table) => [
    // Case-insensitive unique email.
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('refresh_tokens_user_id_idx').on(table.userId)],
);

export const todoLists = pgTable(
  'todo_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    ...timestamps,
  },
  (table) => [index('todo_lists_owner_id_idx').on(table.ownerId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id')
      .notNull()
      .references(() => todoLists.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: taskStatus('status').default('todo').notNull(),
    position: doublePrecision('position').notNull(),
    ...timestamps,
  },
  (table) => [
    index('tasks_list_id_position_idx').on(table.listId, table.position),
    index('tasks_list_id_status_idx').on(table.listId, table.status),
  ],
);

export const listShares = pgTable(
  'list_shares',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id')
      .notNull()
      .references(() => todoLists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: shareRole('role').default('viewer').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('list_shares_list_user_unique').on(table.listId, table.userId),
  ],
);

// --- Relations -------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  todoLists: many(todoLists),
  refreshTokens: many(refreshTokens),
  listShares: many(listShares),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const todoListsRelations = relations(todoLists, ({ one, many }) => ({
  owner: one(users, {
    fields: [todoLists.ownerId],
    references: [users.id],
  }),
  tasks: many(tasks),
  shares: many(listShares),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  list: one(todoLists, {
    fields: [tasks.listId],
    references: [todoLists.id],
  }),
}));

export const listSharesRelations = relations(listShares, ({ one }) => ({
  list: one(todoLists, {
    fields: [listShares.listId],
    references: [todoLists.id],
  }),
  user: one(users, {
    fields: [listShares.userId],
    references: [users.id],
  }),
}));

// --- Inferred types --------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type TodoList = typeof todoLists.$inferSelect;
export type NewTodoList = typeof todoLists.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type ListShare = typeof listShares.$inferSelect;
export type NewListShare = typeof listShares.$inferInsert;

export type TaskStatus = (typeof taskStatus.enumValues)[number];
export type ShareRole = (typeof shareRole.enumValues)[number];
