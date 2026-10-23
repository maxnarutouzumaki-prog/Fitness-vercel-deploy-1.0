import { ART_ALL } from './exerciseArt';
import type { ExerciseArt } from './exerciseArt';
import { LIBRARY, normalizeText } from './exerciseLibrary';
import type { Requirement } from './exerciseLibrary';
import type { Alternative } from './training';
import type { MuscleGroup } from './types';

export type ExerciseKind = 'strength' | 'cardio' | 'mobility';

export interface CatalogExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  muscles: MuscleGroup[];
  instructions: string;
  sets: number;
  /** "8-12", "10", "30-45 s", "20 min". */
  reps: string;
  restSeconds: number;
  equipment: string;
}

const REQ_LABEL: Record<string, string> = {
  bodyweight: 'Peso do corpo',
  gym: 'Academia',
  dumbbell: 'Halteres',
  band: 'Elástico',
  pullup: 'Barra fixa',
  bench: 'Banco',
  kettlebell: 'Kettlebell',
};
const equipmentOf = (req: Requirement[]) => req.map((r) => REQ_LABEL[r] ?? r).join(' + ');

const fromLibrary: CatalogExercise[] = LIBRARY.map((e) => ({
  id: e.id,
  name: e.name,
  kind: 'strength' as const,
  muscles: e.muscles,
  instructions: e.instructions,
  sets: 3,
  reps: e.reps ?? (e.compound ? '8-12' : '10-15'),
  restSeconds: e.compound ? 90 : 60,
  equipment: equipmentOf(e.requires),
}));

const X = (
  id: string,
  name: string,
  muscles: MuscleGroup[],
  equipment: string,
  instructions: string,
  o: Partial<Pick<CatalogExercise, 'kind' | 'sets' | 'reps' | 'restSeconds'>> = {},
): CatalogExercise => ({ id, name, kind: o.kind ?? 'strength', muscles, instructions, sets: o.sets ?? 3, reps: o.reps ?? '10-12', restSeconds: o.restSeconds ?? 60, equipment });

/** Exercícios comuns em fichas de academia que não fazem parte do gerador automático. */
const extras: CatalogExercise[] = [
  X('incline-bench-press', 'Supino inclinado com barra', ['chest', 'shoulders', 'triceps'], 'Academia', 'Banco inclinado (cerca de 30–45°). Desça a barra até a parte alta do peito, controlado, e empurre sem travar os cotovelos.', { reps: '8-12', restSeconds: 90 }),
  X('incline-db-press', 'Supino inclinado com halteres', ['chest', 'shoulders', 'triceps'], 'Halteres + banco', 'Banco inclinado, halteres na altura do peito. Empurre para cima aproximando os halteres e volte devagar.', { reps: '8-12', restSeconds: 90 }),
  X('db-fly', 'Crucifixo com halteres', ['chest'], 'Halteres + banco', 'Deitado, braços quase estendidos com leve flexão dos cotovelos. Abra em arco até sentir o peito alongar e feche sem bater os halteres.', { reps: '10-15' }),
  X('cable-crossover', 'Crucifixo na polia (cross-over)', ['chest'], 'Academia', 'Em pé entre as polias, cotovelos levemente flexionados. Traga as mãos à frente do corpo em arco, apertando o peito.', { reps: '10-15' }),
  X('pec-deck', 'Voador (peck deck)', ['chest'], 'Academia', 'Sentado, costas apoiadas. Feche os braços à frente do peito sem projetar os ombros e volte com controle.', { reps: '10-15' }),
  X('barbell-ohp', 'Desenvolvimento com barra', ['shoulders', 'triceps'], 'Academia', 'Em pé, barra na altura dos ombros. Empurre para cima sem arquear a lombar e desça controlado.', { reps: '6-10', restSeconds: 90 }),
  X('front-raise', 'Elevação frontal', ['shoulders'], 'Halteres', 'Em pé, braços estendidos à frente. Suba até a altura dos ombros e desça devagar, sem balançar o tronco.', { reps: '10-15' }),
  X('straight-arm-pulldown', 'Pulldown com braços estendidos', ['back'], 'Academia', 'Em pé diante da polia alta, braços quase retos. Leve a barra até as coxas contraindo as costas.', { reps: '10-15' }),
  X('barbell-row', 'Remada curvada com barra', ['back', 'biceps'], 'Academia', 'Tronco inclinado com a coluna neutra. Leve a barra em direção ao abdômen, cotovelos junto ao corpo, e desça controlado.', { reps: '8-12', restSeconds: 90 }),
  X('barbell-curl', 'Rosca direta com barra', ['biceps', 'forearms'], 'Academia', 'Em pé, cotovelos junto ao tronco. Flexione os cotovelos até contrair o bíceps e desça devagar sem balançar.', { reps: '8-12' }),
  X('hammer-curl', 'Rosca martelo', ['biceps', 'forearms'], 'Halteres', 'Pegada neutra (palmas voltadas uma para a outra). Flexione os cotovelos mantendo-os junto ao corpo.', { reps: '10-12' }),
  X('preacher-curl', 'Rosca Scott', ['biceps'], 'Academia', 'Braços apoiados no banco Scott. Flexione sem tirar os cotovelos do apoio e desça até quase estender.', { reps: '8-12' }),
  X('skull-crusher', 'Tríceps testa', ['triceps'], 'Banco + barra ou halteres', 'Deitado, cotovelos apontando para cima. Dobre apenas os cotovelos levando o peso em direção à testa e estenda.', { reps: '8-12' }),
  X('triceps-kickback', 'Tríceps coice', ['triceps'], 'Halteres', 'Tronco inclinado, cotovelo junto ao corpo. Estenda o antebraço para trás e volte devagar.', { reps: '10-15' }),
  X('leg-extension', 'Cadeira extensora', ['quadriceps'], 'Academia', 'Sentado, costas apoiadas. Estenda os joelhos sem travar no final e desça controlado.', { reps: '10-15' }),
  X('side-plank', 'Prancha lateral', ['abs'], 'Peso do corpo', 'Apoiado no antebraço e na lateral do pé, quadril alinhado. Mantenha o abdômen firme pelo tempo indicado.', { reps: '20-40 s', restSeconds: 45 }),
  X('leg-raise', 'Elevação de pernas', ['abs'], 'Peso do corpo', 'Deitado, lombar apoiada. Suba as pernas juntas até a vertical e desça devagar sem arquear a lombar.', { reps: '10-15', restSeconds: 45 }),
  X('running', 'Corrida', ['cardio'], 'Peso do corpo', 'Ritmo em que ainda consiga falar frases curtas. Comece devagar e aumente o tempo aos poucos.', { kind: 'cardio', sets: 1, reps: '20 min', restSeconds: 0 }),
  X('walking', 'Caminhada', ['cardio'], 'Peso do corpo', 'Passo firme e postura ereta, respirando de forma confortável.', { kind: 'cardio', sets: 1, reps: '30 min', restSeconds: 0 }),
  X('treadmill', 'Esteira', ['cardio'], 'Academia', 'Comece com aquecimento leve, ajuste a velocidade ao seu nível e evite se segurar nas barras.', { kind: 'cardio', sets: 1, reps: '20 min', restSeconds: 0 }),
  X('cycling', 'Bicicleta', ['cardio', 'quadriceps'], 'Academia', 'Ajuste o banco para que o joelho fique levemente flexionado na pedalada. Mantenha cadência confortável.', { kind: 'cardio', sets: 1, reps: '20 min', restSeconds: 0 }),
  X('jumping-jacks', 'Polichinelo', ['cardio', 'full-body'], 'Peso do corpo', 'Salte abrindo pernas e braços e volte à posição inicial em ritmo constante, com pouso suave.', { kind: 'cardio', sets: 3, reps: '30 s', restSeconds: 30 }),
  X('jump-rope', 'Pular corda', ['cardio', 'calves'], 'Corda', 'Saltos pequenos e leves, punhos fazem o giro. Pare se sentir dor.', { kind: 'cardio', sets: 3, reps: '45 s', restSeconds: 30 }),
  X('rowing-machine', 'Remo (ergômetro)', ['cardio', 'back'], 'Academia', 'Empurre com as pernas, incline o tronco e puxe com os braços; volte na ordem inversa, de forma fluida.', { kind: 'cardio', sets: 1, reps: '15 min', restSeconds: 0 }),
  X('cat-cow', 'Gato-vaca', ['back', 'abs'], 'Peso do corpo', 'Em quatro apoios, alterne arredondar e estender suavemente a coluna, acompanhando a respiração.', { kind: 'mobility', sets: 2, reps: '10', restSeconds: 20 }),
  X('hip-flexor-stretch', 'Alongamento do flexor do quadril', ['quadriceps', 'glutes'], 'Peso do corpo', 'Em afundo com o joelho de trás no chão, leve o quadril à frente até sentir alongar a frente do quadril. Sem dor.', { kind: 'mobility', sets: 2, reps: '30 s', restSeconds: 15 }),
  X('hamstring-stretch', 'Alongamento de posteriores', ['hamstrings'], 'Peso do corpo', 'Em pé, incline o tronco à frente com os joelhos levemente flexionados até sentir alongar a parte de trás das coxas.', { kind: 'mobility', sets: 2, reps: '30 s', restSeconds: 15 }),
  X('quad-stretch', 'Alongamento de quadríceps', ['quadriceps'], 'Peso do corpo', 'Em pé, apoie-se e leve o calcanhar em direção ao glúteo mantendo os joelhos juntos.', { kind: 'mobility', sets: 2, reps: '30 s', restSeconds: 15 }),
  X('calf-stretch', 'Alongamento de panturrilha na parede', ['calves'], 'Peso do corpo', 'Mãos na parede, uma perna atrás com o calcanhar no chão. Incline o corpo até sentir alongar a panturrilha.', { kind: 'mobility', sets: 2, reps: '30 s', restSeconds: 15 }),
  X('thoracic-rotation', 'Rotação torácica', ['back'], 'Peso do corpo', 'Em quatro apoios, mão atrás da cabeça: gire o tronco abrindo o cotovelo para cima e volte devagar.', { kind: 'mobility', sets: 2, reps: '8', restSeconds: 15 }),
  X('shoulder-circles', 'Círculos de braço (mobilidade de ombros)', ['shoulders'], 'Peso do corpo', 'Braços abertos na altura dos ombros, faça círculos pequenos e controlados nos dois sentidos.', { kind: 'mobility', sets: 2, reps: '10', restSeconds: 15 }),
];

export const CATALOG: CatalogExercise[] = [...fromLibrary, ...extras];

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function findCatalog(id: string | undefined): CatalogExercise | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function artFor(id: string | undefined): ExerciseArt | null {
  return (id && ART_ALL[id]) || null;
}

export const KIND_LABELS: Record<ExerciseKind, string> = { strength: 'Força', cardio: 'Cardio', mobility: 'Mobilidade' };

/** Busca por nome (sem acentos) e, opcionalmente, por grupo muscular ou tipo. */
export function searchCatalog(query: string, filter?: { muscle?: MuscleGroup; kind?: ExerciseKind }): CatalogExercise[] {
  const q = normalizeText(query);
  return CATALOG.filter((e) => {
    if (filter?.muscle && !e.muscles.includes(filter.muscle)) return false;
    if (filter?.kind && e.kind !== filter.kind) return false;
    return q === '' || normalizeText(e.name).includes(q);
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Alternativas para substituir um exercício: mesmo grupo principal, mesmo tipo, sem repetir. */
export function alternativesFor(muscles: MuscleGroup[], excludeKey: string, limit = 3, kind: ExerciseKind = 'strength'): Alternative[] {
  const main = muscles[0];
  if (!main) return [];
  return CATALOG.filter((e) => e.id !== excludeKey && e.kind === kind && e.muscles[0] === main)
    .slice(0, limit)
    .map((e) => ({ key: e.id, name: e.name, muscles: e.muscles, instructions: e.instructions, libraryId: e.id }));
}

/** Rótulo da coluna de repetições conforme o tipo do exercício e a meta ("20 min", "30 s", "10"). */
export function repsUnitLabel(kind: ExerciseKind, targetReps: string): string {
  const t = targetReps.toLowerCase();
  if (kind === 'strength' && !/\bmin\b|\bs\b|seg/.test(t)) return 'Repetições';
  if (/\bmin\b/.test(t)) return 'Minutos';
  if (/\bs\b|seg/.test(t)) return 'Segundos';
  return kind === 'strength' ? 'Repetições' : 'Duração';
}

/** Tipo de um exercício registrado a partir da chave (biblioteca, "c-<id>" personalizado ou manual). */
export function kindForKey(key: string, customs: Array<{ id: string; kind: ExerciseKind }>): ExerciseKind {
  const cat = findCatalog(key);
  if (cat) return cat.kind;
  if (key.startsWith('c-')) return customs.find((c) => c.id === key.slice(2))?.kind ?? 'strength';
  return 'strength';
}
