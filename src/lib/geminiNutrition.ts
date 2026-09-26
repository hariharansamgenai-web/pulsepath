/**
 * Gemini 1.5 Flash — Indian food vision + text nutrition analyser
 *
 * Calls are routed through the Supabase Edge Function `gemini-proxy`
 * to avoid CORS issues in the browser. The Gemini API key lives in
 * Supabase secrets (GEMINI_API_KEY), never in the frontend bundle.
 *
 * Architecture (PDF spec):
 *   - Gemini 1.5 Flash for multi-dish thali recognition
 *   - Open Food Facts REST for packaged Indian barcodes (free)
 *   - ICMR-NIN / IFCT 2017 nutritional values in the prompt
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeminiFoodItem {
  dish: string;
  serving_unit: 'katori' | 'roti' | 'tbsp' | 'piece' | 'glass' | 'plate' | 'g';
  estimated_qty: number;
  weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  is_veg: boolean;
  indian_context: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface GeminiFoodResult {
  items: GeminiFoodItem[];
  food_name: string;
  description: string;
  estimated_portion_g: number;
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg_per_100g: number;
  is_veg: boolean;
  indian_context: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BarcodeResult {
  food_name: string;
  brand: string;
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg_per_100g: number;
  serving_size_g: number;
  image_url: string | null;
  is_veg: boolean | null;
  nutriscore: string | null;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const THALI_PROMPT = `You are an expert Indian nutritionist trained on ICMR-NIN 2020 and IFCT 2017 data.
Analyse the food photo or description. Identify ALL items (e.g. roti, dal, sabzi, curd, rice, pickle).
Return ONLY a valid JSON array with NO markdown fences, no explanation:

[
  {
    "dish": "specific Indian food name",
    "serving_unit": "katori|roti|tbsp|piece|glass|plate|g",
    "estimated_qty": number,
    "weight_g": number,
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "sodium_mg": number,
    "is_veg": boolean,
    "indian_context": "e.g. South Indian breakfast staple",
    "confidence": "high|medium|low"
  }
]

Rules:
- All macro values are for the ESTIMATED PORTION (not per 100g).
- Standard sizes: 1 katori≈150g, 1 medium roti≈40g, 1 tbsp≈15g.
- Use ICMR-NIN/IFCT 2017 values. Adjust fat_g for visible oil/ghee.
- Return single-element array for one food item.
- Set confidence "low" if uncertain.`;

// ---------------------------------------------------------------------------
// Core proxy caller
// ---------------------------------------------------------------------------

async function callGeminiProxy(model: string, body: object): Promise<object> {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { model, body },
  });
  if (error) throw new Error(error.message ?? 'Gemini proxy error');
  if ((data as Record<string,unknown>)?.error) throw new Error(String((data as Record<string,unknown>).error));
  return data as object;
}

async function callGeminiAndNormalize(model: string, body: object): Promise<GeminiFoodResult> {
  const data = await callGeminiProxy(model, body) as Record<string, unknown>;
  const raw: string = (data?.candidates as Array<{content:{parts:Array<{text:string}>}}>)?.[0]?.content?.parts?.[0]?.text ?? '';
  const clean = raw.replace(/```json|```/g, '').trim();

  let items: GeminiFoodItem[];
  try {
    const parsed = JSON.parse(clean);
    items = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new Error('Could not parse Gemini response. Try a clearer photo or description.');
  }

  if (!items.length) throw new Error('Gemini returned no food items.');

  const primary = items[0];
  const totalWeight = items.reduce((s, i) => s + (i.weight_g || 0), 0) || primary.weight_g;

  return {
    items,
    food_name:           items.length > 1 ? `Thali (${items.length} items)` : primary.dish,
    description:         items.map(i => i.dish).join(', '),
    estimated_portion_g: totalWeight,
    calories_per_100g:   primary.weight_g ? Math.round((primary.calories / primary.weight_g) * 100) : 0,
    protein_g:           primary.weight_g ? (primary.protein_g / primary.weight_g) * 100 : 0,
    carbs_g:             primary.weight_g ? (primary.carbs_g   / primary.weight_g) * 100 : 0,
    fat_g:               primary.weight_g ? (primary.fat_g     / primary.weight_g) * 100 : 0,
    fiber_g:             primary.weight_g ? (primary.fiber_g   / primary.weight_g) * 100 : 0,
    sodium_mg_per_100g:  primary.weight_g ? (primary.sodium_mg / primary.weight_g) * 100 : 0,
    is_veg:              items.every(i => i.is_veg),
    indian_context:      primary.indian_context,
    confidence:          primary.confidence,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyseFoodImage(
  base64Image: string,
  mimeType: 'image/jpeg' | 'image/png',
  isVeg: boolean,
  saltLevel: string,
  oilLevel: string,
): Promise<GeminiFoodResult> {
  const body = {
    contents: [{
      parts: [
        { text: `${THALI_PROMPT}\n\nDiet: ${isVeg ? 'Vegetarian' : 'Non-vegetarian'}. Salt: ${saltLevel}. Oil: ${oilLevel}.` },
        { inline_data: { mime_type: mimeType, data: base64Image } },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };
  return callGeminiAndNormalize('gemini-1.5-flash', body);
}

export async function analyseFoodText(
  description: string,
  isVeg: boolean,
  saltLevel: string,
  oilLevel: string,
): Promise<GeminiFoodResult> {
  const prompt = `${THALI_PROMPT}\n\nFood: "${description}"\nDiet: ${isVeg ? 'Vegetarian' : 'Non-vegetarian'}. Salt: ${saltLevel}. Oil: ${oilLevel}.`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };
  return callGeminiAndNormalize('gemini-1.5-flash', body);
}

// ---------------------------------------------------------------------------
// Open Food Facts — barcode (runs client-side fine, different domain)
// ---------------------------------------------------------------------------

export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const clean = barcode.replace(/\D/g, '');

  // ── Primary: Supabase Edge Function (production — avoids CORS) ─────
  try {
    const { data, error } = await supabase.functions.invoke('barcode-lookup', {
      body: { barcode: clean },
    });
    // Edge Function available and returned data → use it
    if (!error && data && (data as BarcodeResult).food_name) {
      return data as BarcodeResult;
    }
    // Edge Function returned a real "not found" (HTTP 404) — don't fall through
    if (!error && data && (data as Record<string,unknown>).error) {
      throw new Error(String((data as Record<string,unknown>).error));
    }
  } catch (e) {
    // Only fall through if the Edge Function is simply not deployed/reachable
    const msg = e instanceof Error ? e.message : '';
    const isDeployError = msg.includes('not available') || msg.includes('Failed to fetch') ||
      msg.includes('FunctionsFetchError') || msg.includes('not found in demo');
    if (!isDeployError) throw e; // real error (e.g. barcode not in DB) — propagate
  }

  // ── Fallback: direct Open Food Facts (preview / before Edge deploy) ─
  const url = `https://world.openfoodfacts.org/api/v2/product/${clean}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PulsePath/1.0 (contact@pulsepath.app)' },
  });
  if (!res.ok) throw new Error(`Barcode ${clean} — product not found (HTTP ${res.status}).`);
  const json = await res.json();
  if (json.status !== 1 || !json.product) throw new Error(`Barcode ${clean} not found in Open Food Facts.`);

  const p = json.product;
  const n = p.nutriments ?? {};
  return {
    food_name:          p.product_name || p.product_name_en || 'Unknown product',
    brand:              p.brands ?? '',
    calories_per_100g:  n['energy-kcal_100g'] ?? Math.round((n['energy_100g'] ?? 0) / 4.184),
    protein_g:          n.proteins_100g ?? 0,
    carbs_g:            n.carbohydrates_100g ?? 0,
    fat_g:              n.fat_100g ?? 0,
    fiber_g:            n.fiber_100g ?? 0,
    sodium_mg_per_100g: (n.sodium_100g ?? 0) * 1000,
    serving_size_g:     p.serving_quantity ? Number(p.serving_quantity) : 100,
    image_url:          p.image_front_small_url ?? p.image_url ?? null,
    is_veg:             p.labels?.toLowerCase().includes('veg') ?? null,
    nutriscore:         p.nutriscore_grade?.toUpperCase() ?? null,
  };
}
