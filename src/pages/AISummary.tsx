import { useState } from 'react';
import { AlertCircle, Clock, Database, RefreshCw, Sparkles } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/feedback/Loading';
import { useAISummary } from '@/hooks/useAISummary';
import { loadDemoData } from '@/lib/checkins';
import { longDate } from '@/lib/health';

const PERIOD_OPTIONS = [
  { value: '7',  label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];


export function AISummaryPage() {
  const { activeProfile } = useActiveProfile();
  const [days, setDays] = useState('14');
  const { result, loading, error, generate, reset } = useAISummary();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  if (!activeProfile) return <Loading label="Loading profile" />;

  function handleGenerate() {
    reset();
    setSeedError(null);
    generate(activeProfile!.id, Number(days));
  }

  async function handleLoadDemo() {
    setSeeding(true);
    setSeedError(null);
    reset();
    try {
      await loadDemoData(activeProfile!.id);
      // Auto-generate after seeding
      generate(activeProfile!.id, Number(days));
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : 'Could not load demo data.');
    } finally {
      setSeeding(false);
    }
  }

  const isNoDataError = error?.toLowerCase().includes('no check-in data') ||
                        error?.toLowerCase().includes('no check-ins');

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
          AI Health Summary
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          A plain-language overview of {activeProfile.display_name}'s logged habits — powered by Gemini AI.
        </p>
      </div>

      {/* Medical disclaimer */}
      <div className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--warn-bg)', border: '1px solid rgba(245,158,11,.2)' }}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--warn)' }} />
        <p className="text-sm" style={{ color: 'var(--warn-text)' }}>
          <strong>Informational only.</strong> This summary describes patterns in your logged data.
          It is not medical advice, a diagnosis, or a treatment recommendation.
          Always consult a qualified healthcare professional for medical decisions.
        </p>
      </div>

      {/* Period selector + generate */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>Period</label>
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setDays(opt.value)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: days === opt.value ? 'var(--accent-bg)' : 'var(--bg-card-2,var(--bg-card))',
                    color:      days === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                    border:     `1px solid ${days === opt.value ? 'var(--accent-border)' : 'var(--border)'}`,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleGenerate} loading={loading} disabled={loading || seeding}>
            <Sparkles className="h-4 w-4" />
            {result ? 'Regenerate' : 'Generate summary'}
          </Button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Generated from your logged check-ins, activities and goals using Gemini AI.
          Your documents and personal identifiers are never sent to the AI.
        </p>
      </Card>

      {/* Error — no data: show seed option */}
      {error && isNoDataError && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'var(--warn-bg)' }}>
              <Database className="h-7 w-7" style={{ color: 'var(--warn)' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                No check-in data found
              </p>
              <p className="mt-1 text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                The AI summary needs at least a few days of logged data.
                Load 14 days of demo check-ins to see it in action, or go to Check-ins and log today's reading.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button loading={seeding} onClick={handleLoadDemo}>
                <Database className="h-4 w-4" />
                Load demo data &amp; generate
              </Button>
              <Button variant="outline" onClick={() => window.location.hash = '/check-ins'}>
                Log check-in first
              </Button>
            </div>
            {seedError && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{seedError}</p>
            )}
          </div>
        </Card>
      )}

      {/* Error — other errors */}
      {error && !isNoDataError && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,.2)' }}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--danger-text)' }}>
              Could not generate summary
            </p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--danger-text)' }}>{error}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={handleGenerate}>
            <RefreshCw className="h-4 w-4" />Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {(loading || seeding) && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#c084fc22,#818cf822)' }}>
              <Sparkles className="h-7 w-7 animate-pulse" style={{ color: '#c084fc' }} />
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {seeding ? 'Loading demo data…' : `Analysing ${PERIOD_OPTIONS.find(o => o.value === days)?.label.toLowerCase()}…`}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {seeding ? 'Setting up 14 days of check-ins, then generating your summary.' : 'Gemini is reading your health patterns. This takes a few seconds.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && !loading && !seeding && (
        <Card>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 pb-4"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <CardHeader
              title="AI Health Summary"
              subtitle={`${longDate(result.period_start)} → ${longDate(result.period_end)}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: 'rgba(192,132,252,.15)', color: '#c084fc' }}>
                <Sparkles className="h-3 w-3" />Gemini AI
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                {PERIOD_OPTIONS.find(o => o.value === String(result.period_days))?.label}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {result.summary.split('\n').filter(Boolean).map((para, i) => {
              const isDisclaimer = para.toLowerCase().includes('informational summary only');
              return (
                <p key={i} className="leading-relaxed" style={{
                  fontSize:   isDisclaimer ? 12 : 14,
                  color:      isDisclaimer ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontStyle:  isDisclaimer ? 'italic' : 'normal',
                  marginTop:  isDisclaimer ? 8 : 0,
                  paddingTop: isDisclaimer ? 8 : 0,
                  borderTop:  isDisclaimer ? '1px solid var(--border)' : 'none',
                }}>
                  {para}
                </p>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 pt-4"
            style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Generated from your logged check-ins, activities, and goals only.
            </p>
            <Button size="sm" variant="outline" onClick={handleGenerate}>
              <RefreshCw className="h-3.5 w-3.5" />Regenerate
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!result && !loading && !seeding && !error && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#c084fc18,#818cf818)' }}>
              <Sparkles className="h-8 w-8" style={{ color: '#c084fc' }} />
            </div>
            <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              No summary generated yet
            </p>
            <p className="max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>
              Select a period above and click "Generate summary". You need at least a few logged check-ins first.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <Button onClick={handleGenerate}>
                <Sparkles className="h-4 w-4" />Generate summary
              </Button>
              <Button variant="outline" loading={seeding} onClick={handleLoadDemo}>
                <Database className="h-4 w-4" />Load demo data first
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
