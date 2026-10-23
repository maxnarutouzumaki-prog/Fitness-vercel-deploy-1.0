import { addDays, weekdayMon } from './dates';
import {
  LIBRARY,
  allowedRequirements,
  isAvailable,
  matchesTerms,
  splitTerms,
  stressFromText,
} from './exerciseLibrary';
import type { LibraryExercise, Pattern, Requirement, Stress } from './exerciseLibrary';
import { uid } from './ids';
import { estimateMinutes, recoveryConflicts, describeConflict } from './planning';
import type { Alternative, CardioPlan, PlanDay, PlanExercise, Questionnaire, WeeklyPlan, WorkoutSession } from './training';
import { questionnaireHash } from './training';
import type { Intensity, MuscleGroup } from './types';
import { MUSCLE_LABELS } from './types';

/**
 * Gerador local (sem IA). Determinístico: as mesmas respostas geram o mesmo plano.
 * Serve como contingência quando o Gemini não está configurado, está offline ou falha.
 */

type Slot = Pattern;

interface Template {
  title: string;
  slots: Slot[];
}

const FULL: Template[] = [
  { title: 'Corpo todo A', slots: ['squat', 'push-h', 'pull-h', 'hinge', 'push-v', 'core'] },
  { title: 'Corpo todo B', slots: ['lunge', 'pull-v', 'push-v', 'glutes', 'push-h', 'core'] },
  { title: 'Corpo todo C', slots: ['squat', 'pull-v', 'push-h', 'hinge', 'pull-h', 'core'] },
];
const UPPER_A: Template = { title: 'Superiores A', slots: ['push-h', 'pull-v', 'push-v', 'pull-h', 'biceps', 'triceps'] };
const UPPER_B: Template = { title: 'Superiores B', slots: ['pull-h', 'push-h', 'pull-v', 'push-v', 'triceps', 'biceps'] };
const LOWER_A: Template = { title: 'Inferiores A', slots: ['squat', 'hinge', 'lunge', 'glutes', 'calves', 'core'] };
const LOWER_B: Template = { title: 'Inferiores B', slots: ['hinge', 'squat', 'lunge', 'glutes', 'calves', 'core'] };
const PUSH: Template = { title: 'Empurrar', slots: ['push-h', 'push-v', 'push-h', 'delts', 'triceps', 'core'] };
const PULL: Template = { title: 'Puxar', slots: ['pull-v', 'pull-h', 'pull-h', 'delts', 'biceps', 'core'] };

function splitFor(trainingDays: number): Template[] {
  if (trainingDays <= 3) return Array.from({ length: trainingDays }, (_, i) => FULL[i % FULL.length]);
  if (trainingDays === 4) return [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
  if (trainingDays === 5) return [PUSH, PULL, LOWER_A, UPPER_B, LOWER_B];
  return [PUSH, PULL, LOWER_A, { ...PUSH, title: 'Empurrar B' }, { ...PULL, title: 'Puxar B' }, LOWER_B];
}

/** Escolhe quais dias (índices 0–6 da janela) terão treino, espalhando ao máximo e respeitando preferências. */
export function chooseTrainingDays(
  count: number,
  startDate: string,
  preferredWeekdays: number[],
  penalizeFirstDay: boolean,
): number[] {
  const k = Math.max(1, Math.min(7, count));
  const all = [0, 1, 2, 3, 4, 5, 6];
  const preferred = all.filter((i) => preferredWeekdays.includes(weekdayMon(addDays(startDate, i))));
  const candidates = preferred.length >= k ? preferred : all;

  let best: number[] = candidates.slice(0, k);
  let bestScore = -Infinity;
  const combo: number[] = [];
  const walk = (from: number) => {
    if (combo.length === k) {
      let minGap = 7;
      for (let i = 1; i < combo.length; i += 1) minGap = Math.min(minGap, combo[i] - combo[i - 1]);
      let restedGaps = 0;
      for (let i = 1; i < combo.length; i += 1) if (combo[i] - combo[i - 1] >= 2) restedGaps += 1;
      const sum = combo.reduce((a, b) => a + b, 0);
      // Prioriza o maior intervalo mínimo, depois mais descansos intercalados, depois dias mais cedo.
      const score = minGap * 100 + restedGaps * 10 - (penalizeFirstDay && combo[0] === 0 ? 150 : 0) - sum / 10;
      if (score > bestScore) {
        bestScore = score;
        best = [...combo];
      }
      return;
    }
    for (let i = from; i < candidates.length; i += 1) {
      combo.push(candidates[i]);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return best;
}

interface Params {
  sets: number;
  reps: string;
  rest: number;
}

function paramsFor(q: Questionnaire, compound: boolean): Params {
  const beginner = q.experience === 'beginner';
  const advanced = q.experience === 'advanced';
  let p: Params;
  switch (q.goal) {
    case 'strength':
      p = compound
        ? { sets: beginner ? 3 : 4, reps: beginner ? '6-8' : '4-6', rest: beginner ? 120 : 150 }
        : { sets: 3, reps: '8-12', rest: 75 };
      break;
    case 'gain-muscle':
      p = compound
        ? { sets: advanced ? 4 : 3, reps: '8-12', rest: 90 }
        : { sets: 3, reps: '10-15', rest: 60 };
      break;
    case 'lose-fat':
      p = compound ? { sets: 3, reps: '10-15', rest: 60 } : { sets: 3, reps: '12-15', rest: 45 };
      break;
    case 'conditioning':
      p = compound ? { sets: 3, reps: '12-15', rest: 45 } : { sets: 2, reps: '12-15', rest: 40 };
      break;
    default:
      p = compound ? { sets: 3, reps: '10-12', rest: 60 } : { sets: 2, reps: '10-12', rest: 45 };
  }
  if (beginner) p = { ...p, sets: Math.min(p.sets, compound ? 3 : 2) };
  return p;
}

function intensityFor(q: Questionnaire): Intensity {
  if (q.limitationLevel !== 'none') return 'low';
  if (q.experience === 'beginner') return q.goal === 'health' || q.goal === 'conditioning' ? 'low' : 'moderate';
  if (q.experience === 'advanced' && (q.goal === 'strength' || q.goal === 'gain-muscle')) return 'high';
  return 'moderate';
}

const TECHNICAL_FOR_BEGINNERS = new Set(['back-squat', 'barbell-deadlift', 'bench-press']);

interface PickContext {
  q: Questionnaire;
  place: 'gym' | 'home';
  allowed: Set<Requirement>;
  avoidStress: Set<Stress>;
  avoidTerms: string[];
  likeTerms: string[];
}

function candidatesFor(pattern: Pattern, ctx: PickContext, used: Set<string>): LibraryExercise[] {
  return LIBRARY.map((ex, index) => ({ ex, index }))
    .filter(({ ex }) => ex.pattern === pattern && isAvailable(ex, ctx.allowed) && !used.has(ex.id))
    .filter(({ ex }) => !ex.stress.some((s) => ctx.avoidStress.has(s)))
    .filter(({ ex }) => !matchesTerms(ex, ctx.avoidTerms))
    .map(({ ex, index }) => {
      let score = 0;
      if (matchesTerms(ex, ctx.likeTerms)) score += 100;
      if (ctx.place === 'gym') score += ex.requires.includes('gym') ? 20 : 0;
      else score += ex.requires.some((r) => r !== 'bodyweight') ? 10 : 0;
      if (ctx.q.experience === 'beginner' && TECHNICAL_FOR_BEGINNERS.has(ex.id)) score -= 30;
      return { ex, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((c) => c.ex);
}

function toAlternative(ex: LibraryExercise): Alternative {
  return { key: ex.id, libraryId: ex.id, name: ex.name, muscles: ex.muscles, instructions: ex.instructions };
}

function buildExercise(ex: LibraryExercise, ctx: PickContext, dayId: string, n: number, used: Set<string>): PlanExercise {
  const p = paramsFor(ctx.q, ex.compound);
  const alternatives = candidatesFor(ex.pattern, ctx, new Set([...used, ex.id]))
    .slice(0, 3)
    .map(toAlternative);
  return {
    id: `${dayId}-e${n}`,
    key: ex.id,
    libraryId: ex.id,
    name: ex.name,
    muscles: ex.muscles,
    sets: p.sets,
    reps: ex.reps ?? p.reps,
    restSeconds: ex.reps && ex.pattern === 'core' ? 45 : p.rest,
    instructions: ex.instructions,
    alternatives,
  };
}

function cardioMinutesFor(q: Questionnaire, trainingIndex: number, trainingDays: number): number {
  if (q.cardio === 'avoid') return 0;
  const m = q.minutesPerSession;
  let base: number;
  switch (q.goal) {
    case 'lose-fat':
    case 'conditioning':
      base = 20;
      break;
    case 'health':
      base = 15;
      break;
    case 'gain-muscle':
      base = 10;
      break;
    default:
      base = q.cardio === 'regular' ? 10 : 0;
  }
  // Metas de força/massa: cardio leve em dias alternados, para não competir com a recuperação.
  if ((q.goal === 'gain-muscle' || q.goal === 'strength') && trainingDays > 1 && trainingIndex % 2 === 1) base = 0;
  if (q.cardio === 'never') base = Math.min(base, 15);
  if (q.experience === 'beginner') base = Math.min(base, 15);
  const cap = Math.floor(m * 0.3);
  base = Math.min(base, cap);
  if (m <= 25 && q.goal !== 'lose-fat' && q.goal !== 'conditioning') base = 0;
  return base >= 5 ? Math.round(base / 5) * 5 : 0;
}

function cardioPlanFor(q: Questionnaire, place: 'gym' | 'home', minutes: number, index: number): CardioPlan {
  const light = q.cardio === 'never' || q.experience === 'beginner';
  let modality: string;
  if (place === 'gym') {
    if (light) modality = 'Caminhada na esteira';
    else modality = ['Bicicleta ergométrica', 'Esteira (caminhada rápida)', 'Elíptico'][index % 3];
    if (!light && q.cardio === 'regular' && q.goal === 'conditioning' && index % 2 === 0) modality = 'Corrida leve na esteira';
  } else {
    modality = light ? 'Caminhada leve' : q.cardio === 'regular' && index % 2 === 0 ? 'Corrida leve' : 'Caminhada rápida';
  }
  return {
    modality,
    minutes,
    intensity: light ? 'low' : 'moderate',
    note: 'Mantenha um ritmo em que ainda consiga conversar. Faça só se estiver confortável.',
  };
}

function focusFor(exercises: PlanExercise[]): string {
  const counts = new Map<MuscleGroup, number>();
  for (const ex of exercises) {
    const main = ex.muscles[0];
    if (main && main !== 'abs') counts.set(main, (counts.get(main) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => MUSCLE_LABELS[m]);
  const text = top.join(', ');
  return text ? text.charAt(0) + text.slice(1).toLowerCase() : 'Treino de força';
}

export interface LocalPlanOptions {
  questionnaire: Questionnaire;
  startDate: string;
  /** Sessões já registradas (para evitar treinar logo depois de um treino recente). */
  sessions?: WorkoutSession[];
  nowIso?: string;
}

export function generateLocalPlan(options: LocalPlanOptions): WeeklyPlan {
  const q = options.questionnaire;
  const nowIso = options.nowIso ?? new Date().toISOString();
  const startDate = options.startDate;
  const history = options.sessions ?? [];

  const trainedRecently = history.some(
    (s) => s.status === 'completed' && (s.date === startDate || s.date === addDays(startDate, -1)),
  );
  const trainingCount = Math.max(1, Math.min(6, Math.round(q.daysPerWeek)));
  const indices = chooseTrainingDays(trainingCount, startDate, q.preferredDays, trainedRecently);
  const templates = splitFor(indices.length);

  const avoidTerms = splitTerms(q.avoid);
  const likeTerms = splitTerms(q.likes);
  const avoidStress = new Set<Stress>(q.limitationLevel === 'none' ? [] : stressFromText(q.limitations));
  const intensity = intensityFor(q);

  const days: PlanDay[] = [];
  let trainingIndex = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(startDate, i);
    const dayId = uid('d');
    const pos = indices.indexOf(i);
    if (pos === -1) {
      days.push({
        id: dayId,
        date,
        kind: 'rest',
        title: 'Descanso',
        focus: 'Recuperação',
        estimatedMinutes: 0,
        exercises: [],
        note: 'Dia de recuperação. Uma caminhada leve, alongamento suave, boa hidratação e sono ajudam, mas nada é obrigatório.',
      });
      continue;
    }

    const template = templates[pos];
    const place: 'gym' | 'home' = q.place === 'both' ? (trainingIndex % 2 === 0 ? 'gym' : 'home') : q.place;
    const ctx: PickContext = {
      q,
      place,
      allowed: allowedRequirements(place, q.equipment),
      avoidStress,
      avoidTerms,
      likeTerms,
    };

    const used = new Set<string>();
    const picked: LibraryExercise[] = [];
    template.slots.forEach((slot, slotIndex) => {
      const options = candidatesFor(slot, ctx, used);
      if (options.length === 0) return;
      const variant = (trainingIndex + slotIndex) % Math.min(options.length, 3);
      const choice = options[variant];
      used.add(choice.id);
      picked.push(choice);
    });

    const maxExercises = q.minutesPerSession >= 75 ? 7 : 6;
    let exercises = picked.slice(0, maxExercises).map((ex, n) => buildExercise(ex, ctx, dayId, n + 1, used));
    let cardioMinutes = cardioMinutesFor(q, trainingIndex, indices.length);
    const fits = () => estimateMinutes(exercises, cardioMinutes > 0 ? cardioPlanFor(q, place, cardioMinutes, trainingIndex) : undefined) <= q.minutesPerSession;

    while (!fits() && exercises.length > 3) exercises = exercises.slice(0, -1);
    if (!fits()) exercises = exercises.map((e) => ({ ...e, sets: Math.min(e.sets, 2) }));
    while (!fits() && cardioMinutes > 0) cardioMinutes = cardioMinutes >= 10 ? cardioMinutes - 5 : 0;

    const cardio = cardioMinutes > 0 ? cardioPlanFor(q, place, cardioMinutes, trainingIndex) : undefined;
    days.push({
      id: dayId,
      date,
      kind: 'strength',
      title: template.title,
      focus: focusFor(exercises),
      place,
      estimatedMinutes: estimateMinutes(exercises, cardio),
      intensity,
      exercises,
      cardio,
    });
    trainingIndex += 1;
  }

  const notes: string[] = [
    'Plano montado pelo próprio app, sem inteligência artificial, a partir das suas respostas.',
    'Comece com cargas confortáveis e aumente aos poucos. Priorize a técnica e pare se sentir dor.',
  ];
  if (q.limitationLevel !== 'none') {
    notes.push('Você informou uma limitação: o plano usa intensidade leve e evita exercícios que sobrecarreguem a região citada. Não substitui orientação profissional.');
  }
  const draft: WeeklyPlan = {
    id: uid('plan'),
    startDate,
    endDate: addDays(startDate, 6),
    source: 'local',
    status: 'active',
    days,
    notes,
    questionnaireHash: questionnaireHash(q),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  for (const c of recoveryConflicts(days)) draft.notes.push(describeConflict(c));
  return draft;
}

/**
 * Se já houve treino concluído hoje, o primeiro dia da janela não recebe outro treino:
 * troca de lugar com o primeiro descanso (sem criar duas sessões no mesmo dia).
 */
export function avoidSecondSessionToday(plan: WeeklyPlan, completedToday: boolean): WeeklyPlan {
  if (!completedToday) return plan;
  const first = plan.days[0];
  if (!first || first.kind === 'rest') return plan;
  const rest = plan.days.find((d) => d.kind === 'rest');
  if (!rest) return plan;
  const days = plan.days
    .map((d) => {
      if (d.id === first.id) return { ...d, date: rest.date, movedFrom: first.date };
      if (d.id === rest.id) return { ...d, date: first.date };
      return d;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return { ...plan, days };
}
