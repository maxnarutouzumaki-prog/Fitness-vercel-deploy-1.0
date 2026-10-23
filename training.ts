import type { Goal, Experience, ISODate, ISODateTime, Intensity, MuscleGroup, TrainingPlace } from './types';

/* ───────── Questionário ───────── */

export type EquipmentId = 'dumbbell' | 'band' | 'pullup' | 'bench' | 'kettlebell';

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  dumbbell: 'Halteres',
  band: 'Elásticos',
  pullup: 'Barra fixa',
  bench: 'Banco',
  kettlebell: 'Kettlebell',
};

export const EQUIPMENT_IDS = Object.keys(EQUIPMENT_LABELS) as EquipmentId[];

export type CardioPreference = 'avoid' | 'never' | 'some' | 'regular';

export const CARDIO_LABELS: Record<CardioPreference, string> = {
  avoid: 'Prefiro não incluir cardio',
  never: 'Nunca ou quase nunca faço',
  some: 'Faço às vezes',
  regular: 'Faço com frequência',
};

export type LimitationLevel = 'none' | 'mild' | 'significant';

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const PLACE_LABELS: Record<TrainingPlace, string> = {
  gym: 'Academia',
  home: 'Em casa',
  both: 'Nos dois',
};

export interface Questionnaire {
  goal: Goal;
  experience: Experience;
  place: TrainingPlace;
  daysPerWeek: number;
  minutesPerSession: number;
  /** Só relevante para treinos em casa (na academia assume-se equipamento completo). */
  equipment: EquipmentId[];
  likes: string;
  avoid: string;
  /** Texto livre sobre dores ou restrições. */
  limitations: string;
  limitationLevel: LimitationLevel;
  /** Dor significativa: o plano só é gerado se a pessoa informar que já tem liberação profissional. */
  clearedByProfessional: boolean;
  cardio: CardioPreference;
  /** Preferência livre de organização (ex.: "treinos curtos de manhã"). */
  organization: string;
  /** Dias da semana preferidos (0 = segunda … 6 = domingo). Opcional: sem dias fixos. */
  preferredDays: number[];
  completedAt: ISODateTime;
}

/** Valores iniciais sugeridos. Nada é enviado ao Gemini antes de a pessoa gerar o plano. */
export function defaultQuestionnaire(goal?: Goal): Questionnaire {
  return {
    goal: goal ?? 'health',
    experience: 'beginner',
    place: 'gym',
    daysPerWeek: 3,
    minutesPerSession: 45,
    equipment: [],
    likes: '',
    avoid: '',
    limitations: '',
    limitationLevel: 'none',
    clearedByProfessional: false,
    cardio: 'some',
    organization: '',
    preferredDays: [],
    completedAt: new Date().toISOString(),
  };
}

/** Hash simples e estável das respostas que afetam o plano (para saber se o plano ficou defasado). */
export function questionnaireHash(q: Questionnaire): string {
  const parts = [
    q.goal,
    q.experience,
    q.place,
    q.daysPerWeek,
    q.minutesPerSession,
    [...q.equipment].sort().join(','),
    q.likes.trim().toLowerCase(),
    q.avoid.trim().toLowerCase(),
    q.limitations.trim().toLowerCase(),
    q.limitationLevel,
    q.clearedByProfessional ? '1' : '0',
    q.cardio,
    q.organization.trim().toLowerCase(),
    [...q.preferredDays].sort().join(','),
  ].join('|');
  let h = 5381;
  for (let i = 0; i < parts.length; i += 1) h = ((h << 5) + h + parts.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Pode gerar plano? Dor significativa sem liberação profissional bloqueia a geração. */
export function canGeneratePlan(q: Questionnaire): { ok: true } | { ok: false; reason: string } {
  if (q.limitationLevel === 'significant' && !q.clearedByProfessional) {
    return {
      ok: false,
      reason:
        'Você indicou dor forte ou uma condição que precisa de avaliação. Antes de treinar, procure um médico ou profissional de educação física. Quando tiver essa orientação, volte e marque que já tem liberação.',
    };
  }
  return { ok: true };
}

/* ───────── Plano semanal ───────── */

export interface Alternative {
  key: string;
  name: string;
  muscles: MuscleGroup[];
  instructions?: string;
  note?: string;
  libraryId?: string;
}

export interface PlanExercise {
  /** Único dentro do plano. */
  id: string;
  /** Identificador estável do exercício, usado no histórico e na progressão. */
  key: string;
  libraryId?: string;
  name: string;
  muscles: MuscleGroup[];
  sets: number;
  /** "8-12", "10", "30-45 s". */
  reps: string;
  restSeconds: number;
  instructions: string;
  alternatives: Alternative[];
  substitutedFrom?: string;
}

export interface CardioPlan {
  modality: string;
  minutes: number;
  intensity: Intensity;
  note?: string;
}

export type PlanDayKind = 'strength' | 'cardio' | 'rest';

export interface PlanDay {
  /** Identifica o treino (acompanha o conteúdo ao reorganizar). */
  id: string;
  date: ISODate;
  kind: PlanDayKind;
  title: string;
  focus: string;
  place?: 'gym' | 'home';
  estimatedMinutes: number;
  intensity?: Intensity;
  exercises: PlanExercise[];
  cardio?: CardioPlan;
  note?: string;
  movedFrom?: ISODate;
}

export type PlanSource = 'gemini' | 'local';

export type FallbackReason =
  | 'user_choice'
  | 'offline'
  | 'not_configured'
  | 'rate_limited'
  | 'client_limit'
  | 'unavailable'
  | 'timeout'
  | 'invalid_response'
  | 'no_endpoint';

export interface WeeklyPlan {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
  source: PlanSource;
  model?: string;
  fallbackReason?: FallbackReason;
  status: 'active' | 'archived';
  days: PlanDay[];
  notes: string[];
  questionnaireHash: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const FALLBACK_MESSAGES: Record<FallbackReason, string> = {
  user_choice: 'Você escolheu gerar sem IA.',
  offline: 'Sem conexão com a internet.',
  not_configured: 'O Gemini ainda não está configurado neste aplicativo.',
  rate_limited: 'O limite de uso do Gemini foi atingido por agora.',
  client_limit: 'Você atingiu o limite diário de gerações com o Gemini neste aparelho.',
  unavailable: 'O Gemini está indisponível no momento.',
  timeout: 'O Gemini demorou demais para responder.',
  invalid_response: 'A resposta do Gemini veio incompleta ou inválida.',
  no_endpoint: 'A função de IA não foi encontrada neste endereço.',
};

/* ───────── Sessões de treino ───────── */

export type SessionStatus = 'in-progress' | 'completed' | 'partial' | 'abandoned';

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  'in-progress': 'Em andamento',
  completed: 'Concluído',
  partial: 'Parcial',
  abandoned: 'Abandonado',
};

export interface LoggedSet {
  reps?: number;
  loadKg?: number;
  completed: boolean;
}

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Muito fácil',
  2: 'Fácil',
  3: 'Moderado',
  4: 'Difícil',
  5: 'Muito difícil',
};

export interface LoggedExercise {
  planExerciseId: string;
  key: string;
  name: string;
  muscles: MuscleGroup[];
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  instructions: string;
  alternatives: Alternative[];
  sets: LoggedSet[];
  difficulty?: Difficulty;
  discomfort?: { present: boolean; note?: string };
  notes?: string;
  substitutedFrom?: string;
}

export interface LoggedCardio {
  modality: string;
  plannedMinutes: number;
  minutes?: number;
  completed: boolean;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  /** Plano semanal (IA/local) ou "routine:<id>" quando a sessão veio de uma ficha própria. */
  planId: string;
  /** Origem da sessão. Ausente = plano semanal (compatível com sessões antigas). */
  source?: 'plan' | 'routine';
  routineId?: string;
  dayId: string;
  /** Data planejada do dia no momento em que a sessão começou. */
  plannedDate: ISODate;
  title: string;
  focus: string;
  place?: 'gym' | 'home';
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  /** Data local em que a sessão terminou (ou começou, enquanto em andamento). */
  date: ISODate;
  /** Tempo ativo acumulado, sem contar pausas. */
  activeMs: number;
  /** Instante (ms) em que o relógio voltou a correr; ausente quando pausada. */
  runningSince?: number;
  /** Último instante (ms) com atividade do usuário; usado para pausar sessões esquecidas. */
  lastActivityAt: number;
  status: SessionStatus;
  exercises: LoggedExercise[];
  cardio?: LoggedCardio;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
