/**
 * Modelo de dados do app. Esta etapa só PREPARA as estruturas dos módulos futuros
 * (treino, alimentação, evolução). Nada aqui gera dados fictícios.
 *
 * Todos os registros têm `id` estável (string) e carregam datas em ISO.
 * Para evoluir o modelo, aumente DB_VERSION em data/db.ts e trate a migração lá.
 */

export const SCHEMA_VERSION = 2;

/** 'YYYY-MM-DD' no fuso local do usuário. */
export type ISODate = string;
/** Data e hora completas em ISO 8601. */
export type ISODateTime = string;

// ───────── Perfil ─────────

export type Goal = 'lose-fat' | 'gain-muscle' | 'conditioning' | 'strength' | 'health';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingPlace = 'gym' | 'home' | 'both';

export const GOAL_LABELS: Record<Goal, string> = {
  'lose-fat': 'Perder gordura',
  'gain-muscle': 'Ganhar massa muscular',
  conditioning: 'Melhorar o condicionamento',
  strength: 'Ganhar força',
  health: 'Saúde e bem-estar',
};

export const PROFILE_ID = 'me' as const;

export interface Profile {
  id: typeof PROFILE_ID;
  schemaVersion: number;
  name: string;
  /** Objetivo principal (usado para interpretar a evolução). */
  goal?: Goal;
  // Campos preparados para as próximas etapas (ainda sem tela):
  experience?: Experience;
  /** Disponibilidade real, sem dias fixos de academia. */
  availability?: { sessionsPerWeek?: number; minutesPerSession?: number };
  place?: TrainingPlace;
  equipment?: string[];
  dietaryPreferences?: string[];
  restrictions?: string[];
  /** Respostas do questionário de treino (etapa 2). */
  questionnaire?: import('./training').Questionnaire;
  onboardingDone: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ───────── Aparência ─────────

export const THEME_IDS = ['green', 'blue', 'pink', 'red', 'orange'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export type ColorMode = 'light' | 'dark';

export interface Appearance {
  theme: ThemeId;
  mode: ColorMode;
}

export const APPEARANCE_ID = 'appearance' as const;

export interface AppearanceRecord extends Appearance {
  id: typeof APPEARANCE_ID;
  updatedAt: ISODateTime;
}

// ───────── Exercícios (base compartilhada) ─────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'glutes'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'full-body'
  | 'cardio';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  abs: 'Abdômen',
  glutes: 'Glúteos',
  quadriceps: 'Quadríceps',
  hamstrings: 'Posteriores',
  calves: 'Panturrilhas',
  'full-body': 'Corpo todo',
  cardio: 'Cardio',
};

export type Intensity = 'low' | 'moderate' | 'high';
export const INTENSITY_LABELS: Record<Intensity, string> = {
  low: 'Leve',
  moderate: 'Moderada',
  high: 'Alta',
};

export interface Exercise {
  id: string;
  name: string;
  kind: 'strength' | 'cardio' | 'mobility';
  muscleGroups: MuscleGroup[];
  equipment: string[];
  place: TrainingPlace;
  custom: boolean;
}

// Planos, sessões e check-ins: ver domain/training.ts e domain/checkins.ts.

// ───────── Alimentação (preparado) ─────────

export interface MealEntry {
  id: string;
  date: ISODate;
  loggedAt: ISODateTime;
  name: string;
  portion?: string;
  /** Estimativa: sempre apresentada com incerteza e passível de correção. */
  kcal?: number;
  kcalRange?: [number, number];
  macros?: { proteinG?: number; carbsG?: number; fatG?: number };
  source: 'manual' | 'photo-ai' | 'estimate';
  /** false = refeição registrada em "Equilíbrio alimentar" (fora do habitual). */
  plannedMeal: boolean;
  /** Etapa 3: tipo, horário e alimentos da refeição. kcal/macros acima são a soma dos itens. */
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  /** Horário local "HH:MM". */
  time?: string;
  items?: Array<{
    id: string;
    name: string;
    quantity?: number;
    unit?: string;
    kcal?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  }>;
  /** Presente só quando uma análise do Gemini realmente aconteceu. */
  analysis?: { by: 'gemini'; model?: string; at: ISODateTime; confidence?: 'low' | 'medium' | 'high' };
  photoId?: string;
  userCorrected?: boolean;
  notes?: string;
}

// ───────── Evolução (preparado) ─────────

export type MeasurementKey = 'waist' | 'hip' | 'chest' | 'arm' | 'thigh' | 'neck';

export interface BodyMetricEntry {
  id: string;
  date: ISODate;
  weightKg?: number;
  leanMassKg?: number;
  bodyFatPct?: number;
  measurementsCm?: Partial<Record<MeasurementKey, number>>;
  notes?: string;
  createdAt: ISODateTime;
}

/** Fotos são totalmente opcionais e ficam apenas no aparelho. */
export interface ProgressPhoto {
  id: string;
  date: ISODate;
  angle?: 'front' | 'side' | 'back';
  blob?: Blob;
  mimeType?: string;
  note?: string;
  createdAt: ISODateTime;
}

export interface Reminder {
  id: string;
  kind: 'progress-photo' | 'workout' | 'weigh-in' | 'custom';
  title: string;
  everyDays?: number;
  nextAt?: ISODateTime;
  enabled: boolean;
  createdAt: ISODateTime;
}
