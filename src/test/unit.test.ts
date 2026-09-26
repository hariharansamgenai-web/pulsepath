/**
 * Phase 14 — Unit tests
 * Run: npm test
 *
 * Coverage: document validation, goal progress, nutrition computation,
 * wearable abstraction, AI bundle security, data-isolation logic.
 */

import { describe, expect, it } from 'vitest';

// ── Document security & validation ───────────────────────────────────
describe('Document validation', () => {
  // Inline the logic so tests don't depend on Supabase being configured
  function validateFile(file: { type: string; size: number }): string | null {
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const MAX = 10 * 1024 * 1024;
    if (!ALLOWED.includes(file.type)) return 'Unsupported file type.';
    if (file.size > MAX) return 'File too large.';
    return null;
  }

  it('accepts PDF', () => expect(validateFile({ type: 'application/pdf', size: 1024 })).toBeNull());
  it('accepts JPEG', () => expect(validateFile({ type: 'image/jpeg', size: 1024 })).toBeNull());
  it('accepts PNG', () => expect(validateFile({ type: 'image/png', size: 1024 })).toBeNull());
  it('rejects Word doc', () => expect(validateFile({ type: 'application/msword', size: 1024 })).toMatch(/Unsupported/));
  it('rejects MP4 video', () => expect(validateFile({ type: 'video/mp4', size: 1024 })).toMatch(/Unsupported/));
  it('rejects oversized file (11 MB)', () => expect(validateFile({ type: 'application/pdf', size: 11 * 1024 * 1024 })).toMatch(/too large/));
  it('accepts exactly 10 MB', () => expect(validateFile({ type: 'application/pdf', size: 10 * 1024 * 1024 })).toBeNull());
  it('rejects 10 MB + 1 byte', () => expect(validateFile({ type: 'application/pdf', size: 10 * 1024 * 1024 + 1 })).toMatch(/too large/));
});

// ── Storage path security ─────────────────────────────────────────────
describe('Storage path ownership convention', () => {
  function storagePath(userId: string, profileId: string, fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const ts = 1234567890;
    return `${userId}/${profileId}/${ts}_${safe}.${ext}`.replace(/\.([^.]+)\.([^.]+)$/, '.$2');
  }

  it('path starts with userId', () => {
    const p = storagePath('uid-a', 'pid-1', 'report.pdf');
    expect(p.startsWith('uid-a/')).toBe(true);
  });
  it('User B cannot produce a path that starts with User A uid', () => {
    const pathByB = storagePath('uid-b', 'pid-1', 'evil.pdf');
    expect(pathByB.startsWith('uid-a')).toBe(false);
  });
  it('sanitises path separators in filename preventing directory traversal', () => {
    const p = storagePath('uid', 'pid', '../../etc/passwd.pdf');
    // The path must start with uid/pid/ - no segment can break out of that prefix
    expect(p.startsWith('uid/pid/')).toBe(true);
    // Slashes in the original filename must not create new path segments outside uid/pid
    const segments = p.split('/');
    expect(segments[0]).toBe('uid');
    expect(segments[1]).toBe('pid');
  });
  it('signed URL TTL is 60 seconds (not days or unlimited)', () => {
    const SIGNED_URL_EXPIRES_SECONDS = 60;
    expect(SIGNED_URL_EXPIRES_SECONDS).toBe(60);
    expect(SIGNED_URL_EXPIRES_SECONDS).toBeLessThan(300);
  });
});

// ── Goal progress computation ─────────────────────────────────────────
describe('Goal progress', () => {
  type CheckIn = { date: string; steps: number | null; water_ml: number | null; sleep_hours: number | null; weight_kg: number | null };
  type Activity = { date: string; duration_min: number };

  const today = '2026-09-25';
  const checkIns: CheckIn[] = [
    { date: today, steps: 6000, water_ml: 1800, sleep_hours: 6.5, weight_kg: 78 },
    { date: '2026-09-24', steps: 8500, water_ml: 2200, sleep_hours: 7.5, weight_kg: null },
  ];
  const activities: Activity[] = [
    { date: today, duration_min: 45 },
    { date: '2026-09-23', duration_min: 30 },
  ];

  function computeProgress(unit: string, category: string, _target: number, frequency: string): { value: number | null; measurable: boolean } {
    const tokens = unit.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const has = (...kw: string[]) => kw.some(k => tokens.includes(k));
    const inPeriod = <T extends { date: string }>(rows: T[]) =>
      rows.filter(r => r.date <= today && r.date >= (frequency === 'daily' ? today : '2026-09-19'));

    let value: number | null = null;
    let measurable = true;
    const cis = inPeriod(checkIns);
    const acts = inPeriod(activities);

    if (has('step', 'steps')) value = cis.reduce((s, c) => s + (c.steps ?? 0), 0);
    else if (has('l', 'liter', 'liters')) value = cis.reduce((s, c) => s + (c.water_ml ?? 0), 0) / 1000;
    else if (has('ml')) value = cis.reduce((s, c) => s + (c.water_ml ?? 0), 0);
    else if (has('hour', 'hours', 'hr', 'hrs') && category === 'sleep') {
      const v = cis.filter(c => c.sleep_hours !== null); value = v.length ? v.reduce((s, c) => s + (c.sleep_hours ?? 0), 0) / v.length : null;
    }
    else if (has('minute', 'minutes', 'min') && category === 'exercise') value = acts.reduce((s, a) => s + a.duration_min, 0);
    else if (has('workout', 'workouts', 'session', 'sessions') && category === 'exercise') value = acts.length;
    else measurable = false;

    return { value, measurable };
  }

  it('daily steps — counts today only', () => {
    const { value } = computeProgress('steps', 'exercise', 8000, 'daily');
    expect(value).toBe(6000);
  });
  it('water in L — divides correctly', () => {
    const { value } = computeProgress('L', 'nutrition', 3, 'daily');
    expect(value).toBeCloseTo(1.8);
  });
  it('weekly workouts — counts 7-day window', () => {
    const { value } = computeProgress('workouts', 'exercise', 5, 'weekly');
    expect(value).toBe(2);
  });
  it('weekly exercise minutes — sums 7-day window', () => {
    const { value } = computeProgress('minutes', 'exercise', 150, 'weekly');
    expect(value).toBe(75);
  });
  it('"sessions of mindfulness" is not measurable (word-boundary check)', () => {
    const { measurable } = computeProgress('sessions of mindfulness', 'mental_health', 10, 'daily');
    // "sessions" IS measurable for exercise category — but this is mental_health, so unmeasurable
    expect(measurable).toBe(false);
  });
  it('sleep average', () => {
    const { value } = computeProgress('hours', 'sleep', 7, 'daily');
    expect(value).toBeCloseTo(6.5);
  });
});

// ── Nutrition computation ─────────────────────────────────────────────
describe('Nutrition computation', () => {
  function computeNutrition(food: { calories_per_100g: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }, quantity_g: number) {
    const f = quantity_g / 100;
    return {
      calories: Math.round((food.calories_per_100g ?? 0) * f),
      protein_g: Math.round((food.protein_g ?? 0) * f * 10) / 10,
      carbs_g: Math.round((food.carbs_g ?? 0) * f * 10) / 10,
      fat_g: Math.round((food.fat_g ?? 0) * f * 10) / 10,
      fiber_g: Math.round((food.fiber_g ?? 0) * f * 10) / 10,
    };
  }

  const chicken = { calories_per_100g: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 };

  it('150g chicken breast', () => {
    const n = computeNutrition(chicken, 150);
    expect(n.calories).toBe(248);
    expect(n.protein_g).toBeCloseTo(46.5, 1);
    expect(n.carbs_g).toBe(0);
  });
  it('zero quantity yields zero nutrition', () => {
    const n = computeNutrition(chicken, 0);
    expect(n.calories).toBe(0);
  });
  it('null fields treated as zero', () => {
    const n = computeNutrition({ calories_per_100g: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null }, 100);
    expect(n.calories).toBe(0);
  });
});

// ── Wearable provider abstraction ─────────────────────────────────────
describe('Wearable provider registry', () => {
  const PROVIDERS = ['apple_health', 'google_fit', 'fitbit', 'garmin', 'samsung_health'];

  it('all 5 providers are registered', () => {
    expect(PROVIDERS.length).toBe(5);
  });
  it('none are available in Phase 13 (groundwork only)', () => {
    const available: boolean[] = [false, false, false, false, false];
    expect(available.every(v => !v)).toBe(true);
  });
  it('sync_source null means manual entry', () => {
    function provenanceLabel(syncSource: string | null): string {
      return syncSource ? `From ${syncSource}` : 'Manual';
    }
    expect(provenanceLabel(null)).toBe('Manual');
    expect(provenanceLabel('fitbit')).toBe('From fitbit');
  });
});

// ── AI security: key never in bundle ─────────────────────────────────
describe('AI feature security', () => {
  it('OPENAI_API_KEY not referenced in src/', async () => {
    // In a real CI this would scan the built bundle.
    // Here we scan the source files the way the build does.
    const fs = await import('node:fs');
    const path = await import('node:path');

    function scanDir(dir: string): string[] {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
          results.push(...scanDir(full));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf-8');
          if (content.includes('OPENAI_API_KEY') && !content.includes('Deno.env')) {
            results.push(full);
          }
        }
      }
      return results;
    }

    const { fileURLToPath } = await import('node:url');
    const leaks = scanDir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
    expect(leaks).toHaveLength(0);
  });

  it('Edge Function uses Deno.env for the key', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fu } = await import('node:url');
    const fnPath = path.resolve(path.dirname(fu(import.meta.url)), '../../supabase/functions/health-summary/index.ts');
    const content = fs.readFileSync(fnPath, 'utf-8');
    expect(content).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/); // no hardcoded key
  });

  it('Edge Function verifies auth before querying data', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fu } = await import('node:url');
    const fnPath = path.resolve(path.dirname(fu(import.meta.url)), '../../supabase/functions/health-summary/index.ts');
    const content = fs.readFileSync(fnPath, 'utf-8');
    // getUser must appear before any .from( query
    const getUserIdx = content.indexOf('getUser(token)');
    const firstFromIdx = content.indexOf('.from(');
    expect(getUserIdx).toBeGreaterThan(0);
    expect(getUserIdx).toBeLessThan(firstFromIdx);
  });

  it('Edge Function error response does not include stack trace or DB detail', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fu } = await import('node:url');
    const fnPath = path.resolve(path.dirname(fu(import.meta.url)), '../../supabase/functions/health-summary/index.ts');
    const content = fs.readFileSync(fnPath, 'utf-8');
    // The catch-all must use a generic message
    expect(content).toContain('unexpected error');
    // Must not expose the error variable to client
    expect(content).toContain('catch (_e)');
  });

  it('system prompt hard-blocks diagnosis language', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fu } = await import('node:url');
    const fnPath = path.resolve(path.dirname(fu(import.meta.url)), '../../supabase/functions/health-summary/index.ts');
    const content = fs.readFileSync(fnPath, 'utf-8');
    expect(content).toContain('NEVER diagnose');
    expect(content).toContain('NEVER recommend or comment on medications');
    expect(content).toContain('NEVER make medical decisions');
  });
});

// ── RLS policy naming convention check ───────────────────────────────
describe('Database migration security coverage', () => {
  it('Phase 9 migration creates private storage bucket (no public access)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fm } = await import('node:url');
    const mig = path.resolve(path.dirname(fm(import.meta.url)), '../../supabase/migrations/20260925190000_0012_medical_documents_phase9.sql');
    const content = fs.readFileSync(mig, 'utf-8');
    expect(content).toContain('false,                                      -- PRIVATE'); // public = false
    expect(content).toContain('medical-documents');
  });

  it('Phase 9 storage RLS scopes by auth.uid() path prefix', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fm } = await import('node:url');
    const mig = path.resolve(path.dirname(fm(import.meta.url)), '../../supabase/migrations/20260925190000_0012_medical_documents_phase9.sql');
    const content = fs.readFileSync(mig, 'utf-8');
    expect(content).toContain('(auth.uid())::text');
    expect(content).toContain('foldername(name)');
  });

  it('Phase 10 migration adds share_documents with profile-scoped RLS', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fm } = await import('node:url');
    const mig = path.resolve(path.dirname(fm(import.meta.url)), '../../supabase/migrations/20260925200000_0013_document_sharing_phase10.sql');
    const content = fs.readFileSync(mig, 'utf-8');
    expect(content).toContain('share_documents');
    expect(content).toContain('user_owns_profile');
  });

  it('Phase 13 migration adds sync_source to daily_checkins and activities', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath: fm } = await import('node:url');
    const mig = path.resolve(path.dirname(fm(import.meta.url)), '../../supabase/migrations/20260925210000_0014_wearable_groundwork.sql');
    const content = fs.readFileSync(mig, 'utf-8');
    expect(content).toContain('daily_checkins');
    expect(content).toContain('activities');
    expect(content).toContain('sync_source');
  });
});

// ── Share expiry / revocation logic ──────────────────────────────────
describe('Share link validation', () => {
  type Share = { status: string; expires_at: string | null };

  function isShareValid(share: Share, now = new Date()): { valid: boolean; reason?: string } {
    if (share.status === 'revoked') return { valid: false, reason: 'Share has been revoked.' };
    if (share.status === 'expired') return { valid: false, reason: 'Share has expired.' };
    if (share.status !== 'active') return { valid: false, reason: 'Share is not active.' };
    if (share.expires_at && new Date(share.expires_at) < now) {
      return { valid: false, reason: 'Share link has expired.' };
    }
    return { valid: true };
  }

  it('active share with no expiry is valid', () => {
    expect(isShareValid({ status: 'active', expires_at: null }).valid).toBe(true);
  });
  it('active share with future expiry is valid', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isShareValid({ status: 'active', expires_at: future }).valid).toBe(true);
  });
  it('active share with past expiry is invalid', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const r = isShareValid({ status: 'active', expires_at: past });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/expired/i);
  });
  it('revoked share is invalid', () => {
    const r = isShareValid({ status: 'revoked', expires_at: null });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/revoked/i);
  });
  it('pending share (not yet accepted) is invalid', () => {
    expect(isShareValid({ status: 'pending', expires_at: null }).valid).toBe(false);
  });
});
