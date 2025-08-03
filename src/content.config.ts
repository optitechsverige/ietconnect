import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    // SEO and metadata fields
    keywords: z.string().optional(),
    canonical: z.string().optional(),
    // Open Graph fields
    ogTitle: z.string().optional(),
    ogDescription: z.string().optional(),
    ogImage: z.string().optional(),
    ogUrl: z.string().optional(),
    ogType: z.string().default('article'),
    // Author information
    author: z.string().default('IET Connect'),
    // Article category/tags
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
