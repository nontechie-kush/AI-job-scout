import { NextResponse } from 'next/server';
import { listPublishedPosts } from '@/lib/content-os/client';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const raw = await listPublishedPosts();
    const posts = raw.slice(0, 5).map((p) => ({
      slug: p.slug,
      title: p.title,
      tag: p.primary_tag || 'Career Strategy',
      read_time: p.read_time || '5 min read',
    }));
    return NextResponse.json({ posts }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json({ posts: [] });
  }
}
