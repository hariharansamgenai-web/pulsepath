/**
 * barcode-lookup — Supabase Edge Function
 * Proxies Open Food Facts API to avoid CORS in the browser.
 *
 * POST /functions/v1/barcode-lookup
 * Body: { barcode: string }
 * Returns: BarcodeResult JSON
 *
 * Deploy:
 *   supabase functions deploy barcode-lookup --no-verify-jwt=false
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { barcode } = await req.json();
    if (!barcode || typeof barcode !== 'string') {
      return new Response(JSON.stringify({ error: 'barcode is required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const clean = barcode.trim().replace(/\D/g, '');
    if (clean.length < 8 || clean.length > 14) {
      return new Response(JSON.stringify({ error: 'Invalid barcode length' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://world.openfoodfacts.org/api/v2/product/${clean}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PHM-HealthApp/1.0 (contact@phm.app)' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Open Food Facts error ${res.status}` }), {
        status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return new Response(JSON.stringify({ error: `Barcode ${clean} not found in Open Food Facts database.` }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const p = data.product;
    const n = p.nutriments ?? {};

    const result = {
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

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
