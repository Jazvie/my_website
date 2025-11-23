import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    date: z.coerce.date(),
    thumbnail: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
