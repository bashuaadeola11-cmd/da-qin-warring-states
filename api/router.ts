import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { insertScore, topScores } from "./queries/scores";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  scores: createRouter({
    submit: publicQuery
      .input(
        z.object({
          name: z.string().min(1).max(24),
          nodeId: z.string().min(1).max(32),
          kills: z.number().int().min(0).max(10000),
          score: z.number().int().min(0).max(10000000),
          timeSec: z.number().int().min(0).max(86400),
          victory: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await insertScore(input);
        return { ok: true };
      }),

    top: publicQuery
      .input(z.object({ nodeId: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) }))
      .query(async ({ input }) => topScores(input.nodeId, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
