// Domain types for the Personal Health Manager.
// These mirror the Supabase database schema established in Phase 2.

// ── Enum-like union types (backed by CHECK constraints) ─────────────

export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type Relationship =
  | 'self'
  | 'spouse'
  | 'mother'
  | 'father'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'other';

export type Mood = 'great' | 'good' | 'okay' | 'low' | 'poor';

export type ActivityType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'strength'
  | 'gym'
  | 'yoga'
  | 'sports'
  | 'custom'
  | 'other';

export type ExerciseIntensity = 'low' | 'moderate' | 'high';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type GoalCategory =
  | 'exercise'
  | 'nutrition'
  | 'sleep'
  | 'weight'
  | 'mental_health'
  | 'other';

export type GoalStatus = 'active' | 'completed' | 'abandoned';

export type DocumentCategory =
  | 'lab_report'
  | 'prescription'
  | 'scan'
  | 'doctor_note'
  | 'discharge_summary'
  | 'other'
  // Legacy values kept for backward compatibility
  | 'lab_results'
  | 'imaging'
  | 'prescriptions'
  | 'visit_notes'
  | 'insurance';

export type AchievementCategory =
  | 'exercise'
  | 'nutrition'
  | 'sleep'
  | 'streak'
  | 'goal'
  | 'other';

export type ShareStatus = 'pending' | 'active' | 'revoked' | 'expired';

export type SharePermission = 'read' | 'write';

export type ShareResourceType = 'all' | 'documents' | 'timeline' | 'check_ins' | 'goals';

export type DeviceType = 'apple_health' | 'google_fit' | 'fitbit' | 'garmin' | 'samsung_health' | 'other';

export type ConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error';

/** Provenance of a health row — null means manually entered by the user. */
export type SyncSource = 'apple_health' | 'google_fit' | 'fitbit' | 'garmin' | 'samsung_health' | 'other' | null;

export type AuditAction =
  | 'document_upload'
  | 'document_download'
  | 'document_delete'
  | 'share_created'
  | 'share_accessed'
  | 'share_revoked'
  | 'share_expired'
  | 'data_export';

// ── Table row types ──────────────────────────────────────────────────

export interface Profile {
  id: string;
  owner_id: string;
  display_name: string;
  relationship: Relationship;
  date_of_birth: string | null;
  sex: Sex | null;
  /** Storage path in the private `avatars` bucket (not a public URL). */
  avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Pick<
  Profile,
  'display_name' | 'relationship' | 'date_of_birth' | 'sex' | 'height_cm' | 'weight_kg'
>;

export type GoalFrequency = 'daily' | 'weekly';

export interface Goal {
  id: string;
  profile_id: string;
  title: string;
  category: GoalCategory;
  target_value: number | null;
  /** Stored by the database; the app never reads or writes this — progress is always computed live. */
  current_value: number | null;
  unit: string | null;
  frequency: GoalFrequency;
  start_date: string;
  status: GoalStatus;
  /** "End date" in the UI. */
  target_date: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: string;
  updated_at: string;
}

export type GoalInput = Pick<
  Goal,
  'title' | 'category' | 'target_value' | 'unit' | 'frequency' | 'start_date' | 'target_date' | 'reminder_enabled' | 'reminder_time'
>;

export interface Activity {
  id: string;
  profile_id: string;
  date: string;
  start_time: string | null;
  activity_type: ActivityType;
  /** The user's own name for the activity; required when activity_type = 'custom'. */
  custom_label: string | null;
  duration_min: number;
  intensity: ExerciseIntensity | null;
  calories_burned: number | null;
  distance_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityInput = Pick<
  Activity,
  'date' | 'start_time' | 'activity_type' | 'custom_label' | 'duration_min' | 'intensity' | 'calories_burned' | 'distance_km' | 'notes'
>;

export interface DailyCheckIn {
  id: string;
  profile_id: string;
  date: string;
  mood: Mood | null;
  energy_level: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  weight_kg: number | null;
  water_ml: number | null;
  meds_taken: boolean | null;
  glucose_fasting: number | null;
  glucose_post_meal: number | null;
  steps: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the daily check-in form writes. */
export type CheckInInput = Pick<
  DailyCheckIn,
  | 'date'
  | 'mood'
  | 'energy_level'
  | 'sleep_hours'
  | 'sleep_quality'
  | 'weight_kg'
  | 'water_ml'
  | 'meds_taken'
  | 'glucose_fasting'
  | 'glucose_post_meal'
  | 'steps'
  | 'notes'
>;

export type AlertSeverity = 'critical' | 'warning';

export interface HealthAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  action: string;
  date: string;
}

export interface Achievement {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  category: AchievementCategory;
  earned_at: string;
  created_at: string;
}

export interface Food {
  id: string;
  profile_id: string;
  name: string;
  calories_per_100g: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  serving_size_g: number | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export type FoodInput = Pick<
  Food,
  'name' | 'calories_per_100g' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'serving_size_g' | 'is_favorite'
>;

export interface Meal {
  id: string;
  profile_id: string;
  date: string;
  meal_type: MealType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodLog {
  id: string;
  meal_id: string;
  food_id: string;
  quantity_g: number;
  created_at: string;
  /** Joined from foods table at query time. */
  food?: Food;
}

export type FoodLogInput = Pick<FoodLog, 'food_id' | 'quantity_g'>;

/** A meal with its food logs joined. */
export interface MealWithLogs extends Meal {
  food_logs: FoodLog[];
}

export interface MedicalDocument {
  id: string;
  profile_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  category: DocumentCategory;
  document_name: string | null;
  document_date: string | null;
  doctor: string | null;
  hospital_clinic: string | null;
  notes: string | null;
  description: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export type MedicalDocumentInput = Pick<
  MedicalDocument,
  'category' | 'document_name' | 'document_date' | 'doctor' | 'hospital_clinic' | 'notes'
>;

export interface MedicalShare {
  id: string;
  profile_id: string;
  shared_with_email: string;
  resource_type: ShareResourceType;
  permissions: SharePermission[];
  share_token: string;
  /** Human-friendly label for the share, e.g. "For Dr. Priya – HbA1c". */
  label: string | null;
  expires_at: string | null;
  status: ShareStatus;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareDocument {
  id: string;
  share_id: string;
  document_id: string;
  created_at: string;
}

/** A share with its associated document IDs joined. */
export interface MedicalShareWithDocuments extends MedicalShare {
  share_documents: ShareDocument[];
}

export interface Device {
  id: string;
  profile_id: string;
  device_type: DeviceType;
  device_name: string | null;
  sync_enabled: boolean;
  connection_status: ConnectionStatus;
  error_message: string | null;
  provider_account_id: string | null;
  scopes: string[] | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AISummary {
  id: string;
  profile_id: string;
  summary_text: string;
  period_start: string;
  period_end: string;
  data_hash: string;
  generated_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  profile_id: string;
  actor_id: string;
  action: AuditAction;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
