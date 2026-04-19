import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectImagesSchema = z.array(
  z.object({
    url: z.string(),
    title: z.string(),
    caption: z.string().nullable().optional(),
    durationMs: z.number().int(),
  }),
);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  storyText: text("story_text").notNull(),
  images: jsonb("images").notNull().$type<z.infer<typeof projectImagesSchema>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
