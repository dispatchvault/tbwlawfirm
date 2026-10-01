/**
 * Blog data access layer.
 *
 * TODO(supabase): this module is the seam for the future database-backed blog.
 * It is currently backed by a LOCAL STUB: src/data/posts.json (edit it
 * directly to add or change posts).
 * When the Supabase backend lands, replace the implementations below with
 * queries returning the same shapes — nothing else in the site needs to change.
 */
import postsJson from '../data/posts.json';
import archiveJson from '../data/posts-archive.json';
import categoriesJson from '../data/categories.json';

// posts-archive.json holds the six published CMS posts that live pages serve at
// /blog/<slug> but that never appeared on the live blog index (order: null keeps
// them unlisted here too).
const allPosts = [...postsJson, ...archiveJson];

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
  return allPosts as BlogPost[];
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  return (allPosts as BlogPost[]).find((p) => p.slug === slug);
}

export async function getCategories(): Promise<string[]> {
  return categoriesJson as string[];
}

/** slug used by the retired /category/* URLs, e.g. "Events & Sponsorship" -> events-sponsorship */
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
