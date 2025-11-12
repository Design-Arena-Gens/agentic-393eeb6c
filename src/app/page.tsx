"use client";

import { useMemo, useState } from 'react';

type BrandRecord = {
  brandName: string;
  website?: string;
  headline?: string;
  articleUrl?: string;
  address?: string;
  email?: string;
  phone?: string;
  contacts?: string[];
  businessStats?: string[];
  fundingHistory?: string[];
  likelyLookingForFunding?: boolean;
  source?: string;
};

type AgentResponse = {
  results: BrandRecord[];
  meta: {
    totalSources: number;
    totalArticlesScanned: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
  }
}

const DEFAULT_SOURCES = [
  'yourstory.com',
  'inc42.com',
  'entrackr.com',
  'vccircle.com',
  'startuptalky.com'
];

export default function Page() {
  const [query, setQuery] = useState("India startup funding raises seed Series A brand");
  const [maxResults, setMaxResults] = useState(25);
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceStr = useMemo(() => sources.join(','), [sources]);

  async function runAgent() {
    setError(null);
    setLoading(true);
    setResp(null);
    try {
      const r = await fetch(`/api/agent?q=${encodeURIComponent(query)}&max=${maxResults}&sources=${encodeURIComponent(sourceStr)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as AgentResponse;
      setResp(j);
    } catch (e: any) {
      setError(e?.message || 'Failed to run agent');
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!resp) return;
    const headers = ['Brand Name','Website','Email','Phone','Address','Funding History','Business Stats','Source','Headline','Article URL','Looking For Funding'];
    const rows = resp.results.map(r => [
      r.brandName || '',
      r.website || '',
      r.email || (r.contacts?.[0] || ''),
      r.phone || '',
      r.address || '',
      (r.fundingHistory || []).join(' | '),
      (r.businessStats || []).join(' | '),
      r.source || '',
      r.headline || '',
      r.articleUrl || '',
      r.likelyLookingForFunding ? 'Yes' : 'No'
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'india-funding-finder.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container">
      <h1>India Funding Finder Agent</h1>
      <p className="small">Find brands in India raising or seeking funding. Best-effort web crawler using public sources.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="grid">
          <div>
            <label className="small">Query</label>
            <input className="input" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div>
            <label className="small">Max Results</label>
            <input className="input" type="number" min={5} max={50} value={maxResults} onChange={e => setMaxResults(parseInt(e.target.value || '25', 10))} />
          </div>
          <div>
            <label className="small">Sources (comma-separated)</label>
            <input className="input" value={sourceStr} onChange={e => setSources(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="button" onClick={runAgent} disabled={loading}>Run Agent</button>
          <button className="button" onClick={downloadCsv} disabled={!resp || loading}>Export CSV</button>
          {loading ? <span className="badge">Running?</span> : resp ? <span className="badge">{resp.results.length} results</span> : null}
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginTop: 16, borderColor: '#7f1d1d' }}>
          <strong style={{ color: '#fca5a5' }}>Error:</strong> {error}
        </div>
      )}

      {resp && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="small">Scanned {resp.meta.totalArticlesScanned} articles across {resp.meta.totalSources} sources in {Math.round(resp.meta.durationMs/1000)}s</div>
          <table className="table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Contacts</th>
                <th>Funding & Stats</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {resp.results.map((r, idx) => (
                <tr key={idx}>
                  <td>
                    <div><strong>{r.brandName}</strong> {r.likelyLookingForFunding ? <span className="badge">Potentially raising</span> : null}</div>
                    {r.website ? <div className="small"><a href={r.website} target="_blank" rel="noreferrer">{r.website}</a></div> : null}
                    {r.headline ? <div className="small">{r.headline}</div> : null}
                  </td>
                  <td>
                    {r.email ? <div>{r.email}</div> : null}
                    {r.phone ? <div className="small">{r.phone}</div> : null}
                    {r.address ? <div className="small">{r.address}</div> : null}
                    {(r.contacts || []).slice(0,3).filter(c => c !== r.email).map((c,i) => <div key={i} className="small">{c}</div>)}
                  </td>
                  <td>
                    {(r.fundingHistory || []).slice(0,3).map((f,i) => <div key={i} className="small">{f}</div>)}
                    {(r.businessStats || []).slice(0,3).map((s,i) => <div key={i} className="small">{s}</div>)}
                  </td>
                  <td>
                    {r.source ? <div className="small">{r.source}</div> : null}
                    {r.articleUrl ? <div className="small"><a href={r.articleUrl} target="_blank" rel="noreferrer">Article</a></div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="small" style={{ marginTop: 24, opacity: 0.7 }}>
        Best-effort extraction from public web pages. Data may be incomplete; please verify before outreach.
      </div>
    </div>
  );
}
