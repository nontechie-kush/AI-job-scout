import { listPublishedPosts } from '@/lib/content-os/client';
import BlogLandingClient from './BlogLandingClient';

export const revalidate = 60;

export const metadata = {
  title: 'Career Advice That Actually Works | RolePitch Blog',
  description: 'Data-backed strategies for job seekers navigating ATS, resume tailoring, and a broken job market. No fluff. Updated weekly.',
  alternates: { canonical: 'https://www.rolepitch.com/blog' },
};

function shape(p) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.subtitle || p.meta_description || '',
    tag: p.primary_tag || 'Career Strategy',
    img: p.illustration_idx ?? 0,
    featured: !!p.featured,
    author: p.author_name || 'RolePitch',
    ai: p.author_initial || (p.author_name?.[0] || 'R').toUpperCase(),
    ac: p.author_color || '#4f6ef7',
    date: p.published_at || p.updated_at,
    rt: p.read_time || '5 min read',
  };
}

export default async function BlogPage() {
  const raw = await listPublishedPosts();
  const posts = raw.map(shape);
  return <BlogLandingClient posts={posts} />;
}
