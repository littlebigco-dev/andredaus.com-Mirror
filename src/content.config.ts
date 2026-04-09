import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    slug: z.string(),
    og_title: z.string(),
    summary: z.string().optional(), // AI-generated at build time
    category: z.string(), // Strategy | Psychology | Technology | Business | Methodology
    status: z.enum(['draft', 'published']),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    status: z.enum(['active', 'retired']),
    price: z.string(),
    format: z.string(),
    cta_label: z.string(),
    featured_use_cases: z.array(reference('use-cases')).default([]),
  }),
});

const useCases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/use-cases' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    slug: z.string(),
    og_title: z.string(),
    summary: z.string().optional(), // AI-generated at build time
    status: z.enum(['draft', 'published']),
    category: z.string(), // Strategy | Leadership | Operations | Communication | Decision Making
    related_service: reference('services'),
    related_library: z.array(reference('library')).default([]),
  }),
});

const library = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/library' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    category: z.string(), // bias | liberating-structure | mental-model
    og_title: z.string(),
    summary: z.string().optional(), // AI-generated at build time
    last_updated: z.coerce.date(),
    related_concepts: z.array(reference('library')).default([]), // cross-category
    related_entries: z.array(reference('library')).default([]),  // same-category
    related_use_cases: z.array(reference('use-cases')).default([]),
  }),
});

const faqs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    category: z.string(), // Services | Methodology | Working Together | Technical
    order: z.number(),
  }),
});

const podcast = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/podcast' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    slug: z.string(),
    episode_number: z.number(),
    summary: z.string().optional(), // AI-generated at build time
    og_title: z.string(),
    spotify_url: z.string().url(),
    youtube_url: z.string().url().optional(), // recent episodes only
    category: z.string(), // Solo Episode | Interview | Case Study
    status: z.enum(['draft', 'published']),
  }),
});

export const collections = {
  insights,
  services,
  'use-cases': useCases,
  library,
  faqs,
  podcast,
};
