/**
 * Blog data access layer.
 *
 * TODO(supabase): this module is the seam for the future database-backed blog.
 * It is currently backed by a LOCAL STUB: src/data/posts.json, generated from
 * the captured live blog pages by `npm run extract:posts` (scripts/port.mjs).
 * When the Supabase backend lands, replace the implementations below with
 * queries returning the same shapes — nothing else in the site needs to change.
 */
import postsJson from '../data/posts.json';
import categoriesJson from '../data/categories.json';

export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyClass: string;
  categories: string[];
  /** e.g. "October 1, 2024" — rendered verbatim */
  dateDisplay: string;
  /** ISO yyyy-mm-dd, used for ordering */
  date: string | null;
  author: string;
  /** minutes, as displayed ("2") */
  readTime: string;
  heroImage: string | null;
  heroImageSrcset: string | null;
  heroImageSizes: string | null;
  heroImageAlt: string;
  /** cleaned rich-text HTML of the article body */
  bodyHtml: string;
}

export async function getPosts(): Promise<BlogPost[]> {
  return postsJson as BlogPost[];
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  return (postsJson as BlogPost[]).find((p) => p.slug === slug);
}

export async function getCategories(): Promise<string[]> {
  return categoriesJson as string[];
}

/** slug used by the retired /category/* Webflow URLs, e.g. "Events & Sponsorship" -> events-sponsorship */
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
