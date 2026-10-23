import type { EquipmentId } from './training';
import type { MuscleGroup } from './types';

/**
 * Biblioteca local de exercícios, usada pelo gerador sem IA, pelas alternativas
 * e para substituições. Instruções curtas e conservadoras.
 */

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'glutes'
  | 'push-h'
  | 'push-v'
  | 'pull-h'
  | 'pull-v'
  | 'core'
  | 'biceps'
  | 'triceps'
  | 'delts'
  | 'calves';

/** Região que o exercício pode sobrecarregar: usada para respeitar limitações informadas. */
export type Stress = 'shoulder' | 'knee' | 'lowback' | 'wrist';

/** 'bodyweight' não exige nada; 'gym' exige academia (máquinas, polias, barras). */
export type Requirement = 'bodyweight' | 'gym' | EquipmentId;

export interface LibraryExercise {
  id: string;
  name: string;
  pattern: Pattern;
  muscles: MuscleGroup[];
  requires: Requirement[];
  stress: Stress[];
  /** Quando definido, substitui as repetições padrão (ex.: prancha em segundos). */
  reps?: string;
  compound: boolean;
  instructions: string;
}

const L = (e: LibraryExercise): LibraryExercise => e;

export const LIBRARY: LibraryExercise[] = [
  // Agachamento
  L({ id: 'bodyweight-squat', name: 'Agachamento livre', pattern: 'squat', muscles: ['quadriceps', 'glutes'], requires: ['bodyweight'], stress: ['knee'], compound: true, instructions: 'Pés na largura dos ombros, desça como se fosse sentar, coluna neutra e joelhos na direção dos pés. Suba empurrando o chão.' }),
  L({ id: 'goblet-squat', name: 'Agachamento goblet', pattern: 'squat', muscles: ['quadriceps', 'glutes'], requires: ['dumbbell'], stress: ['knee'], compound: true, instructions: 'Segure um halter junto ao peito, cotovelos para baixo. Desça controlado até onde mantiver a coluna reta e suba.' }),
  L({ id: 'leg-press', name: 'Leg press', pattern: 'squat', muscles: ['quadriceps', 'glutes'], requires: ['gym'], stress: ['knee'], compound: true, instructions: 'Costas apoiadas, pés na largura dos ombros. Desça até cerca de 90° nos joelhos e empurre sem travar os joelhos no final.' }),
  L({ id: 'back-squat', name: 'Agachamento com barra', pattern: 'squat', muscles: ['quadriceps', 'glutes'], requires: ['gym'], stress: ['knee', 'lowback'], compound: true, instructions: 'Barra apoiada nas costas, abdômen firme. Desça controlado mantendo o tronco estável e suba sem arredondar a lombar. Peça ajuda se estiver aprendendo.' }),
  L({ id: 'kb-squat', name: 'Agachamento com kettlebell', pattern: 'squat', muscles: ['quadriceps', 'glutes'], requires: ['kettlebell'], stress: ['knee'], compound: true, instructions: 'Segure o kettlebell junto ao peito. Desça com o tronco ereto e suba empurrando o chão.' }),
  // Terra / posteriores
  L({ id: 'rdl-db', name: 'Terra romeno com halteres', pattern: 'hinge', muscles: ['hamstrings', 'glutes', 'back'], requires: ['dumbbell'], stress: ['lowback'], compound: true, instructions: 'Joelhos levemente flexionados, leve os quadris para trás com as costas retas e os halteres próximos às pernas. Volte contraindo os glúteos.' }),
  L({ id: 'kb-deadlift', name: 'Terra com kettlebell', pattern: 'hinge', muscles: ['hamstrings', 'glutes', 'back'], requires: ['kettlebell'], stress: ['lowback'], compound: true, instructions: 'Kettlebell entre os pés, quadris para trás, costas retas. Levante empurrando o chão e estendendo o quadril.' }),
  L({ id: 'barbell-deadlift', name: 'Levantamento terra', pattern: 'hinge', muscles: ['hamstrings', 'glutes', 'back'], requires: ['gym'], stress: ['lowback'], compound: true, instructions: 'Barra rente às pernas, costas neutras. Empurre o chão e estenda o quadril ao mesmo tempo. Comece leve e priorize a técnica.' }),
  L({ id: 'leg-curl', name: 'Mesa flexora', pattern: 'hinge', muscles: ['hamstrings'], requires: ['gym'], stress: [], compound: false, instructions: 'Ajuste o apoio nos tornozelos e flexione os joelhos de forma controlada, sem tirar o quadril do banco.' }),
  // Glúteos
  L({ id: 'glute-bridge', name: 'Ponte de glúteos', pattern: 'glutes', muscles: ['glutes', 'hamstrings'], requires: ['bodyweight'], stress: [], compound: false, instructions: 'Deitado, joelhos dobrados. Suba o quadril contraindo os glúteos até alinhar ombros, quadril e joelhos. Desça devagar.' }),
  L({ id: 'hip-thrust-db', name: 'Elevação de quadril com halter', pattern: 'glutes', muscles: ['glutes', 'hamstrings'], requires: ['dumbbell'], stress: [], compound: false, instructions: 'Apoie as costas no chão ou banco, halter sobre o quadril. Suba contraindo os glúteos, sem arquear a lombar.' }),
  // Afundo
  L({ id: 'lunge', name: 'Afundo alternado', pattern: 'lunge', muscles: ['quadriceps', 'glutes'], requires: ['bodyweight'], stress: ['knee'], compound: true, instructions: 'Dê um passo à frente e desça até os dois joelhos formarem cerca de 90°. Empurre o chão para voltar e alterne as pernas.' }),
  L({ id: 'db-lunge', name: 'Afundo com halteres', pattern: 'lunge', muscles: ['quadriceps', 'glutes'], requires: ['dumbbell'], stress: ['knee'], compound: true, instructions: 'Halteres ao lado do corpo. Dê um passo, desça controlado com o tronco ereto e volte empurrando o chão.' }),
  L({ id: 'step-up', name: 'Subida no banco', pattern: 'lunge', muscles: ['quadriceps', 'glutes'], requires: ['bench'], stress: ['knee'], compound: true, instructions: 'Apoie o pé inteiro no banco e suba usando a perna da frente, sem impulso da perna de trás. Desça com controle.' }),
  L({ id: 'split-squat', name: 'Agachamento búlgaro', pattern: 'lunge', muscles: ['quadriceps', 'glutes'], requires: ['bench'], stress: ['knee'], compound: true, instructions: 'Pé de trás apoiado no banco. Desça na vertical, com o tronco ereto, e suba empurrando o pé da frente.' }),
  // Empurrar horizontal
  L({ id: 'knee-pushup', name: 'Flexão com joelhos apoiados', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['bodyweight'], stress: ['wrist'], compound: true, instructions: 'Mãos um pouco mais abertas que os ombros, corpo alinhado dos joelhos à cabeça. Desça o peito perto do chão e empurre.' }),
  L({ id: 'incline-pushup', name: 'Flexão inclinada', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['bench'], stress: ['wrist'], compound: true, instructions: 'Mãos apoiadas no banco, corpo em linha reta. Desça o peito até o banco e empurre.' }),
  L({ id: 'pushup', name: 'Flexão de braços', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['bodyweight'], stress: ['wrist', 'shoulder'], compound: true, instructions: 'Corpo em prancha, abdômen firme. Desça até o peito quase tocar o chão e empurre sem arquear a lombar.' }),
  L({ id: 'db-bench-press', name: 'Supino com halteres', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['dumbbell', 'bench'], stress: ['shoulder'], compound: true, instructions: 'Deitado no banco, halteres na linha do peito. Empurre para cima sem bater os halteres e desça com controle.' }),
  L({ id: 'machine-chest-press', name: 'Supino na máquina', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['gym'], stress: ['shoulder'], compound: true, instructions: 'Ajuste o banco para as pegadas ficarem na altura do peito. Empurre sem travar os cotovelos e volte devagar.' }),
  L({ id: 'bench-press', name: 'Supino reto com barra', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['gym'], stress: ['shoulder'], compound: true, instructions: 'Escápulas juntas e firmes no banco, pés no chão. Desça a barra até o peito e empurre. Use um parceiro ou os apoios de segurança.' }),
  L({ id: 'band-chest-press', name: 'Supino com elástico', pattern: 'push-h', muscles: ['chest', 'triceps', 'shoulders'], requires: ['band'], stress: [], compound: true, instructions: 'Elástico preso atrás das costas, mãos na altura do peito. Estenda os braços à frente e volte devagar.' }),
  // Empurrar vertical
  L({ id: 'db-shoulder-press', name: 'Desenvolvimento com halteres', pattern: 'push-v', muscles: ['shoulders', 'triceps'], requires: ['dumbbell'], stress: ['shoulder'], compound: true, instructions: 'Halteres na altura dos ombros. Empurre para cima sem arquear a lombar e desça até os cotovelos formarem 90°.' }),
  L({ id: 'machine-shoulder-press', name: 'Desenvolvimento na máquina', pattern: 'push-v', muscles: ['shoulders', 'triceps'], requires: ['gym'], stress: ['shoulder'], compound: true, instructions: 'Ajuste o banco para as pegadas ficarem na altura dos ombros. Empurre para cima com o abdômen firme.' }),
  L({ id: 'band-shoulder-press', name: 'Desenvolvimento com elástico', pattern: 'push-v', muscles: ['shoulders', 'triceps'], requires: ['band'], stress: ['shoulder'], compound: true, instructions: 'Pise no elástico, mãos na altura dos ombros. Estenda os braços para cima e volte com controle.' }),
  L({ id: 'pike-pushup', name: 'Flexão em pico', pattern: 'push-v', muscles: ['shoulders', 'triceps'], requires: ['bodyweight'], stress: ['shoulder', 'wrist'], compound: true, instructions: 'Quadril alto, corpo em "V" invertido. Dobre os cotovelos levando a cabeça ao chão e empurre.' }),
  // Puxar horizontal
  L({ id: 'db-row', name: 'Remada com halter', pattern: 'pull-h', muscles: ['back', 'biceps'], requires: ['dumbbell'], stress: ['lowback'], compound: true, instructions: 'Apoie uma mão e o joelho no banco ou numa superfície firme. Puxe o halter em direção ao quadril, cotovelo junto ao corpo.' }),
  L({ id: 'seated-row', name: 'Remada sentada na máquina', pattern: 'pull-h', muscles: ['back', 'biceps'], requires: ['gym'], stress: [], compound: true, instructions: 'Peito apoiado, ombros para baixo. Puxe levando os cotovelos para trás e volte controlando.' }),
  L({ id: 'band-row', name: 'Remada com elástico', pattern: 'pull-h', muscles: ['back', 'biceps'], requires: ['band'], stress: [], compound: true, instructions: 'Elástico preso à frente. Puxe os cotovelos para trás juntando as escápulas e volte devagar.' }),
  L({ id: 'inverted-row', name: 'Remada invertida', pattern: 'pull-h', muscles: ['back', 'biceps'], requires: ['pullup'], stress: ['wrist'], compound: true, instructions: 'Deitado sob uma barra baixa e firme, corpo reto. Puxe o peito até a barra e desça controlado.' }),
  // Puxar vertical
  L({ id: 'lat-pulldown', name: 'Puxada na frente', pattern: 'pull-v', muscles: ['back', 'biceps'], requires: ['gym'], stress: ['shoulder'], compound: true, instructions: 'Puxe a barra até a altura do queixo, levando os cotovelos para baixo e para trás. Volte devagar.' }),
  L({ id: 'pullup', name: 'Barra fixa', pattern: 'pull-v', muscles: ['back', 'biceps'], requires: ['pullup'], stress: ['shoulder'], compound: true, instructions: 'Pendurado, ombros para baixo. Puxe o queixo acima da barra e desça controlado. Use elástico de apoio se necessário.' }),
  L({ id: 'band-pulldown', name: 'Puxada com elástico', pattern: 'pull-v', muscles: ['back', 'biceps'], requires: ['band'], stress: [], compound: true, instructions: 'Elástico preso no alto. Puxe até a altura do peito, cotovelos para baixo, e volte devagar.' }),
  // Core
  L({ id: 'plank', name: 'Prancha', pattern: 'core', muscles: ['abs'], requires: ['bodyweight'], stress: ['wrist'], reps: '20-40 s', compound: false, instructions: 'Antebraços no chão, corpo em linha reta, abdômen e glúteos firmes. Respire normalmente e pare se a lombar incomodar.' }),
  L({ id: 'dead-bug', name: 'Dead bug', pattern: 'core', muscles: ['abs'], requires: ['bodyweight'], stress: [], reps: '8-12', compound: false, instructions: 'Deitado, braços e pernas para cima. Estenda braço e perna opostos devagar, sem desgrudar a lombar do chão.' }),
  L({ id: 'bird-dog', name: 'Bird dog', pattern: 'core', muscles: ['abs', 'back'], requires: ['bodyweight'], stress: [], reps: '8-12', compound: false, instructions: 'Em quatro apoios, estenda braço e perna opostos mantendo o quadril parado. Volte e alterne.' }),
  L({ id: 'crunch', name: 'Abdominal curto', pattern: 'core', muscles: ['abs'], requires: ['bodyweight'], stress: [], reps: '12-20', compound: false, instructions: 'Deitado, joelhos dobrados. Levante só os ombros do chão contraindo o abdômen, sem puxar o pescoço.' }),
  L({ id: 'pallof', name: 'Pallof press com elástico', pattern: 'core', muscles: ['abs'], requires: ['band'], stress: [], reps: '10-12', compound: false, instructions: 'De lado para o ponto de fixação, estenda os braços à frente resistindo à rotação do tronco.' }),
  // Braços e ombros
  L({ id: 'db-curl', name: 'Rosca direta com halteres', pattern: 'biceps', muscles: ['biceps', 'forearms'], requires: ['dumbbell'], stress: [], compound: false, instructions: 'Cotovelos junto ao corpo. Flexione sem balançar o tronco e desça devagar.' }),
  L({ id: 'band-curl', name: 'Rosca com elástico', pattern: 'biceps', muscles: ['biceps', 'forearms'], requires: ['band'], stress: [], compound: false, instructions: 'Pise no elástico e flexione os cotovelos mantendo-os junto ao corpo.' }),
  L({ id: 'cable-curl', name: 'Rosca na polia', pattern: 'biceps', muscles: ['biceps', 'forearms'], requires: ['gym'], stress: [], compound: false, instructions: 'Cotovelos fixos ao lado do corpo. Flexione sem balançar e volte devagar.' }),
  L({ id: 'triceps-pushdown', name: 'Tríceps na polia', pattern: 'triceps', muscles: ['triceps'], requires: ['gym'], stress: [], compound: false, instructions: 'Cotovelos junto ao corpo. Estenda os braços para baixo sem mover os ombros e volte controlando.' }),
  L({ id: 'db-triceps-extension', name: 'Tríceps francês com halter', pattern: 'triceps', muscles: ['triceps'], requires: ['dumbbell'], stress: ['shoulder'], compound: false, instructions: 'Segure um halter com as duas mãos acima da cabeça. Dobre os cotovelos levando-o atrás da cabeça e estenda.' }),
  L({ id: 'bench-dip', name: 'Mergulho no banco', pattern: 'triceps', muscles: ['triceps', 'chest'], requires: ['bench'], stress: ['shoulder', 'wrist'], compound: false, instructions: 'Mãos no banco atrás do corpo. Dobre os cotovelos até cerca de 90° e empurre. Pare se o ombro incomodar.' }),
  L({ id: 'lateral-raise', name: 'Elevação lateral', pattern: 'delts', muscles: ['shoulders'], requires: ['dumbbell'], stress: ['shoulder'], compound: false, instructions: 'Halteres leves ao lado do corpo. Eleve os braços até a altura dos ombros, cotovelos levemente flexionados, e desça devagar.' }),
  L({ id: 'band-face-pull', name: 'Face pull com elástico', pattern: 'delts', muscles: ['shoulders', 'back'], requires: ['band'], stress: [], compound: false, instructions: 'Elástico na altura do rosto. Puxe em direção ao rosto abrindo os cotovelos e volte devagar.' }),
  // Panturrilha
  L({ id: 'calf-raise', name: 'Elevação de panturrilha', pattern: 'calves', muscles: ['calves'], requires: ['bodyweight'], stress: [], reps: '12-20', compound: false, instructions: 'Em pé, suba na ponta dos pés, segure um instante e desça devagar. Apoie a mão na parede se precisar.' }),
];

export const LIBRARY_BY_ID: Record<string, LibraryExercise> = Object.fromEntries(LIBRARY.map((e) => [e.id, e]));

/** Equipamentos realmente disponíveis em um local de treino. */
export function allowedRequirements(place: 'gym' | 'home', equipment: EquipmentId[]): Set<Requirement> {
  const allowed = new Set<Requirement>(['bodyweight']);
  if (place === 'gym') {
    allowed.add('gym');
    // Academia: halteres, banco, barra fixa, elástico e kettlebell são considerados disponíveis.
    for (const e of ['dumbbell', 'bench', 'pullup', 'band', 'kettlebell'] as const) allowed.add(e);
  } else {
    for (const e of equipment) allowed.add(e);
  }
  return allowed;
}

export function isAvailable(ex: LibraryExercise, allowed: Set<Requirement>): boolean {
  return ex.requires.every((r) => allowed.has(r));
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Termos de preferência separados por vírgula, ponto e vírgula ou quebra de linha. */
export function splitTerms(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((t) => normalizeText(t))
    .filter((t) => t.length >= 3);
}

/** O exercício (ou seu padrão) é mencionado em um texto livre de preferências? */
export function matchesTerms(ex: { name: string; muscles?: MuscleGroup[] }, terms: string[]): boolean {
  const name = normalizeText(ex.name);
  return terms.some((t) => name.includes(t) || t.includes(name));
}

const STRESS_KEYWORDS: Array<[Stress, string[]]> = [
  ['shoulder', ['ombro', 'manguito', 'clavicula']],
  ['knee', ['joelho', 'menisco', 'patela', 'ligamento']],
  ['lowback', ['lombar', 'coluna', 'costas', 'hernia', 'ciatic']],
  ['wrist', ['punho', 'pulso', 'tunel do carpo', 'mao']],
];

/** Regiões citadas no texto de limitações (para evitar exercícios que sobrecarreguem a área). */
export function stressFromText(text: string): Set<Stress> {
  const t = normalizeText(text);
  const found = new Set<Stress>();
  for (const [stress, words] of STRESS_KEYWORDS) {
    if (words.some((w) => t.includes(w))) found.add(stress);
  }
  return found;
}
