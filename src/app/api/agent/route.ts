import { NextRequest, NextResponse } from 'next/server';
import { duckDuckGoSiteSearch } from '@/lib/search';
import { AgentResponse, BrandRecord } from '@/lib/types';
import { enrichWithContact, extractFromArticle, fetchHtml } from '@/lib/extract';

const DEFAULT_SOURCES = [
  'yourstory.com',
  'inc42.com',
  'entrackr.com',
  'vccircle.com',
  'startuptalky.com'
];

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || 'India startup funding raises seed Series A brand';
  const max = Math.min(parseInt(searchParams.get('max') || '20', 10) || 20, 50);
  const providedSources = searchParams.get('sources');
  const sources = providedSources ? providedSources.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_SOURCES;

  const started = Date.now();

  const allArticleUrls: string[] = [];

  // Search in parallel across sources
  const urlLists = await Promise.all(sources.map(src => duckDuckGoSiteSearch(src, query, Math.ceil(max / sources.length) + 2)));
  for (const list of urlLists) {
    for (const u of list) {
      if (!allArticleUrls.includes(u)) allArticleUrls.push(u);
      if (allArticleUrls.length >= max) break;
    }
    if (allArticleUrls.length >= max) break;
  }

  // Fetch and extract each article with short time budget
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  const extracted: BrandRecord[] = [];
  try {
    const pageHtmls = await Promise.all(
      allArticleUrls.map(async (u) => ({ url: u, html: await fetchHtml(u) }))
    );

    for (const { url, html } of pageHtmls) {
      if (!html) continue;
      const records = extractFromArticle(url, html).map(r => ({ ...r, source: new URL(url).hostname }));
      for (const r of records) extracted.push(r);
      if (extracted.length >= max) break;
    }
  } finally {
    clearTimeout(timeout);
  }

  // Enrich with contact details (best effort, lightly rate-limited)
  const enriched: BrandRecord[] = [];
  const slice = extracted.slice(0, max);
  for (const r of slice) {
    const e = await enrichWithContact(r);
    enriched.push(e);
  }

  // Deduplicate by brand name + website
  const deduped = Object.values(
    enriched.reduce((acc, r) => {
      const key = `${(r.brandName || '').toLowerCase()}|${(r.website || '').toLowerCase()}`;
      if (!acc[key]) acc[key] = r;
      else {
        acc[key].businessStats = Array.from(new Set([...(acc[key].businessStats || []), ...(r.businessStats || [])]));
        acc[key].fundingHistory = Array.from(new Set([...(acc[key].fundingHistory || []), ...(r.fundingHistory || [])]));
        acc[key].contacts = Array.from(new Set([...(acc[key].contacts || []), ...(r.contacts || [])]));
        acc[key].email = acc[key].email || r.email;
        acc[key].phone = acc[key].phone || r.phone;
        acc[key].address = acc[key].address || r.address;
        acc[key].headline = acc[key].headline || r.headline;
        acc[key].source = acc[key].source || r.source;
        acc[key].articleUrl = acc[key].articleUrl || r.articleUrl;
      }
      return acc;
    }, {} as Record<string, BrandRecord>)
  );

  const finished = Date.now();
  const body: AgentResponse = {
    results: deduped,
    meta: {
      totalSources: sources.length,
      totalArticlesScanned: allArticleUrls.length,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started
    }
  };

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
