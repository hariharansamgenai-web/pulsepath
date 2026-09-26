import { useRef, useState } from 'react';
import {
  AlertCircle, Barcode, Beef, Camera, Check, ChevronDown, ChevronUp,
  Leaf, Loader2, Plus, Sparkles, Type, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  analyseFoodImage, analyseFoodText, lookupBarcode,
  type BarcodeResult, type GeminiFoodItem, type GeminiFoodResult,
} from '@/lib/geminiNutrition';
import { SALT_LEVELS, OIL_LEVELS, type SaltLevel, type OilLevel } from '@/lib/indianNutrition';

// 'text'   — describe food by typing
// 'camera' — unified camera: auto-detects barcode OR food photo
type Mode = 'text' | 'camera';

// What the camera detected from the image
type CameraDetection = 'none' | 'detecting' | 'barcode' | 'food';

interface Props {
  onUse: (result: GeminiFoodResult, portionG: number, saltLevel: SaltLevel, oilLevel: OilLevel, itemIndex?: number) => void;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', outline: 'none', width: '100%',
};

export function AIFoodAnalyser({ onUse }: Props) {
  const [mode, setMode]           = useState<Mode>('text');
  const [isVeg, setIsVeg]         = useState(true);
  const [textInput, setTextInput] = useState('');
  const [saltLevel, setSaltLevel] = useState<SaltLevel>('low');
  const [oilLevel, setOilLevel]   = useState<OilLevel>('low');

  // Unified camera state
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [detection, setDetection]         = useState<CameraDetection>('none');
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Results
  const [result, setResult]               = useState<GeminiFoodResult | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(null);
  const [barcodePortion, setBarcodePortion] = useState(100);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expanded, setExpanded]           = useState(true);
  const [addedIdx, setAddedIdx]           = useState<number | null>(null);

  // ── Unified camera handler ──────────────────────────────────────────
  async function handleCameraFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // Reset everything
    setImageFile(f);
    setResult(null);
    setBarcodeResult(null);
    setError(null);
    setAddedIdx(null);
    setDetectedBarcode(null);
    setDetection('detecting');

    const url = URL.createObjectURL(f);
    setImagePreview(url);

    // Step 1: try to detect a barcode in the image
    const barcode = await scanBarcodeFromImage(f);

    if (barcode) {
      // Barcode found → pre-fill manual field so user can verify/correct digits
      setDetectedBarcode(barcode);
      setManualBarcode(barcode);
      setDetection('barcode');
    } else {
      // No barcode → treat as food photo
      setDetection('food');
    }
  }

  // ── Analyse button ──────────────────────────────────────────────────
  async function handleAnalyse() {
    setLoading(true); setError(null); setResult(null); setBarcodeResult(null); setAddedIdx(null);
    try {
      if (mode === 'camera') {
        // Barcode path — from camera detection OR manual entry
        if (detection === 'barcode' && detectedBarcode) {
          const br = await lookupBarcode(detectedBarcode);
          setBarcodeResult(br);
        } else {
          // Food photo path
          if (!imageFile) { setError('Tap the camera button to take a food photo first.'); setLoading(false); return; }
          const b64 = await fileToBase64(imageFile);
          const mime = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const res = await analyseFoodImage(b64, mime, isVeg, saltLevel, oilLevel);
          setResult(res);
        }
      } else {
        // Text path
        if (!textInput.trim()) { setError('Enter a food name or description.'); setLoading(false); return; }
        const res = await analyseFoodText(textInput, isVeg, saltLevel, oilLevel);
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleAddItem(itemIndex: number, portionG: number) {
    if (!result) return;
    onUse(result, portionG, saltLevel, oilLevel, itemIndex);
    setAddedIdx(itemIndex);
    setTimeout(() => setAddedIdx(null), 2000);
  }

  function handleAddBarcode() {
    if (!barcodeResult) return;
    const synthetic: GeminiFoodResult = {
      items: [{
        dish: barcodeResult.food_name,
        serving_unit: 'g',
        estimated_qty: barcodePortion,
        weight_g: barcodePortion,
        calories: Math.round(barcodeResult.calories_per_100g * barcodePortion / 100),
        protein_g: barcodeResult.protein_g * barcodePortion / 100,
        carbs_g: barcodeResult.carbs_g * barcodePortion / 100,
        fat_g: barcodeResult.fat_g * barcodePortion / 100,
        fiber_g: barcodeResult.fiber_g * barcodePortion / 100,
        sodium_mg: barcodeResult.sodium_mg_per_100g * barcodePortion / 100,
        is_veg: barcodeResult.is_veg ?? isVeg,
        indian_context: `Packaged food — ${barcodeResult.brand}`,
        confidence: 'high',
      }],
      food_name: barcodeResult.food_name,
      description: barcodeResult.brand,
      estimated_portion_g: barcodePortion,
      calories_per_100g: barcodeResult.calories_per_100g,
      protein_g: barcodeResult.protein_g,
      carbs_g: barcodeResult.carbs_g,
      fat_g: barcodeResult.fat_g,
      fiber_g: barcodeResult.fiber_g,
      sodium_mg_per_100g: barcodeResult.sodium_mg_per_100g,
      is_veg: barcodeResult.is_veg ?? isVeg,
      indian_context: 'Packaged product',
      confidence: 'high',
    };
    onUse(synthetic, barcodePortion, saltLevel, oilLevel, 0);
    setAddedIdx(0);
    setTimeout(() => setAddedIdx(null), 2000);
  }

  const salt = SALT_LEVELS.find(s => s.value === saltLevel)!;
  const oil  = OIL_LEVELS.find(o => o.value === oilLevel)!;

  const analyseLabel = () => {
    if (loading) return 'Analysing…';
    if (mode === 'camera' && detection === 'barcode') return 'Look up barcode';
    if (mode === 'camera' && detection === 'food')    return 'Identify food & nutrition';
    if (mode === 'camera') return 'Take photo first';
    return 'Analyse nutrition';
  };

  return (
    <div className="rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>

      {/* ── Header ── */}
      <button onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: '#c084fc' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            AI Food Analyser
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(192,132,252,.15)', color: '#c084fc' }}>Gemini</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,.12)', color: '#34d399' }}>ICMR-NIN</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(251,191,36,.12)', color: '#fbbf24' }}>Open Food Facts</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />}
      </button>

      {expanded && (
        <div className="border-t px-5 pb-5 space-y-4" style={{ borderColor: 'var(--border)' }}>

          {/* ── Veg / Non-veg ── */}
          <div className="flex gap-2 pt-4">
            <button onClick={() => setIsVeg(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold flex-1 justify-center transition-all"
              style={{ background: isVeg ? '#dcfce7' : 'var(--bg-card-2,var(--bg-card))', color: isVeg ? '#166534' : 'var(--text-muted)', border: `1px solid ${isVeg ? '#86efac' : 'var(--border)'}` }}>
              <Leaf className="h-4 w-4" /> Vegetarian
            </button>
            <button onClick={() => setIsVeg(false)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold flex-1 justify-center transition-all"
              style={{ background: !isVeg ? '#fee2e2' : 'var(--bg-card-2,var(--bg-card))', color: !isVeg ? '#991b1b' : 'var(--text-muted)', border: `1px solid ${!isVeg ? '#fca5a5' : 'var(--border)'}` }}>
              <Beef className="h-4 w-4" /> Non-Vegetarian
            </button>
          </div>

          {/* ── Mode tabs ── */}
          <div className="flex gap-2">
            {([
              { id: 'text',   icon: Type,   label: 'Describe food' },
              { id: 'camera', icon: Camera, label: 'Camera (food + barcode)' },
            ] as const).map(m => (
              <button key={m.id}
                onClick={() => { setMode(m.id); setResult(null); setBarcodeResult(null); setError(null); setDetection('none'); setImageFile(null); setImagePreview(null); setDetectedBarcode(null); setManualBarcode(''); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                style={{ background: mode === m.id ? 'var(--accent-bg)' : 'transparent', color: mode === m.id ? 'var(--accent)' : 'var(--text-muted)', border: `1px solid ${mode === m.id ? 'var(--accent-border)' : 'var(--border)'}` }}>
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Text input ── */}
          {mode === 'text' && (
            <input type="text" style={inputStyle} value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="e.g. 2 rotis with dal tadka and rice, or masala dosa"
              onKeyDown={e => e.key === 'Enter' && handleAnalyse()} />
          )}

          {/* ── Unified Camera ── */}
          {mode === 'camera' && (
            <div className="space-y-3">
              {/* Hidden file input */}
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handleCameraFile} />

              {/* Camera button */}
              <button
                onClick={() => { setDetection('none'); setImagePreview(null); setImageFile(null); setDetectedBarcode(null); fileRef.current?.click(); }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 transition-all"
                style={{
                  borderColor: detection === 'barcode' ? '#34d399' : detection === 'food' ? '#c084fc' : 'var(--accent-border)',
                  background:  detection === 'barcode' ? 'rgba(52,211,153,.06)' : detection === 'food' ? 'rgba(192,132,252,.06)' : 'var(--accent-bg)',
                  color:       detection === 'barcode' ? '#34d399' : detection === 'food' ? '#c084fc' : 'var(--accent)',
                }}>
                <Camera className="h-8 w-8" />
                <span className="text-sm font-bold">
                  {detection === 'detecting' ? 'Scanning image…'
                   : detection === 'barcode'  ? '📦 Barcode detected — tap to retake'
                   : detection === 'food'     ? '🍛 Food photo ready — tap to retake'
                   : 'Tap to take photo'}
                </span>
                <span className="text-xs font-medium" style={{ color: 'inherit', opacity: .7 }}>
                  {detection === 'none'
                    ? 'Works for food dishes AND product barcodes — auto-detected'
                    : detection === 'detecting' ? 'Checking for barcode…'
                    : detection === 'barcode' ? 'Barcode scanned — verify digits below'  
                    : 'Gemini AI will identify all items on the plate'}
                </span>
              </button>

              {/* Image preview */}
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview"
                    className="w-full max-h-52 rounded-xl object-cover" />
                  {/* Detection badge overlay */}
                  {detection !== 'none' && detection !== 'detecting' && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: detection === 'barcode' ? '#34d39922' : '#c084fc22',
                        color:      detection === 'barcode' ? '#34d399'   : '#c084fc',
                        border:     `1px solid ${detection === 'barcode' ? '#34d39944' : '#c084fc44'}`,
                        backdropFilter: 'blur(8px)',
                      }}>
                      {detection === 'barcode'
                        ? <><Barcode className="h-3 w-3" />Barcode — Open Food Facts</>
                        : <><Sparkles className="h-3 w-3" />Food photo — Gemini AI</>}
                    </div>
                  )}
                  {detection === 'detecting' && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                      style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
                      <div className="flex flex-col items-center gap-2 text-white">
                        <Loader2 className="h-7 w-7 animate-spin" />
                        <span className="text-sm font-semibold">Detecting barcode…</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* How it works note */}
              {detection === 'none' && (
                <div className="rounded-xl px-4 py-3 space-y-1.5"
                  style={{ background: 'var(--bg-card-2,var(--bg-card))', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    How it works
                  </p>
                  <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Barcode className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#34d399' }} />
                    <span><strong>Packaged food</strong> — point at the barcode on the back of the packet. Fetches full nutrition label from Open Food Facts (3M+ products).</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#c084fc' }} />
                    <span><strong>Home-cooked / restaurant food</strong> — photograph the plate. Gemini AI identifies every item and gives ICMR-NIN nutrition values per dish.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
                    <span><strong>Auto-detects</strong> — the app reads the image and automatically chooses the right path. No need to switch modes.</span>
                  </div>
                </div>
              )}

              {/* ── Manual barcode entry ── */}
              <div className="space-y-2">
                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    or enter barcode manually
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* Detected badge — shows when barcode came from camera scan */}
                {detection === 'barcode' && imageFile && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold mb-1"
                    style={{ color: '#34d399' }}>
                    <Barcode className="h-3.5 w-3.5" />
                    Camera read: {detectedBarcode} — edit below if digits look wrong
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={manualBarcode}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      setManualBarcode(v);
                      if (v.length >= 8) {
                        setDetectedBarcode(v);
                        setDetection('barcode');
                      } else {
                        setDetection(imageFile ? 'food' : 'none');
                        setDetectedBarcode(null);
                      }
                    }}
                    placeholder="e.g. 8901030925763"
                    maxLength={14}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 14,
                      border: `1px solid ${manualBarcode.length >= 8 ? 'var(--accent)' : 'var(--border)'}`,
                      background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none',
                    }}
                    onKeyDown={e => e.key === 'Enter' && manualBarcode.length >= 8 && handleAnalyse()}
                  />
                  {manualBarcode.length >= 8 && (
                    <button
                      onClick={handleAnalyse}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold shrink-0 transition-all"
                      style={{ background: 'var(--accent)', color: '#fff', border: 'none', opacity: loading ? .6 : 1 }}
                    >
                      <Barcode className="h-3.5 w-3.5" />
                      Look up
                    </button>
                  )}
                </div>

                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Indian barcodes start with 890 · Covers Amul, Britannia, Parle, Haldiram's, Tata & 3M+ products
                </p>
              </div>
            </div>
          )}

          {/* ── Salt & Oil (only for non-barcode paths) ── */}
          {!(mode === 'camera' && detection === 'barcode') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>🧂 Salt level</p>
                <div className="space-y-1">
                  {SALT_LEVELS.map(sl => (
                    <button key={sl.value} onClick={() => setSaltLevel(sl.value as SaltLevel)}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-all"
                      style={{ background: saltLevel === sl.value ? 'var(--accent-bg)' : 'transparent', color: saltLevel === sl.value ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${saltLevel === sl.value ? 'var(--accent-border)' : 'transparent'}` }}>
                      <span className="font-semibold whitespace-nowrap">{sl.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{sl.tip}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>🫙 Oil level</p>
                <div className="space-y-1">
                  {OIL_LEVELS.map(ol => (
                    <button key={ol.value} onClick={() => setOilLevel(ol.value as OilLevel)}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-all"
                      style={{ background: oilLevel === ol.value ? 'var(--accent-bg)' : 'transparent', color: oilLevel === ol.value ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${oilLevel === ol.value ? 'var(--accent-border)' : 'transparent'}` }}>
                      <span className="font-semibold whitespace-nowrap">{ol.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{ol.tip}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Analyse button ── */}
          <Button onClick={handleAnalyse} loading={loading} className="w-full"
            disabled={loading || (mode === 'camera' && detection === 'none' && manualBarcode.length < 8)}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />{detection === 'barcode' ? 'Looking up barcode…' : 'Identifying food with Gemini…'}</>
              : <><Sparkles className="h-4 w-4" />{analyseLabel()}</>}
          </Button>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          {/* ── Barcode result ── */}
          {barcodeResult && (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.2)' }}>
              <div className="flex gap-3 items-start">
                {barcodeResult.image_url && (
                  <img src={barcodeResult.image_url} alt={barcodeResult.food_name}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                    onError={e => (e.currentTarget.style.display='none')} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Barcode className="h-3.5 w-3.5 shrink-0" style={{ color: '#34d399' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>Open Food Facts</span>
                  </div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{barcodeResult.food_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{barcodeResult.brand}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {barcodeResult.is_veg !== null && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: barcodeResult.is_veg ? '#dcfce7' : '#fee2e2', color: barcodeResult.is_veg ? '#166534' : '#991b1b' }}>
                        {barcodeResult.is_veg ? '🟢 Veg' : '🔴 Non-veg'}
                      </span>
                    )}
                    {barcodeResult.nutriscore && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--warn-bg)', color: 'var(--warn-text)' }}>
                        Nutri-Score {barcodeResult.nutriscore}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums shrink-0" style={{ color: '#34d399' }}>
                  {Math.round(barcodeResult.calories_per_100g * barcodePortion / 100)}
                  <span className="text-xs font-normal ml-0.5">kcal</span>
                </p>
              </div>
              <MacroGrid protein={barcodeResult.protein_g * barcodePortion / 100} carbs={barcodeResult.carbs_g * barcodePortion / 100} fat={barcodeResult.fat_g * barcodePortion / 100} fiber={barcodeResult.fiber_g * barcodePortion / 100} />
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-secondary)' }}>Portion (g)</label>
                <input type="number" min={1} max={2000} value={barcodePortion}
                  onChange={e => setBarcodePortion(Number(e.target.value))}
                  style={{ ...inputStyle, width: 80 }} />
                <Button size="sm" onClick={handleAddBarcode}
                  style={addedIdx === 0 ? { background: 'var(--good-bg)', color: 'var(--good-text)' } : {}}>
                  {addedIdx === 0 ? <><Check className="h-3.5 w-3.5" />Added!</> : <><Plus className="h-3.5 w-3.5" />Add to meal</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── Gemini multi-dish results ── */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {result.items.length > 1 ? `${result.items.length} items identified` : result.food_name}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(192,132,252,.15)', color: '#c084fc' }}>
                    <Sparkles className="h-2.5 w-2.5" />Gemini AI
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: result.is_veg ? '#dcfce7' : '#fee2e2', color: result.is_veg ? '#166534' : '#991b1b' }}>
                    {result.is_veg ? '🟢 Veg' : '🔴 Non-veg'}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {result.confidence} confidence
                  </span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                🧂 {salt.label} · 🫙 {oil.label} · {result.indian_context}
              </p>
              {result.items.map((item, idx) => (
                <DishCard key={idx} item={item} isAdded={addedIdx === idx} onAdd={(p) => handleAddItem(idx, p)} />
              ))}
              {result.items.length > 1 && (
                <div className="rounded-lg p-3" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Total — all items</p>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      { label: 'Calories', val: result.items.reduce((s,i)=>s+i.calories,0).toFixed(0), unit: 'kcal', color: 'var(--accent)' },
                      { label: 'Protein',  val: result.items.reduce((s,i)=>s+i.protein_g,0).toFixed(1), unit: 'g', color: '#34d399' },
                      { label: 'Carbs',    val: result.items.reduce((s,i)=>s+i.carbs_g,0).toFixed(1), unit: 'g', color: '#fbbf24' },
                      { label: 'Fat',      val: result.items.reduce((s,i)=>s+i.fat_g,0).toFixed(1), unit: 'g', color: '#f87171' },
                      { label: 'Fiber',    val: result.items.reduce((s,i)=>s+i.fiber_g,0).toFixed(1), unit: 'g', color: '#a78bfa' },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>{m.val}</p>
                        <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{m.label}<br/>{m.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function DishCard({ item, isAdded, onAdd }: { item: GeminiFoodItem; isAdded: boolean; onAdd: (p: number) => void }) {
  const [portion, setPortion] = useState(item.weight_g);
  const scale = portion / (item.weight_g || 1);
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-card-2,var(--bg-card))', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.dish}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.estimated_qty} {item.serving_unit} · {item.weight_g}g · {item.indian_context}</p>
        </div>
        <p className="text-xl font-bold tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
          {Math.round(item.calories * scale)}<span className="text-xs font-normal ml-0.5">kcal</span>
        </p>
      </div>
      <MacroGrid protein={item.protein_g * scale} carbs={item.carbs_g * scale} fat={item.fat_g * scale} fiber={item.fiber_g * scale} />
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-secondary)' }}>g</label>
        <input type="number" min={1} max={2000} value={portion}
          onChange={e => setPortion(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, fontSize: 13, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', width: 72 }} />
        <Button size="sm" onClick={() => onAdd(portion)} style={isAdded ? { background: 'var(--good-bg)', color: 'var(--good-text)' } : {}}>
          {isAdded ? <><Check className="h-3.5 w-3.5" />Added!</> : <><Plus className="h-3.5 w-3.5" />Add to meal</>}
        </Button>
      </div>
    </div>
  );
}

function MacroGrid({ protein, carbs, fat, fiber }: { protein: number; carbs: number; fat: number; fiber: number }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[{ label: 'Protein', val: protein, color: '#34d399' }, { label: 'Carbs', val: carbs, color: '#fbbf24' }, { label: 'Fat', val: fat, color: '#f87171' }, { label: 'Fiber', val: fiber, color: '#a78bfa' }].map(m => (
        <div key={m.label} className="rounded-lg py-1.5 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold tabular-nums" style={{ color: m.color }}>{m.val.toFixed(1)}g</p>
          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Barcode detection using ZXing-js (@zxing/library).
 *
 * ZXing reads EAN-13, EAN-8, Code-128, UPC-A, UPC-E, QR and more
 * from a static image file — no live camera stream needed.
 * Works in all browsers (Chrome, Safari, Firefox, Samsung Internet).
 *
 * Fallback chain:
 *  1. ZXing BrowserMultiFormatReader — most reliable for EAN-13
 *  2. Native BarcodeDetector API    — fast path on Chrome Android
 *  3. Gemini Vision                  — last resort if both above fail
 */
async function scanBarcodeFromImage(file: File): Promise<string | null> {
  // ── Layer 1: ZXing (primary — EAN-13, EAN-8, Code-128, QR, all formats) ──
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/library');
    const reader = new BrowserMultiFormatReader();
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
    const result = await reader.decodeFromImageElement(img);
    URL.revokeObjectURL(objectUrl);
    const digits = result.getText().replace(/\D/g, '');
    if (digits.length >= 8) return digits;
  } catch { /* barcode not found or ZXing error — try next layer */ }

  // ── Layer 2: native BarcodeDetector (Chrome Android 83+, fast) ────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (window as any).BarcodeDetector;
    if (BD) {
      const bitmap = await createImageBitmap(file);
      const codes: Array<{rawValue: string}> = await new BD({
        formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'],
      }).detect(bitmap);
      if (codes.length > 0) {
        const digits = codes[0].rawValue.replace(/\D/g, '');
        if (digits.length >= 8) return digits;
      }
    }
  } catch { /* not available in this browser */ }

  // ── Layer 3: Gemini Vision (last resort — reads printed digits under bars) ─
  try {
    const b64 = await fileToBase64(file);
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        model: 'gemini-1.5-flash',
        body: {
          contents: [{
            parts: [
              {
                text: `Read the barcode number printed in digits below the barcode bars in this image.
Read each digit one at a time left to right. EAN-13 = exactly 13 digits. EAN-8 = 8 digits.
Return ONLY the digits as a plain number — no spaces, no dashes, no explanation.
If you cannot clearly read all digits, return: NONE`,
              },
              { inline_data: { mime_type: mime, data: b64 } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 32 },
        },
      },
    });
    if (!error && data) {
      const raw = data as {candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>};
      const text: string = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const digits = text.trim().replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 14) return digits;
    }
  } catch { /* Gemini unavailable */ }

  return null;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = () => rej(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}
