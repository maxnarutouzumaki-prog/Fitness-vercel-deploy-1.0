import { describe, expect, it } from 'vitest';
import { CATALOG, artFor, findCatalog, kindForKey, repsUnitLabel, searchCatalog } from '../src/domain/catalog';
import { ART_ALL } from '../src/domain/exerciseArt';
import { VIEW, VIEW_TOP, artSignature, solve } from '../src/domain/figure';
import { dataUrlBytes, findDuplicateName, fitWithin, isImageDataUrl, validateCustomExercise } from '../src/domain/customExercises';
import { assignDay, copyToDay, createRoutineSession, duplicateRoutine, exerciseFromCatalog, manualExercise, moveItem, moveToDay, newRoutine, routineStatusOn, routinesOn, sanitizeRoutine, unassignDay, weekLayout } from '../src/domain/routines';
import { BALANCE_INTRO, BALANCE_TIPS, FORBIDDEN_BALANCE_TERMS, HEALTH_NOTICE, MEAL_IDEAS, buildMeal, dayTotals, newFood, parseNumber, suggestLocal, sumItems, validateMeal } from '../src/domain/nutrition';
import { buildMealPhotoRequest, normalizeMealAnalysis, normalizeSuggestions } from '../src/domain/mealAnalysis';
import { closeSession } from '../src/domain/session';

const NOW = '2026-10-19T10:00:00.000Z';

describe('imagens dos exercícios', () => {
  it('todo exercício do catálogo tem ilustração ou fallback explícito (nenhum sem tratamento)', () => {
    const withoutArt = CATALOG.filter((e) => !artFor(e.id));
    // O que não tem arte cai no aviso "Imagem indisponível" — a lista é conhecida e pequena.
    expect(withoutArt.map((e) => e.id)).toEqual([]);
  });
  it('não há ilustração para ids que não existem no catálogo', () => {
    for (const id of Object.keys(ART_ALL)) expect(!!findCatalog(id)).toBe(true);
  });
  it('movimentos diferentes nunca compartilham a mesma ilustração', () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const [id, art] of Object.entries(ART_ALL)) {
      const sig = artSignature(art.frames);
      if (seen.has(sig)) dups.push(`${id} = ${seen.get(sig)}`);
      seen.set(sig, id);
    }
    expect(dups).toEqual([]);
  });
  it('todas as articulações são números finitos dentro do quadro', () => {
    const bad: string[] = [];
    for (const [id, art] of Object.entries(ART_ALL)) {
      for (const pose of art.frames) {
        const g = solve(pose);
        for (const [x, y] of Object.values(g.joints)) {
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < -4 || x > VIEW + 4 || y < VIEW_TOP - 4 || y > VIEW + 4) bad.push(`${id}:${Math.round(x)},${Math.round(y)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it('cobre todos os grupos pedidos', () => {
    for (const m of ['biceps', 'triceps', 'chest', 'back', 'shoulders', 'quadriceps', 'abs', 'cardio'] as const) {
      expect(CATALOG.filter((e) => e.muscles.includes(m) && artFor(e.id)).length).toBeGreaterThan(0);
    }
    expect(CATALOG.some((e) => e.kind === 'mobility')).toBe(true);
  });
  it('busca por nome ignora acentos', () => {
    expect(searchCatalog('agachamento').length).toBeGreaterThan(0);
    expect(searchCatalog('zzzz')).toHaveLength(0);
  });
  it('rótulos de unidade para cardio e mobilidade', () => {
    expect(repsUnitLabel('cardio', '20 min')).toBe('Minutos');
    expect(repsUnitLabel('mobility', '30-45 s')).toBe('Segundos');
    expect(repsUnitLabel('strength', '8-12')).toBe('Repetições');
    expect(kindForKey('c-x', [{ id: 'x', kind: 'cardio' }])).toBe('cardio');
  });
});

describe('exercícios personalizados', () => {
  it('valida nome, duplicidade e imagem', () => {
    expect(validateCustomExercise({ name: 'a' }).ok).toBe(false);
    expect(validateCustomExercise({ name: 'Remada no cabo' }).ok).toBe(true);
    const list = [{ id: '1', name: 'Remada Curvada', muscles: [], kind: 'strength' as const, createdAt: NOW, updatedAt: NOW }];
    expect(findDuplicateName(list, 'remada curvada')?.id).toBe('1');
    expect(isImageDataUrl('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isImageDataUrl('https://x/y.jpg')).toBe(false);
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
    expect(fitWithin(4000, 2000, 640)).toEqual({ width: 640, height: 320 });
    expect(fitWithin(100, 50, 640)).toEqual({ width: 100, height: 50 });
  });
});

describe('fichas próprias', () => {
  const make = () => {
    let r = newRoutine('Treino A', 0, NOW);
    r = { ...r, focus: 'Peito', exercises: [exerciseFromCatalog(CATALOG[0]), { ...manualExercise('Meu exercício'), sets: 3, reps: '10', loadKg: 20 }] };
    return r;
  };
  it('cria, sanitiza e duplica', () => {
    const r = sanitizeRoutine({ ...make(), name: '  ', weekdays: [1, 1, 9, -1, 3] }, NOW);
    expect(r.name).toBe('Treino');
    expect(r.weekdays).toEqual([1, 3]);
    const d = duplicateRoutine(make(), 1, NOW);
    expect(d.id === make().id).toBe(false);
    expect(d.exercises).toHaveLength(2);
    expect(d.exercises[0].id === make().exercises[0].id).toBe(false);
  });
  it('não há limite de fichas e a reordenação mantém todas', () => {
    const list = Array.from({ length: 30 }, (_, i) => newRoutine(`R${i}`, i, NOW));
    expect(moveItem(list, 0, 29)).toHaveLength(30);
    expect(moveItem(list, 0, 29)[29].name).toBe('R0');
  });
  it('atribui, move, copia e libera dias; várias fichas no mesmo dia', () => {
    const a = assignDay(make(), 0, NOW);
    const b = assignDay({ ...make(), id: 'b', order: 1 }, 0, NOW);
    expect(routinesOn([a, b], '2026-10-19')).toHaveLength(2); // segunda
    expect(moveToDay(a, 0, 2, NOW).weekdays).toEqual([2]);
    expect(copyToDay(a, 4, NOW).weekdays).toEqual([0, 4]);
    expect(unassignDay(a, 0, NOW).weekdays).toEqual([]);
    expect(weekLayout([a, b])[0]).toHaveLength(2);
    expect(weekLayout([a, b])[1]).toHaveLength(0);
  });
  it('a sessão guarda uma cópia: editar a ficha depois não altera o histórico', () => {
    const r = { ...make(), id: 'r1' };
    const s = createRoutineSession(r, '2026-10-19', [], Date.parse(NOW));
    expect(s.source).toBe('routine');
    expect(s.routineId).toBe('r1');
    expect(s.dayId).toBe('routine:r1:2026-10-19');
    const done = closeSession({ ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, completed: true })) })) }, 'completed', Date.parse(NOW) + 60000);
    const edited = { ...r, name: 'Outro nome', exercises: [] };
    expect(edited.exercises).toHaveLength(0);
    expect(done.title).toBe('Treino A');
    expect(done.exercises).toHaveLength(2);
    expect(done.exercises[1].name).toBe('Meu exercício');
  });
  it('a carga da ficha entra na série quando não há histórico', () => {
    const r = { ...make(), id: 'r2' };
    const s = createRoutineSession(r, '2026-10-19', [], Date.parse(NOW));
    expect(s.exercises[1].sets[0].loadKg).toBe(20);
  });
  it('status por dia', () => {
    const r = { ...make(), id: 'r3', weekdays: [0] };
    const s = createRoutineSession(r, '2026-10-19', [], Date.parse(NOW));
    expect(routineStatusOn(r, '2026-10-19', '2026-10-19', [])).toBe('pending');
    expect(routineStatusOn(r, '2026-10-19', '2026-10-19', [s])).toBe('in-progress');
    expect(routineStatusOn(r, '2026-10-12', '2026-10-19', [])).toBe('missed');
    expect(routineStatusOn(r, '2026-10-26', '2026-10-19', [])).toBe('later');
  });
});

describe('alimentação', () => {
  it('soma apenas o que foi informado e recalcula totais do dia', () => {
    expect(sumItems([{ ...newFood('a'), kcal: 100 }, newFood('b')]).kcal).toBe(100);
    expect(sumItems([newFood('a')]).kcal).toBeUndefined();
    const m1 = buildMeal({ date: '2026-10-19', time: '08:00', mealType: 'breakfast', items: [{ ...newFood('pão'), kcal: 150, proteinG: 5 }], source: 'manual' }, NOW);
    const m2 = buildMeal({ date: '2026-10-19', time: '12:00', mealType: 'lunch', items: [{ ...newFood('arroz'), kcal: 300 }, { ...newFood('feijão'), kcal: 100, proteinG: 6 }], source: 'manual' }, NOW);
    const m3 = buildMeal({ date: '2026-10-19', time: '15:00', mealType: 'snack', items: [newFood('fruta')], source: 'manual' }, NOW);
    const t = dayTotals([m1, m2, m3]);
    expect(t.count).toBe(3);
    expect(t.kcal).toBe(550);
    expect(t.proteinG).toBe(11);
    expect(t.withoutKcal).toBe(1);
    expect(dayTotals([m1, m2]).kcal).toBe(550);
    expect(dayTotals([m2]).kcal).toBe(400); // após excluir
    expect(dayTotals([]).kcal).toBeNull();
  });
  it('valores são opcionais; só o alimento é exigido', () => {
    expect(validateMeal([newFood('')]).ok).toBe(false);
    expect(validateMeal([newFood('maçã')]).ok).toBe(true);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
  });
  it('editar preserva id e horário de criação e marca a correção da IA', () => {
    const first = buildMeal({ date: '2026-10-19', time: '12:00', mealType: 'lunch', items: [{ ...newFood('x'), kcal: 10 }], source: 'photo-ai', analysis: { by: 'gemini', at: NOW } }, NOW);
    const next = buildMeal({ date: '2026-10-19', time: '13:00', mealType: 'lunch', items: [{ ...newFood('x'), kcal: 20 }], source: 'photo-ai', corrected: true }, '2026-10-19T14:00:00.000Z', first);
    expect(next.id).toBe(first.id);
    expect(next.loggedAt).toBe(first.loggedAt);
    expect(next.kcal).toBe(20);
    expect(next.userCorrected).toBe(true);
  });
  it('textos de equilíbrio alimentar não usam termos proibidos', () => {
    const all = [BALANCE_INTRO, ...BALANCE_TIPS, HEALTH_NOTICE, ...MEAL_IDEAS.map((m) => `${m.title} ${m.note}`)].join(' ').toLowerCase();
    for (const t of FORBIDDEN_BALANCE_TERMS) {
      // A dica sobre exercício nega explicitamente a ideia de "pagar" comida.
      if (t === 'pagar as calorias') continue;
      expect(all.includes(t)).toBe(false);
    }
    expect(BALANCE_INTRO.toLowerCase()).toContain('uma refeição isolada');
  });
  it('sugestões locais respeitam orçamento, vegetariano e restrições', () => {
    const cheap = suggestLocal({ budget: 'low', vegetarian: false, avoid: '' });
    expect(cheap.every((m) => m.budget === 'low')).toBe(true);
    expect(suggestLocal({ budget: 'any', vegetarian: true, avoid: '' }).every((m) => m.vegetarian)).toBe(true);
    expect(suggestLocal({ budget: 'any', vegetarian: false, avoid: 'ovo' }).some((m) => m.items.join(' ').includes('ovo'))).toBe(false);
  });
});

describe('análise de foto: normalização da resposta', () => {
  it('monta o pedido só com imagem válida', () => {
    expect(buildMealPhotoRequest('data:image/jpeg;base64,AAAA', ' arroz ')?.note).toBe('arroz');
    expect(buildMealPhotoRequest('https://x.com/a.jpg')).toBeNull();
    expect(buildMealPhotoRequest('data:text/html;base64,AAAA')).toBeNull();
  });
  it('limpa valores inválidos e aceita campos ausentes', () => {
    const r = normalizeMealAnalysis({ identifiable: true, confidence: 'medium', items: [{ name: 'Arroz', quantity: 150, unit: 'g', kcal: 195 }, { name: '', kcal: 5 }, { name: 'Ovo', kcal: -5, proteinG: 'abc' }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(2);
      expect(r.items[1].kcal).toBeUndefined();
      expect(r.items[1].proteinG).toBeUndefined();
      expect(r.confidence).toBe('medium');
    }
  });
  it('imagem não identificável e respostas inválidas viram falha explicada', () => {
    const a = normalizeMealAnalysis({ identifiable: false, reason: 'Foto desfocada', items: [] });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe('Foto desfocada');
    expect(normalizeMealAnalysis(null).ok).toBe(false);
    expect(normalizeMealAnalysis({ identifiable: true, items: [] }).ok).toBe(false);
    expect(normalizeMealAnalysis({ identifiable: true, items: 'x' }).ok).toBe(false);
  });
  it('sugestões da IA são validadas', () => {
    expect(normalizeSuggestions({ ideas: [{ title: 'Ovo', items: ['ovo', 'pão'] }, { title: '', items: [] }], note: 'ok' }).ok).toBe(true);
    expect(normalizeSuggestions({ ideas: [] }).ok).toBe(false);
    expect(normalizeSuggestions(undefined).ok).toBe(false);
  });
});
