import { notFound } from 'next/navigation';
import { getPostBySlug, listPublishedPosts } from '@/lib/content-os/client';
import { extractSections } from '@/components/blog/ArticleBody';
import ArticleClient from './ArticleClient';

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Not found — RolePitch Blog' };
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.subtitle || '',
    alternates: { canonical: `https://www.rolepitch.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.subtitle || post.meta_description || '',
      type: 'article',
      url: `https://www.rolepitch.com/blog/${post.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.subtitle || post.meta_description || '',
    },
  };
}

function shapeRelated(p) {
  return {
    slug: p.slug,
    title: p.title,
    tag: p.primary_tag || 'Career Strategy',
    date: p.published_at || p.updated_at,
    rt: p.read_time || '5 min read',
  };
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const all = await listPublishedPosts();
  const sameTag = all.filter((p) => p.slug !== slug && p.primary_tag === post.primary_tag);
  const related = (sameTag.length >= 3 ? sameTag : [...sameTag, ...all.filter((p) => p.slug !== slug && p.primary_tag !== post.primary_tag)]).slice(0, 3).map(shapeRelated);
  const sections = extractSections(post.content);

  return <ArticleClient post={post} related={related} sections={sections} />;
}
