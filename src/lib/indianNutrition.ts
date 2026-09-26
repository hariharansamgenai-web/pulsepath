/**
 * Indian Dietary Reference Values (ICMR-NIN 2020)
 * Source: Nutrient Requirements for Indians, ICMR-NIN 2020
 *
 * Targets are for an average Indian adult (sedentary–moderate activity).
 * T2D values are the ADA/IDF-India adjusted ranges used by this app.
 */

export type DietType = 'veg' | 'nonveg';

export interface IndianDailyTargets {
  calories:   number;   // kcal
  protein_g:  number;
  carbs_g:    number;
  fat_g:      number;
  fiber_g:    number;
  sodium_mg:  number;
  sugar_g:    number;
  /** Indian-specific: oil usage in teaspoons */
  oil_tsp:    number;
  /** Indian-specific: salt in grams */
  salt_g:     number;
}

/** Base targets (ICMR-NIN 2020, adult sedentary, T2D-adjusted) */
const BASE: IndianDailyTargets = {
  calories:  1800,  // ICMR recommends 1900 kcal for women, 2320 for men — 1800 is T2D conservative
  protein_g:  60,   // 0.8–1 g/kg for 60–75 kg adult
  carbs_g:   220,   // 45–55% of calories, lower end for T2D
  fat_g:      55,   // 25–30% of calories
  fiber_g:    40,   // ICMR: 40 g/day (higher than Western 25 g)
  sodium_mg: 1500,  // AHA low-sodium; WHO: <2000 mg
  sugar_g:    25,   // WHO free sugars <10% of energy, T2D: stricter
  oil_tsp:     4,   // ICMR: 4–5 tsp/day (20–25 ml)
  salt_g:      4,   // ~1600 mg sodium; ICMR: 5 g/day — T2D-adjusted lower
};

/** Veg targets: slightly higher protein to compensate for no meat */
const VEG_ADJUST: Partial<IndianDailyTargets> = {
  protein_g: 65,
  fiber_g:   42,
};

/** Non-veg targets: slightly more protein */
const NONVEG_ADJUST: Partial<IndianDailyTargets> = {
  protein_g: 70,
};

export function getIndianTargets(dietType: DietType): IndianDailyTargets {
  const adj = dietType === 'veg' ? VEG_ADJUST : NONVEG_ADJUST;
  return { ...BASE, ...adj };
}

/** Common Indian foods with per-100g nutritional values (IFCT 2017 / NIN) */
export const INDIAN_FOOD_DB: Array<{
  name: string; category: string; calories_per_100g: number;
  protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  serving_g: number; veg: boolean;
}> = [
  // Cereals & grains
  { name: 'White rice (cooked)',   category: 'cereals', calories_per_100g: 130, protein_g: 2.7, carbs_g: 28,  fat_g: 0.3, fiber_g: 0.4, serving_g: 150, veg: true },
  { name: 'Brown rice (cooked)',   category: 'cereals', calories_per_100g: 122, protein_g: 2.6, carbs_g: 25,  fat_g: 0.9, fiber_g: 1.8, serving_g: 150, veg: true },
  { name: 'Roti (wheat, medium)', category: 'cereals', calories_per_100g: 300, protein_g: 9.7, carbs_g: 62,  fat_g: 1.7, fiber_g: 3.9, serving_g: 40,  veg: true },
  { name: 'Paratha (plain)',      category: 'cereals', calories_per_100g: 360, protein_g: 7.5, carbs_g: 50,  fat_g: 15,  fiber_g: 2.5, serving_g: 80,  veg: true },
  { name: 'Idli (steamed)',       category: 'cereals', calories_per_100g: 132, protein_g: 3.9, carbs_g: 26,  fat_g: 0.5, fiber_g: 0.5, serving_g: 100, veg: true },
  { name: 'Dosa (plain)',         category: 'cereals', calories_per_100g: 170, protein_g: 4.5, carbs_g: 27,  fat_g: 5,   fiber_g: 0.4, serving_g: 100, veg: true },
  { name: 'Poha',                 category: 'cereals', calories_per_100g: 110, protein_g: 2.5, carbs_g: 22,  fat_g: 2.5, fiber_g: 0.8, serving_g: 150, veg: true },
  { name: 'Upma',                 category: 'cereals', calories_per_100g: 150, protein_g: 3.5, carbs_g: 22,  fat_g: 5,   fiber_g: 1.2, serving_g: 150, veg: true },
  // Pulses & dals
  { name: 'Toor dal (cooked)',    category: 'pulses',  calories_per_100g: 115, protein_g: 7,   carbs_g: 18,  fat_g: 0.5, fiber_g: 2.5, serving_g: 150, veg: true },
  { name: 'Moong dal (cooked)',   category: 'pulses',  calories_per_100g: 104, protein_g: 7.5, carbs_g: 16,  fat_g: 0.4, fiber_g: 1.5, serving_g: 150, veg: true },
  { name: 'Rajma (cooked)',       category: 'pulses',  calories_per_100g: 127, protein_g: 8.7, carbs_g: 22,  fat_g: 0.5, fiber_g: 6.4, serving_g: 150, veg: true },
  { name: 'Chana dal (cooked)',   category: 'pulses',  calories_per_100g: 164, protein_g: 9,   carbs_g: 27,  fat_g: 2.7, fiber_g: 5,   serving_g: 150, veg: true },
  { name: 'Chickpeas (cooked)',   category: 'pulses',  calories_per_100g: 164, protein_g: 8.9, carbs_g: 27,  fat_g: 2.6, fiber_g: 7.6, serving_g: 150, veg: true },
  // Vegetables
  { name: 'Spinach (palak, cooked)', category: 'veg', calories_per_100g: 23,  protein_g: 2.9, carbs_g: 3.7, fat_g: 0.4, fiber_g: 2.4, serving_g: 100, veg: true },
  { name: 'Tomato',               category: 'veg',     calories_per_100g: 18,  protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, serving_g: 100, veg: true },
  { name: 'Onion',                category: 'veg',     calories_per_100g: 40,  protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, serving_g: 50,  veg: true },
  { name: 'Potato (boiled)',      category: 'veg',     calories_per_100g: 87,  protein_g: 1.9, carbs_g: 20,  fat_g: 0.1, fiber_g: 1.8, serving_g: 100, veg: true },
  { name: 'Brinjal (baingan)',    category: 'veg',     calories_per_100g: 24,  protein_g: 1,   carbs_g: 5.7, fat_g: 0.2, fiber_g: 3,   serving_g: 100, veg: true },
  { name: 'Bitter gourd (karela)',category: 'veg',     calories_per_100g: 20,  protein_g: 1,   carbs_g: 4.3, fat_g: 0.2, fiber_g: 2.6, serving_g: 100, veg: true },
  // Dairy
  { name: 'Cow milk (toned)',     category: 'dairy',   calories_per_100g: 58,  protein_g: 3.2, carbs_g: 4.9, fat_g: 3,   fiber_g: 0,   serving_g: 200, veg: true },
  { name: 'Curd (dahi)',          category: 'dairy',   calories_per_100g: 60,  protein_g: 3.1, carbs_g: 4.9, fat_g: 3.2, fiber_g: 0,   serving_g: 150, veg: true },
  { name: 'Paneer (cottage ch.)', category: 'dairy',   calories_per_100g: 265, protein_g: 18,  carbs_g: 3.4, fat_g: 20,  fiber_g: 0,   serving_g: 80,  veg: true },
  // Non-veg
  { name: 'Chicken curry',        category: 'nonveg',  calories_per_100g: 165, protein_g: 25,  carbs_g: 3,   fat_g: 6,   fiber_g: 0,   serving_g: 150, veg: false },
  { name: 'Boiled egg',           category: 'nonveg',  calories_per_100g: 155, protein_g: 13,  carbs_g: 1.1, fat_g: 11,  fiber_g: 0,   serving_g: 50,  veg: false },
  { name: 'Fish curry (pomfret)', category: 'nonveg',  calories_per_100g: 150, protein_g: 22,  carbs_g: 3,   fat_g: 5.5, fiber_g: 0,   serving_g: 150, veg: false },
  { name: 'Mutton curry',         category: 'nonveg',  calories_per_100g: 243, protein_g: 26,  carbs_g: 0,   fat_g: 15,  fiber_g: 0,   serving_g: 150, veg: false },
  // Snacks & sweets
  { name: 'Samosa (veg, fried)',  category: 'snacks',  calories_per_100g: 308, protein_g: 5.6, carbs_g: 31,  fat_g: 19,  fiber_g: 2.5, serving_g: 80,  veg: true },
  { name: 'Masala chai (with milk)', category: 'bev',  calories_per_100g: 30,  protein_g: 1.4, carbs_g: 3,   fat_g: 1.2, fiber_g: 0,   serving_g: 150, veg: true },
];

export const SALT_LEVELS = [
  { value: 'none',   label: 'No added salt',  salt_g: 0,    tip: 'Best for T2D with hypertension' },
  { value: 'low',    label: 'Low salt',        salt_g: 1,    tip: 'Recommended for T2D' },
  { value: 'medium', label: 'Normal salt',     salt_g: 2.5,  tip: 'Average Indian household' },
  { value: 'high',   label: 'High salt',       salt_g: 4.5,  tip: 'Above ICMR daily limit' },
] as const;

export const OIL_LEVELS = [
  { value: 'none',   label: 'No added oil',   oil_tsp: 0,   tip: 'Steamed / boiled only' },
  { value: 'low',    label: 'Low oil (1 tsp)', oil_tsp: 1,   tip: 'Ideal for T2D weight management' },
  { value: 'medium', label: 'Medium (3 tsp)',  oil_tsp: 3,   tip: 'ICMR recommended range' },
  { value: 'high',   label: 'High (5+ tsp)',   oil_tsp: 5,   tip: 'Above ICMR recommendation' },
] as const;

export type SaltLevel = typeof SALT_LEVELS[number]['value'];
export type OilLevel  = typeof OIL_LEVELS[number]['value'];
