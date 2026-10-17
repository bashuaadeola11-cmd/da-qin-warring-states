import {
  mysqlTable,
  serial,
  varchar,
  int,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

export const scores = mysqlTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 24 }).notNull(),
    nodeId: varchar("node_id", { length: 32 }).notNull(),
    kills: int("kills").notNull(),
    score: int("score").notNull(),
    timeSec: int("time_sec").notNull(),
    victory: boolean("victory").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_scores_node_score").on(t.nodeId, t.score)]
);

export type Score = typeof scores.$inferSelect;
