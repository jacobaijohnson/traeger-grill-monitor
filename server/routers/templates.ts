import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOK_TEMPLATES } from "@shared/cook-templates";
import { MEAT_PROFILES } from "@shared/meat-science";
import {
  createCustomTemplate,
  getUserCustomTemplates,
  getPublishedTemplates,
  getCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  forkCustomTemplate,
} from "../db";

export const templatesRouter = router({
  list: publicProcedure
    .input(z.object({ category: z.string().optional(), method: z.string().optional() }).optional())
    .query(({ input }) => {
      let templates = COOK_TEMPLATES;
      if (input?.category) templates = templates.filter((t) => t.category === input.category);
      if (input?.method) templates = templates.filter((t) => t.method === input.method);
      return templates;
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const template = COOK_TEMPLATES.find((t) => t.id === input.id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      return template;
    }),
});

export const customTemplatesRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      category: z.string(),
      method: z.string(),
      meatCut: z.string().optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      estimatedTime: z.string().optional(),
      stages: z.array(z.object({
        name: z.string(),
        grillTemp: z.number(),
        triggerType: z.enum(["time", "probe_temp", "manual"]),
        triggerValue: z.number(),
        superSmoke: z.boolean(),
        alertMessage: z.string(),
      })),
      tips: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createCustomTemplate({
        userId: ctx.user.id,
        authorName: ctx.user.name || "Anonymous Pitmaster",
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        method: input.method,
        meatCut: input.meatCut ?? null,
        difficulty: input.difficulty,
        estimatedTime: input.estimatedTime ?? null,
        stagesJson: JSON.stringify(input.stages),
        tipsJson: input.tips ? JSON.stringify(input.tips) : null,
        isPublished: 0,
        forkCount: 0,
        forkedFromId: null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      method: z.string().optional(),
      meatCut: z.string().optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      estimatedTime: z.string().optional(),
      stages: z.array(z.object({
        name: z.string(),
        grillTemp: z.number(),
        triggerType: z.enum(["time", "probe_temp", "manual"]),
        triggerValue: z.number(),
        superSmoke: z.boolean(),
        alertMessage: z.string(),
      })).optional(),
      tips: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.category) updateData.category = input.category;
      if (input.method) updateData.method = input.method;
      if (input.meatCut !== undefined) updateData.meatCut = input.meatCut;
      if (input.difficulty) updateData.difficulty = input.difficulty;
      if (input.estimatedTime !== undefined) updateData.estimatedTime = input.estimatedTime;
      if (input.stages) updateData.stagesJson = JSON.stringify(input.stages);
      if (input.tips) updateData.tipsJson = JSON.stringify(input.tips);
      await updateCustomTemplate(input.id, ctx.user.id, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCustomTemplate(input.id, ctx.user.id);
      return { success: true };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.number(), publish: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await updateCustomTemplate(input.id, ctx.user.id, { isPublished: input.publish ? 1 : 0 });
      return { success: true };
    }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    return getUserCustomTemplates(ctx.user.id);
  }),

  community: publicProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      return getPublishedTemplates(input?.limit ?? 50);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const template = await getCustomTemplate(input.id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      return template;
    }),

  fork: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const newId = await forkCustomTemplate(input.id, ctx.user.id, ctx.user.name || "Anonymous Pitmaster");
      return { id: newId };
    }),
});

export const meatProfilesRouter = router({
  list: publicProcedure.query(() => {
    return Object.values(MEAT_PROFILES).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      markerCount: p.markers.length,
    }));
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const profile = MEAT_PROFILES[input.id];
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Meat profile not found" });
      return profile;
    }),

  byCategory: publicProcedure.query(() => {
    const grouped: Record<string, Array<{ id: string; name: string; markerCount: number }>> = {};
    for (const profile of Object.values(MEAT_PROFILES)) {
      if (!grouped[profile.category]) grouped[profile.category] = [];
      grouped[profile.category].push({ id: profile.id, name: profile.name, markerCount: profile.markers.length });
    }
    return grouped;
  }),
});
