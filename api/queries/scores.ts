import { desc, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { scores } from "@db/schema";

export async function insertScore(row: {
  name: string;
  nodeId: string;
  kills: number;
  score: number;
  timeSec: number;
  victory: boolean;
}) {
  await getDb().insert(scores).values(row);
}

export async function topScores(nodeId: string | undefined, limit: number) {
  const db = getDb();
  const base = db.select().from(scores).orderBy(desc(scores.score)).limit(limit);
  if (nodeId) {
    return db.select().from(scores).where(eq(scores.nodeId, nodeId)).orderBy(desc(scores.score)).limit(limit);
  }
  return base;
}
