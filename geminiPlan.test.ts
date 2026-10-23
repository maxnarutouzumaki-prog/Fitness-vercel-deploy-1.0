import { describe, expect, it } from 'vitest';
import { buildGeminiRequest, normalizeGeminiPlan } from '../src/domain/geminiPlan';
import { defaultQuestionnaire } from '../src/domain/training';
import type { Questionnaire, WorkoutSession } from '../src/domain/training';

const START = '2026-10-19';
const q = (over: Partial<Questionnaire> = {}): Questionnaire => ({
  ...defaultQuestionnaire('gain-muscle'),
  place: 'gym',
  experience: 'intermediate',
  daysPerWeek: 3,
  minutesPerSession: 60,
  ...over,
});

const exercise = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  muscles: ['chest', 'triceps'],
  sets: 3,
  reps: '8-12',
  restSeconds: 90,
  instructions: 'Execute com controle.',
  alternatives: [{ name: 'Flexão de braços', note: 'Sem equipamento' }],
  ...extra,
});

const trainingDay = (i: number, extra: Record<string, unknown> = {}) => ({
  dayIndex: i,
  kind: 'strength',
  title: `Treino ${i}`,
  focus: 'Peito e tríceps',
  intensity: 'moderate',
  place: 'gym',
  exercises: [exercise('Supino reto com barra'), exercise('Crucifixo', { muscles: ['chest'] }), exercise('Tríceps na polia', { muscles: ['triceps'] }), exercise('Prancha', { muscles: ['abs'], reps: '30 s', sets: 2, restSeconds: 45 })],
  cardio: null,
  ...extra,
});

const restDay = (i: number) => ({ dayIndex: i, kind: 'rest', title: 'Descanso', focus: 'Recuperação', exercises: [] });

function rawPlan(trainIdx = [0, 3, 6], over: Record<string, unknown> = {}) {
  return { days: Array.from({ length: 7 }, (_, i) => (trainIdx.includes(i) ? trainingDay(i) : restDay(i))), notes: ['Aqueça antes.'], ...over };
}

describe('validação da resposta do Gemini', () => {
  it('aceita um plano válido e o converte para o formato do app', () => {
    const r = normalizeGeminiPlan(rawPlan(), q(), START, 'gemini-3.8-flash');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.source).toBe('gemini');
    expect(r.plan.model).toBe('gemini-3.8-flash');
    expect(r.plan.days).toHaveLength(7);
    expect(r.plan.days.map((d) => d.kind)).toEqual(['strength', 'rest', 'rest', 'strength', 'rest', 'rest', 'strength']);
    expect(r.plan.days[0].date).toBe('2026-10-19');
    expect(r.plan.days[0].exercises[0].libraryId).toBe('bench-press');
    expect(r.plan.days[0].exercises[1].key).toBe('g-crucifixo');
    expect(r.plan.days[0].estimatedMinutes).toBeGreaterThan(0);
    expect(r.plan.notes[0]).toMatch(/Gemini/);
  });

  it('rejeita estruturas inválidas', () => {
    expect(normalizeGeminiPlan(null, q(), START, undefined).ok).toBe(false);
    expect(normalizeGeminiPlan({}, q(), START, undefined).ok).toBe(false);
    expect(normalizeGeminiPlan({ days: [] }, q(), START, undefined).ok).toBe(false);
    expect(normalizeGeminiPlan({ days: rawPlan().days.slice(0, 6) }, q(), START, undefined).ok).toBe(false);
    expect(normalizeGeminiPlan({ days: rawPlan().days.map((d) => ({ ...d, kind: 'x' })) }, q(), START, undefined).ok).toBe(false);
  });

  it('rejeita quando a quantidade de dias de treino não bate com o pedido', () => {
    expect(normalizeGeminiPlan(rawPlan([0, 2, 4, 6]), q(), START, undefined).ok).toBe(false);
    expect(normalizeGeminiPlan(rawPlan([0, 3]), q(), START, undefined).ok).toBe(false);
  });

  it('rejeita dia de força com poucos exercícios válidos', () => {
    const raw = rawPlan();
    (raw.days[0] as { exercises: unknown[] }).exercises = [exercise('Supino reto com barra')];
    expect(normalizeGeminiPlan(raw, q(), START, undefined).ok).toBe(false);
  });

  it('corrige valores fora do intervalo com padrões seguros', () => {
    const raw = rawPlan([0, 3, 6]);
    const d = raw.days[0] as { exercises: Array<Record<string, unknown>>; intensity: string };
    d.exercises[0] = exercise('Supino reto com barra', { sets: 99, reps: 'muitas', restSeconds: 5 });
    d.intensity = 'high';
    const r = normalizeGeminiPlan(raw, q({ experience: 'beginner' }), START, undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ex = r.plan.days[0].exercises[0];
    expect(ex.sets).toBe(6);
    expect(ex.reps).toBe('8-12');
    expect(ex.restSeconds).toBe(20);
    expect(r.plan.days[0].intensity).toBe('moderate'); // iniciante não recebe "alta"
  });

  it('força intensidade leve quando há limitação informada', () => {
    const r = normalizeGeminiPlan(rawPlan(), q({ limitationLevel: 'mild', limitations: 'ombro' }), START, undefined);
    expect(r.ok && r.plan.days[0].intensity).toBe('low');
  });

  it('remove exercícios que a pessoa pediu para evitar', () => {
    const r = normalizeGeminiPlan(rawPlan(), q({ avoid: 'supino' }), START, undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises.some((e) => e.name.toLowerCase().includes('supino'))).toBe(false);
  });

  it('entende nomes de músculos em português e ignora desconhecidos', () => {
    const raw = rawPlan();
    (raw.days[0] as { exercises: Array<Record<string, unknown>> }).exercises[0] = exercise('Supino reto com barra', { muscles: ['Peito', 'tríceps', 'xyz'] });
    const r = normalizeGeminiPlan(raw, q(), START, undefined);
    expect(r.ok && r.plan.days[0].exercises[0].muscles).toEqual(['chest', 'triceps']);
  });

  it('descarta cardio quando a pessoa não quer cardio', () => {
    const raw = rawPlan();
    (raw.days[0] as Record<string, unknown>).cardio = { modality: 'Esteira', minutes: 15, intensity: 'low' };
    const withCardio = normalizeGeminiPlan(raw, q({ cardio: 'some' }), START, undefined);
    expect(withCardio.ok && withCardio.plan.days[0].cardio?.minutes).toBe(15);
    const without = normalizeGeminiPlan(raw, q({ cardio: 'avoid' }), START, undefined);
    expect(without.ok && without.plan.days[0].cardio).toBeUndefined();
  });

  it('reduz cardio/exercícios quando excedem o tempo disponível; rejeita se impossível', () => {
    const raw = rawPlan();
    (raw.days[0] as Record<string, unknown>).cardio = { modality: 'Esteira', minutes: 45, intensity: 'low' };
    const r = normalizeGeminiPlan(raw, q({ minutesPerSession: 45 }), START, undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.days[0].estimatedMinutes).toBeLessThanOrEqual(45 * 1.15);
    const tiny = normalizeGeminiPlan(rawPlan(), q({ minutesPerSession: 10 }), START, undefined);
    expect(tiny.ok).toBe(false);
  });

  it('aceita dia só de cardio e exige atividade válida', () => {
    const raw = rawPlan([0, 3, 6]);
    raw.days[3] = { dayIndex: 3, kind: 'cardio', title: 'Cardio leve', focus: 'Cardio', exercises: [], cardio: { modality: 'Caminhada', minutes: 30, intensity: 'low' } } as never;
    expect(normalizeGeminiPlan(raw, q(), START, undefined).ok).toBe(true);
    (raw.days[3] as Record<string, unknown>).cardio = null;
    expect(normalizeGeminiPlan(raw, q(), START, undefined).ok).toBe(false);
  });

  it('usa a ordem recebida quando dayIndex falta e reordena quando vem embaralhado', () => {
    const raw = rawPlan();
    const shuffled = { ...raw, days: [...raw.days].reverse() };
    const r = normalizeGeminiPlan(shuffled, q(), START, undefined);
    expect(r.ok && r.plan.days.map((d) => d.kind)).toEqual(['strength', 'rest', 'rest', 'strength', 'rest', 'rest', 'strength']);
    const noIndex = { days: raw.days.map(({ dayIndex: _ignored, ...d }) => d) };
    expect(normalizeGeminiPlan(noIndex, q(), START, undefined).ok).toBe(true);
  });
});

describe('pedido enviado ao Gemini', () => {
  it('não inclui nome e só envia limitações quando existem', () => {
    const req = buildGeminiRequest(q({ limitations: 'texto qualquer' }), START, []);
    expect(Object.keys(req)).not.toContain('name');
    expect(req.limitations).toBe('');
    expect(req.window).toHaveLength(7);
    expect(req.window[0]).toEqual({ index: 0, date: '2026-10-19', weekday: 'segunda-feira' });
    const withLimit = buildGeminiRequest(q({ limitationLevel: 'mild', limitations: 'joelho' }), START, []);
    expect(withLimit.limitations).toBe('joelho');
  });

  it('resume apenas os treinos recentes (14 dias, até 10)', () => {
    const mk = (date: string, status: WorkoutSession['status']): WorkoutSession =>
      ({ date, status, title: 'T', exercises: [{ muscles: ['chest'], sets: [{ completed: true }] }] }) as unknown as WorkoutSession;
    const req = buildGeminiRequest(q(), START, [mk('2026-10-18', 'completed'), mk('2026-09-01', 'completed'), mk('2026-10-15', 'abandoned'), mk('2026-10-17', 'in-progress')]);
    expect(req.recent.map((r) => r.date)).toEqual(['2026-10-18', '2026-10-15']);
    expect(req.recent[0].muscles).toEqual(['chest']);
  });

  it('limita o tamanho dos textos livres', () => {
    const req = buildGeminiRequest(q({ likes: 'a'.repeat(1000) }), START, []);
    expect(req.likes).toHaveLength(300);
  });
});
