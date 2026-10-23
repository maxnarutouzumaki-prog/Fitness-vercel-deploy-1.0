import type { Pose, Prop, SidePose } from './figure';

/**
 * Ilustrações esquemáticas dos exercícios (duas posições: início e fim).
 * Desenhos próprios do app: não são fotos. Cada id do catálogo tem um desenho ou um estado
 * alternativo explícito (ver catalog.ts).
 */
export interface ExerciseArt {
  frames: Pose[];
  /** Quadro usado na miniatura (padrão: o último). */
  thumb?: number;
}

const A = (x: number, y: number) => ({ joint: 'ankle' as const, x, y });
const H = (x: number, y: number) => ({ joint: 'hip' as const, x, y });
const W = (x: number, y: number) => ({ joint: 'wrist' as const, x, y });
const K = (x: number, y: number) => ({ joint: 'knee' as const, x, y });

const stand = (o: Partial<SidePose> = {}): SidePose => ({ anchor: A(46, 86), torso: 180, uArm: 6, fArm: 14, thigh: 0, shin: 0, ...o });
const plate = (r = 4): Prop => ({ k: 'plate', at: 'wrist', r });
const db: Prop = { k: 'plate', at: 'wrist', r: 3.5 };
const dbH: Prop = { k: 'dumbbell', at: 'wrist' };
const bar = (r = 5): Prop => ({ k: 'plate', at: 'wrist', r });
const benchFlat = (x1 = 14, x2 = 74, y = 70): Prop[] => [
  { k: 'rect', x: x1, y, w: x2 - x1, h: 3, r: 1 },
  { k: 'line', x1: x1 + 4, y1: y + 3, x2: x1 + 4, y2: 90 },
  { k: 'line', x1: x2 - 4, y1: y + 3, x2: x2 - 4, y2: 90 },
];
const seat = (x1: number, x2: number, y = 74): Prop[] => [
  { k: 'rect', x: x1, y, w: x2 - x1, h: 3, r: 1 },
  { k: 'line', x1: (x1 + x2) / 2, y1: y + 3, x2: (x1 + x2) / 2, y2: 90 },
];
const backPad = (x1: number, y1: number, x2: number, y2: number): Prop => ({ k: 'line', x1, y1, x2, y2, w: 3 });
const down = (hold: 'none' | 'plate' | 'db' | 'dbH' | 'bar' = 'none'): Prop[] => (hold === 'none' ? [] : hold === 'plate' || hold === 'db' ? [db] : hold === 'bar' ? [bar()] : [dbH]);

// Deitado em banco: quadril em (58,66), tronco para a esquerda
const lyingBench = (o: Partial<SidePose>): SidePose => ({ anchor: H(60, 65), torso: -90, thigh: 100, shin: 'floor', uArm: 180, fArm: 180, ...o });
// Sentado em máquina: quadril em (40,70)
const sitting = (o: Partial<SidePose>): SidePose => ({ anchor: H(40, 70), torso: 178, thigh: 90, shin: 'floor', uArm: 0, fArm: 0, ...o });

export const ART: Record<string, ExerciseArt> = {
  /* ───── Pernas ───── */
  'bodyweight-squat': { frames: [stand({ uArm: 90, fArm: 90 }), stand({ shin: -28, thigh: 78, torso: 150, uArm: 90, fArm: 90 })] },
  'goblet-squat': {
    frames: [stand({ uArm: 20, fArm: 165, props: [db] }), stand({ shin: -22, thigh: 84, torso: 162, uArm: 20, fArm: 165, props: [db] })],
  },
  'kb-squat': {
    frames: [stand({ uArm: 20, fArm: 165, props: [{ k: 'kettlebell', at: 'wrist' }] }), stand({ shin: -22, thigh: 84, torso: 162, uArm: 20, fArm: 165, props: [{ k: 'kettlebell', at: 'wrist' }] })],
  },
  'back-squat': {
    frames: [
      stand({ uArm: -60, fArm: 150, props: [{ k: 'plate', at: 'shoulder', r: 6 }] }),
      stand({ shin: -26, thigh: 80, torso: 148, uArm: -60, fArm: 150, props: [{ k: 'plate', at: 'shoulder', r: 6 }] }),
    ],
  },
  'leg-press': {
    frames: [
      { anchor: H(40, 72), torso: -135, thigh: 145, shin: 55, uArm: 30, fArm: 70, props: [backPad(38, 78, 20, 54), { k: 'line', x1: 32, y1: 78, x2: 48, y2: 78, w: 3 }, { k: 'line', x1: 48, y1: 84, x2: 88, y2: 46, w: 1.5 }, { k: 'line', x1: 80, y1: 70, x2: 66, y2: 56, w: 3 }] },
      { anchor: H(40, 72), torso: -135, thigh: 125, shin: 128, uArm: 30, fArm: 70, props: [backPad(38, 78, 20, 54), { k: 'line', x1: 32, y1: 78, x2: 48, y2: 78, w: 3 }, { k: 'line', x1: 48, y1: 84, x2: 88, y2: 46, w: 1.5 }, { k: 'line', x1: 84, y1: 34, x2: 96, y2: 46, w: 3 }] },
    ],
  },
  'rdl-db': { frames: [stand({ props: [db], uArm: 0, fArm: 0 }), stand({ thigh: 12, shin: -10, torso: 128, props: [db] })] },
  'kb-deadlift': {
    frames: [
      stand({ thigh: 52, shin: -35, torso: 122, uArm: 10, fArm: 0, props: [{ k: 'kettlebell', at: 'wrist' }] }),
      stand({ props: [{ k: 'kettlebell', at: 'wrist' }] }),
    ],
  },
  'barbell-deadlift': {
    frames: [stand({ thigh: 52, shin: -32, torso: 124, uArm: 10, fArm: 0, props: [bar(7)] }), stand({ props: [bar(7)] })],
  },
  'leg-curl': {
    frames: [
      { anchor: H(40, 64), torso: -90, thigh: 90, shin: 93, uArm: -60, fArm: 20, props: [...benchFlat(18, 62, 70), { k: 'rect', x: 62, y: 60, w: 5, h: 8, r: 2 }] },
      { anchor: H(40, 64), torso: -90, thigh: 90, shin: 165, uArm: -60, fArm: 20, props: [...benchFlat(18, 62, 70), { k: 'rect', x: 64, y: 46, w: 5, h: 8, r: 2 }] },
    ],
  },
  'leg-extension': {
    frames: [
      sitting({ shin: 0, props: [...seat(24, 50), backPad(34, 72, 30, 40), { k: 'rect', x: 44, y: 78, w: 5, h: 7, r: 2 }] }),
      sitting({ shin: 88, props: [...seat(24, 50), backPad(34, 72, 30, 40), { k: 'rect', x: 74, y: 62, w: 5, h: 7, r: 2 }] }),
    ],
  },
  'glute-bridge': {
    frames: [
      { anchor: H(46, 84), torso: -90, thigh: 140, shin: 'floor', uArm: 90, fArm: 90 },
      { anchor: H(46, 70), torso: -62, thigh: 118, shin: 'floor', uArm: 90, fArm: 90 },
    ],
  },
  'hip-thrust-db': {
    frames: [
      { anchor: H(44, 72), torso: -114, thigh: 120, shin: 'floor', uArm: 80, fArm: 90, props: [...benchFlat(4, 24, 64), { k: 'plate', at: 'hip', r: 4 }] },
      { anchor: H(46, 62), torso: -90, thigh: 110, shin: 'floor', uArm: 80, fArm: 90, props: [...benchFlat(4, 24, 64), { k: 'plate', at: 'hip', r: 4 }] },
    ],
  },
  lunge: {
    frames: [
      stand({ anchor: A(46, 86) }),
      stand({ anchor: A(62, 86), thigh: 85, shin: 0, leg2: { thigh: -20, shin: -80 } }),
    ],
  },
  'db-lunge': {
    frames: [
      stand({ anchor: A(46, 86), props: [db] }),
      stand({ anchor: A(62, 86), thigh: 85, shin: 0, leg2: { thigh: -20, shin: -80 }, props: [db] }),
    ],
  },
  'step-up': {
    frames: [
      stand({ anchor: A(60, 78), thigh: 78, shin: -8, torso: 172, leg2: { thigh: 2, shin: 'floor' }, props: [{ k: 'rect', x: 50, y: 82, w: 30, h: 8, r: 2 }] }),
      stand({ anchor: A(60, 78), leg2: { thigh: 40, shin: -20 }, props: [{ k: 'rect', x: 50, y: 82, w: 30, h: 8, r: 2 }] }),
    ],
  },
  'split-squat': {
    frames: [
      stand({ anchor: A(62, 86), thigh: 18, shin: -4, leg2: { thigh: -22, shin: -118 }, props: benchFlat(4, 26, 66) }),
      stand({ anchor: A(62, 86), thigh: 78, shin: -10, leg2: { thigh: -35, shin: -112 }, props: benchFlat(4, 26, 66) }),
    ],
  },
  'calf-raise': {
    frames: [
      stand({ anchor: A(46.8, 85), foot: 120, props: [{ k: 'rect', x: 49, y: 82, w: 16, h: 8, r: 2 }] }),
      stand({ anchor: A(48.1, 77.4), foot: 40, props: [{ k: 'rect', x: 49, y: 82, w: 16, h: 8, r: 2 }] }),
    ],
  },
};

const benchLying = benchFlat(18, 70, 70);
const inclineBench: Prop[] = [{ k: 'line', x1: 50, y1: 72, x2: 28, y2: 44, w: 3.5 }, { k: 'line', x1: 50, y1: 72, x2: 66, y2: 72, w: 3.5 }, { k: 'line', x1: 58, y1: 72, x2: 58, y2: 90 }, { k: 'line', x1: 32, y1: 50, x2: 32, y2: 90 }];
const cableTop = (x: number): Prop => ({ k: 'cable', to: [x, 6] });
const bandTo = (x: number, y: number): Prop => ({ k: 'cable', to: [x, y], dash: true });

export const ART_MORE: Record<string, ExerciseArt> = {
  /* ───── Peito ───── */
  'bench-press': {
    frames: [lyingBench({ uArm: 180, fArm: 180, props: [...benchLying, bar(6)] }), lyingBench({ uArm: 55, fArm: 180, props: [...benchLying, bar(6)] })],
  },
  'db-bench-press': {
    frames: [lyingBench({ uArm: 180, fArm: 180, props: [...benchLying, db] }), lyingBench({ uArm: 55, fArm: 180, props: [...benchLying, db] })],
  },
  'incline-bench-press': {
    frames: [
      { anchor: H(52, 66), torso: -140, thigh: 100, shin: 'floor', uArm: 180, fArm: 180, props: [...inclineBench, bar(6)] },
      { anchor: H(52, 66), torso: -140, thigh: 100, shin: 'floor', uArm: 80, fArm: 180, props: [...inclineBench, bar(6)] },
    ],
  },
  'incline-db-press': {
    frames: [
      { anchor: H(52, 66), torso: -140, thigh: 100, shin: 'floor', uArm: 180, fArm: 180, props: [...inclineBench, db] },
      { anchor: H(52, 66), torso: -140, thigh: 100, shin: 'floor', uArm: 80, fArm: 180, props: [...inclineBench, db] },
    ],
  },
  'db-fly': {
    frames: [lyingBench({ uArm: 180, fArm: 175, props: [...benchLying, db] }), lyingBench({ uArm: -25, fArm: -40, props: [...benchLying, db] })],
  },
  'machine-chest-press': {
    frames: [
      sitting({ torso: 182, uArm: -50, fArm: 100, props: [...seat(24, 52), backPad(30, 72, 30, 28), plate(3)] }),
      sitting({ torso: 182, uArm: 90, fArm: 90, props: [...seat(24, 52), backPad(30, 72, 30, 28), plate(3)] }),
    ],
  },
  pushup: {
    frames: [
      { anchor: A(12, 84), torso: 105, thigh: -75, shin: -75, foot: 60, uArm: 0, fArm: 0 },
      { anchor: A(12, 84), torso: 97, thigh: -83, shin: -83, foot: 60, uArm: -105, fArm: 15 },
    ],
  },
  'knee-pushup': {
    frames: [
      { anchor: K(26, 86), torso: 105, thigh: -75, shin: -100, foot: 110, uArm: 0, fArm: 0 },
      { anchor: K(26, 86), torso: 97, thigh: -83, shin: -100, foot: 110, uArm: -105, fArm: 15 },
    ],
  },
  'incline-pushup': {
    frames: [
      { anchor: A(10, 86), torso: 130, thigh: -50, shin: -50, foot: 60, uArm: 0, fArm: 0, props: [{ k: 'rect', x: 62, y: 70, w: 26, h: 20, r: 2 }] },
      { anchor: A(10, 86), torso: 122, thigh: -58, shin: -58, foot: 60, uArm: -100, fArm: 20, props: [{ k: 'rect', x: 62, y: 70, w: 26, h: 20, r: 2 }] },
    ],
  },
  'band-chest-press': {
    frames: [
      stand({ torso: 174, uArm: -45, fArm: 95, leg2: { thigh: -25, shin: -15 }, props: [bandTo(4, 38)] }),
      stand({ torso: 174, uArm: 90, fArm: 90, leg2: { thigh: -25, shin: -15 }, props: [bandTo(4, 38)] }),
    ],
  },
  'cable-crossover': {
    frames: [
      { view: 'front', uArm: 70, fArm: 60, leg: 4, props: [{ k: 'cable', to: [8, 8], mirror: true }] },
      { view: 'front', uArm: -8, fArm: -12, leg: 4, props: [{ k: 'cable', to: [8, 8], mirror: true }] },
    ],
  },
  'pec-deck': {
    frames: [
      { view: 'front', seated: true, uArm: 85, fArm: 170, leg: 6, props: [{ k: 'rect', x: 10, y: 20, w: 4, h: 30, r: 2 }, { k: 'rect', x: 86, y: 20, w: 4, h: 30, r: 2 }] },
      { view: 'front', seated: true, uArm: 35, fArm: 175, leg: 6, props: [{ k: 'rect', x: 40, y: 18, w: 4, h: 22, r: 2 }, { k: 'rect', x: 56, y: 18, w: 4, h: 22, r: 2 }] },
    ],
  },

  /* ───── Ombros ───── */
  'db-shoulder-press': {
    frames: [stand({ uArm: 10, fArm: 175, props: [db] }), stand({ uArm: 180, fArm: 180, props: [db] })],
  },
  'machine-shoulder-press': {
    frames: [
      sitting({ uArm: 15, fArm: 175, props: [...seat(24, 52), backPad(30, 72, 30, 22), plate(3)] }),
      sitting({ uArm: 180, fArm: 180, props: [...seat(24, 52), backPad(30, 72, 30, 22), plate(3)] }),
    ],
  },
  'band-shoulder-press': {
    frames: [stand({ uArm: 10, fArm: 175, props: [bandTo(48, 88)] }), stand({ uArm: 180, fArm: 180, props: [bandTo(48, 88)] })],
  },
  'barbell-ohp': {
    frames: [stand({ uArm: 10, fArm: 175, props: [bar(5)] }), stand({ uArm: 180, fArm: 180, props: [bar(5)] })],
  },
  'pike-pushup': {
    frames: [
      { anchor: A(24, 86), torso: 43, thigh: -29, shin: -29, foot: 60, uArm: 0, fArm: 0 },
      { anchor: A(24, 86), torso: 28, thigh: -29, shin: -29, foot: 60, uArm: -70, fArm: 10 },
    ],
  },
  'lateral-raise': {
    frames: [
      { view: 'front', uArm: 8, fArm: 8, leg: 3, props: [{ k: 'dumbbell', at: 'wrist' }] },
      { view: 'front', uArm: 85, fArm: 85, leg: 3, props: [{ k: 'dumbbell', at: 'wrist' }] },
    ],
  },
  'front-raise': {
    frames: [stand({ props: [db] }), stand({ uArm: 90, fArm: 90, props: [db] })],
  },
  'band-face-pull': {
    frames: [
      stand({ torso: 176, uArm: 82, fArm: 82, leg2: { thigh: -20, shin: -10 }, props: [bandTo(96, 22)] }),
      stand({ torso: 176, uArm: -85, fArm: 70, leg2: { thigh: -20, shin: -10 }, props: [bandTo(96, 22)] }),
    ],
  },

  /* ───── Costas ───── */
  'lat-pulldown': {
    frames: [
      sitting({ torso: 190, uArm: 170, fArm: 168, props: [...seat(24, 52), { k: 'rect', x: 40, y: 66, w: 14, h: 3, r: 1 }, cableTop(54), { k: 'line', x1: 40, y1: 6, x2: 68, y2: 6, w: 2 }] }),
      sitting({ torso: 194, uArm: 12, fArm: 150, props: [...seat(24, 52), { k: 'rect', x: 40, y: 66, w: 14, h: 3, r: 1 }, cableTop(54), { k: 'line', x1: 40, y1: 6, x2: 68, y2: 6, w: 2 }] }),
    ],
  },
  pullup: {
    frames: [
      { anchor: W(50, 14), torso: 180, thigh: 5, shin: -40, uArm: 180, fArm: 180, props: [{ k: 'line', x1: 28, y1: 14, x2: 72, y2: 14, w: 3 }] },
      { anchor: W(50, 14), torso: 176, thigh: 5, shin: -40, uArm: 28, fArm: 180, props: [{ k: 'line', x1: 28, y1: 14, x2: 72, y2: 14, w: 3 }] },
    ],
  },
  'band-pulldown': {
    frames: [stand({ uArm: 172, fArm: 172, props: [bandTo(56, 4)] }), stand({ uArm: 12, fArm: 150, props: [bandTo(56, 4)] })],
  },
  'straight-arm-pulldown': {
    frames: [stand({ torso: 172, uArm: 150, fArm: 150, props: [cableTop(66)] }), stand({ torso: 172, uArm: 8, fArm: 8, props: [cableTop(66)] })],
  },
  'db-row': {
    frames: [
      stand({ anchor: A(40, 86), torso: 105, thigh: 15, shin: -10, uArm: 0, fArm: 0, arm2: { uArm: 5, fArm: 5 }, props: [db, ...benchFlat(52, 82, 60)] }),
      stand({ anchor: A(40, 86), torso: 105, thigh: 15, shin: -10, uArm: -75, fArm: 12, arm2: { uArm: 5, fArm: 5 }, props: [db, ...benchFlat(52, 82, 60)] }),
    ],
  },
  'barbell-row': {
    frames: [
      stand({ torso: 122, thigh: 30, shin: -18, uArm: 8, fArm: 8, props: [bar(6)] }),
      stand({ torso: 122, thigh: 30, shin: -18, uArm: -72, fArm: 10, props: [bar(6)] }),
    ],
  },
  'seated-row': {
    frames: [
      sitting({ anchor: H(36, 72), torso: 172, thigh: 84, shin: 12, uArm: 90, fArm: 90, props: [...seat(20, 50, 76), { k: 'cable', to: [96, 68] }, { k: 'line', x1: 54, y1: 80, x2: 66, y2: 80, w: 3 }] }),
      sitting({ anchor: H(36, 72), torso: 186, thigh: 84, shin: 12, uArm: -12, fArm: 88, props: [...seat(20, 50, 76), { k: 'cable', to: [96, 68] }, { k: 'line', x1: 54, y1: 80, x2: 66, y2: 80, w: 3 }] }),
    ],
  },
  'band-row': {
    frames: [
      stand({ torso: 178, uArm: 88, fArm: 88, leg2: { thigh: -22, shin: -12 }, props: [bandTo(96, 52)] }),
      stand({ torso: 178, uArm: -15, fArm: 80, leg2: { thigh: -22, shin: -12 }, props: [bandTo(96, 52)] }),
    ],
  },
  'inverted-row': {
    frames: [
      { anchor: W(26, 40), torso: -110, thigh: 70, shin: 70, foot: 90, uArm: 180, fArm: 180, props: [{ k: 'line', x1: 22, y1: 40, x2: 22, y2: 90 }, { k: 'line', x1: 8, y1: 40, x2: 40, y2: 40, w: 3 }] },
      { anchor: W(26, 40), torso: -128, thigh: 52, shin: 52, foot: 90, uArm: 10, fArm: 180, props: [{ k: 'line', x1: 22, y1: 40, x2: 22, y2: 90 }, { k: 'line', x1: 8, y1: 40, x2: 40, y2: 40, w: 3 }] },
    ],
  },

  /* ───── Bíceps ───── */
  'db-curl': {
    frames: [stand({ arm2: { uArm: 6, fArm: 12 }, props: [db] }), stand({ uArm: 6, fArm: 158, arm2: { uArm: 6, fArm: 12 }, props: [db] })],
  },
  'barbell-curl': {
    frames: [stand({ props: [bar(5)] }), stand({ uArm: 6, fArm: 158, props: [bar(5)] })],
  },
  'hammer-curl': {
    frames: [stand({ props: [dbH] }), stand({ uArm: 6, fArm: 158, props: [dbH] })],
  },
  'cable-curl': {
    frames: [stand({ props: [plate(3), { k: 'cable', to: [86, 86] }] }), stand({ uArm: 6, fArm: 158, props: [plate(3), { k: 'cable', to: [86, 86] }] })],
  },
  'band-curl': {
    frames: [stand({ props: [bandTo(46, 88)] }), stand({ uArm: 6, fArm: 158, props: [bandTo(46, 88)] })],
  },
  'preacher-curl': {
    frames: [
      sitting({ torso: 165, uArm: 70, fArm: 100, props: [...seat(24, 52), { k: 'line', x1: 56, y1: 56, x2: 70, y2: 74, w: 3 }, bar(4)] }),
      sitting({ torso: 165, uArm: 70, fArm: 175, props: [...seat(24, 52), { k: 'line', x1: 56, y1: 56, x2: 70, y2: 74, w: 3 }, bar(4)] }),
    ],
  },

  /* ───── Tríceps ───── */
  'triceps-pushdown': {
    frames: [
      stand({ torso: 176, uArm: 8, fArm: 120, props: [cableTop(54), plate(3)] }),
      stand({ torso: 176, uArm: 6, fArm: 8, props: [cableTop(54), plate(3)] }),
    ],
  },
  'db-triceps-extension': {
    frames: [stand({ uArm: 180, fArm: 180, props: [plate(5)] }), stand({ uArm: 178, fArm: -35, props: [plate(5)] })],
  },
  'skull-crusher': {
    frames: [lyingBench({ uArm: 180, fArm: 180, props: [...benchLying, bar(4)] }), lyingBench({ uArm: 176, fArm: -65, props: [...benchLying, bar(4)] })],
  },
  'bench-dip': {
    frames: [
      { anchor: W(30, 66), torso: 190, thigh: 70, shin: 70, uArm: 0, fArm: 0, props: [...benchFlat(8, 34, 66)] },
      { anchor: W(30, 66), torso: 190, thigh: 70, shin: 70, uArm: -25, fArm: 100, props: [...benchFlat(8, 34, 66)] },
    ],
  },
  'triceps-kickback': {
    frames: [
      stand({ torso: 120, thigh: 20, shin: -14, uArm: -80, fArm: -10, props: [db] }),
      stand({ torso: 120, thigh: 20, shin: -14, uArm: -80, fArm: -88, props: [db] }),
    ],
  },
};

const wall = (x: number): Prop => ({ k: 'line', x1: x, y1: 0, x2: x, y2: 90, w: 3 });
const treadmill: Prop[] = [{ k: 'line', x1: 14, y1: 90, x2: 80, y2: 90, w: 3 }, { k: 'line', x1: 80, y1: 90, x2: 88, y2: 30, w: 2.5 }, { k: 'line', x1: 80, y1: 40, x2: 70, y2: 40, w: 2.5 }];

export const ART_CORE: Record<string, ExerciseArt> = {
  /* ───── Abdômen ───── */
  plank: {
    frames: [{ anchor: A(12, 84), torso: 100, thigh: -80, shin: -80, foot: 60, uArm: 0, fArm: 90 }],
  },
  'side-plank': {
    frames: [{ anchor: A(12, 84), torso: 100, thigh: -80, shin: -80, foot: 60, uArm: 0, fArm: 90, arm2: { uArm: 180, fArm: 180 } }],
  },
  'dead-bug': {
    frames: [
      { anchor: H(52, 84), torso: -90, thigh: 170, shin: 90, uArm: 180, fArm: 180, leg2: { thigh: 170, shin: 90 }, arm2: { uArm: 180, fArm: 180 } },
      { anchor: H(52, 84), torso: -90, thigh: 170, shin: 90, uArm: 180, fArm: 180, leg2: { thigh: 98, shin: 98 }, arm2: { uArm: -95, fArm: -95 } },
    ],
  },
  'bird-dog': {
    frames: [
      { anchor: K(40, 82), torso: 95, thigh: 0, shin: -92, uArm: 0, fArm: 0, arm2: { uArm: 0, fArm: 0 } },
      { anchor: K(40, 82), torso: 95, thigh: 0, shin: -92, uArm: 0, fArm: 0, arm2: { uArm: 92, fArm: 92 }, leg2: { thigh: -92, shin: -92 } },
    ],
  },
  crunch: {
    frames: [
      { anchor: H(54, 84), torso: -90, thigh: 140, shin: 'floor', uArm: -80, fArm: 170 },
      { anchor: H(54, 84), torso: -118, thigh: 140, shin: 'floor', uArm: -150, fArm: 170 },
    ],
  },
  'leg-raise': {
    frames: [
      { anchor: H(52, 84), torso: -90, thigh: 96, shin: 96, uArm: 90, fArm: 90 },
      { anchor: H(52, 84), torso: -90, thigh: 172, shin: 172, uArm: 90, fArm: 90 },
    ],
  },
  pallof: {
    frames: [
      stand({ anchor: A(40, 86), torso: 178, uArm: -35, fArm: 100, leg2: { thigh: 12, shin: 6 }, props: [bandTo(94, 44)] }),
      stand({ anchor: A(40, 86), torso: 178, uArm: 90, fArm: 90, leg2: { thigh: 12, shin: 6 }, props: [bandTo(94, 44)] }),
    ],
  },

  /* ───── Cardio ───── */
  running: {
    frames: [
      { anchor: H(50, 46), torso: 168, thigh: 118, shin: 12, uArm: -40, fArm: 55, leg2: { thigh: -28, shin: -105 }, arm2: { uArm: 45, fArm: 110 } },
      { anchor: H(50, 46), torso: 168, thigh: -28, shin: -105, uArm: 45, fArm: 110, leg2: { thigh: 118, shin: 12 }, arm2: { uArm: -40, fArm: 55 } },
    ],
  },
  walking: {
    frames: [
      { anchor: H(50, 48), torso: 178, thigh: 24, shin: 14, uArm: -20, fArm: 25, leg2: { thigh: -18, shin: -22 }, arm2: { uArm: 22, fArm: 40 } },
      { anchor: H(50, 48), torso: 178, thigh: -18, shin: -22, uArm: 22, fArm: 40, leg2: { thigh: 24, shin: 14 }, arm2: { uArm: -20, fArm: 25 } },
    ],
  },
  treadmill: {
    frames: [
      { anchor: H(46, 46), torso: 172, thigh: 70, shin: 8, uArm: -35, fArm: 60, leg2: { thigh: -26, shin: -90 }, arm2: { uArm: 40, fArm: 105 }, props: treadmill },
      { anchor: H(46, 46), torso: 172, thigh: -26, shin: -90, uArm: 40, fArm: 105, leg2: { thigh: 70, shin: 8 }, arm2: { uArm: -35, fArm: 60 }, props: treadmill },
    ],
  },
  cycling: {
    frames: [
      { anchor: H(44, 50), torso: 150, thigh: 100, shin: 8, uArm: 60, fArm: 100, leg2: { thigh: 40, shin: 12 }, props: [{ k: 'wheel', x: 18, y: 76, r: 13 }, { k: 'wheel', x: 82, y: 76, r: 13 }, { k: 'line', x1: 18, y1: 76, x2: 44, y2: 58, w: 2 }, { k: 'line', x1: 44, y1: 58, x2: 70, y2: 54, w: 2 }, { k: 'line', x1: 70, y1: 54, x2: 82, y2: 76, w: 2 }, { k: 'line', x1: 70, y1: 54, x2: 66, y2: 44, w: 2 }] },
      { anchor: H(44, 50), torso: 150, thigh: 40, shin: 12, uArm: 60, fArm: 100, leg2: { thigh: 100, shin: 8 }, props: [{ k: 'wheel', x: 18, y: 76, r: 13 }, { k: 'wheel', x: 82, y: 76, r: 13 }, { k: 'line', x1: 18, y1: 76, x2: 44, y2: 58, w: 2 }, { k: 'line', x1: 44, y1: 58, x2: 70, y2: 54, w: 2 }, { k: 'line', x1: 70, y1: 54, x2: 82, y2: 76, w: 2 }, { k: 'line', x1: 70, y1: 54, x2: 66, y2: 44, w: 2 }] },
    ],
  },
  'jumping-jacks': {
    frames: [
      { view: 'front', uArm: 6, fArm: 6, leg: 3 },
      { view: 'front', uArm: 150, fArm: 160, leg: 22, lift: 5 },
    ],
  },
  'jump-rope': {
    frames: [
      { view: 'front', uArm: 38, fArm: 30, leg: 2, props: [{ k: 'line', x1: 22, y1: 60, x2: 30, y2: 92, w: 1.2 }, { k: 'line', x1: 30, y1: 92, x2: 70, y2: 92, w: 1.2 }, { k: 'line', x1: 70, y1: 92, x2: 78, y2: 60, w: 1.2 }] },
      { view: 'front', uArm: 38, fArm: 30, leg: 2, lift: 6, props: [{ k: 'line', x1: 22, y1: 60, x2: 18, y2: 14, w: 1.2 }, { k: 'line', x1: 18, y1: 14, x2: 82, y2: 14, w: 1.2 }, { k: 'line', x1: 82, y1: 14, x2: 78, y2: 60, w: 1.2 }] },
    ],
  },
  'rowing-machine': {
    frames: [
      { anchor: H(34, 74), torso: 150, thigh: 130, shin: 'floor', uArm: 90, fArm: 90, props: [{ k: 'line', x1: 8, y1: 82, x2: 92, y2: 82, w: 2 }, { k: 'rect', x: 26, y: 76, w: 12, h: 3, r: 1 }, { k: 'wheel', x: 88, y: 70, r: 9 }, { k: 'cable', to: [82, 70] }] },
      { anchor: H(30, 74), torso: 200, thigh: 100, shin: 95, uArm: -15, fArm: 90, props: [{ k: 'line', x1: 8, y1: 82, x2: 92, y2: 82, w: 2 }, { k: 'rect', x: 20, y: 76, w: 12, h: 3, r: 1 }, { k: 'wheel', x: 88, y: 70, r: 9 }, { k: 'cable', to: [82, 70] }] },
    ],
  },

  /* ───── Mobilidade ───── */
  'cat-cow': {
    frames: [
      { anchor: K(36, 82), torso: 80, thigh: 0, shin: -92, uArm: 0, fArm: 0, head: -35 },
      { anchor: K(36, 82), torso: 102, thigh: 0, shin: -92, uArm: 0, fArm: 0, head: 35 },
    ],
  },
  'hip-flexor-stretch': {
    frames: [
      stand({ anchor: A(64, 86), thigh: 82, shin: 0, torso: 180, leg2: { thigh: -12, shin: -98 }, uArm: 8, fArm: 20 }),
      stand({ anchor: A(70, 86), thigh: 88, shin: 4, torso: 182, leg2: { thigh: -28, shin: -98 }, uArm: 170, fArm: 175 }),
    ],
  },
  'hamstring-stretch': {
    frames: [stand({}), stand({ torso: 62, uArm: 12, fArm: 8 })],
  },
  'quad-stretch': {
    frames: [stand({ leg2: { thigh: 8, shin: -158 }, arm2: { uArm: -25, fArm: -150 }, uArm: 90, fArm: 90, props: [wall(70)] })],
  },
  'calf-stretch': {
    frames: [stand({ anchor: A(56, 86), thigh: 30, shin: -5, torso: 160, uArm: 80, fArm: 90, leg2: { thigh: -22, shin: -22 }, props: [wall(84)] })],
  },
  'thoracic-rotation': {
    frames: [
      { anchor: K(40, 82), torso: 95, thigh: 0, shin: -92, uArm: 0, fArm: 0, arm2: { uArm: 120, fArm: 190 } },
      { anchor: K(40, 82), torso: 95, thigh: 0, shin: -92, uArm: 0, fArm: 0, arm2: { uArm: 180, fArm: 180 } },
    ],
  },
  'shoulder-circles': {
    frames: [
      { view: 'front', uArm: 88, fArm: 88, leg: 3 },
      { view: 'front', uArm: 150, fArm: 150, leg: 3 },
    ],
  },
};

export const ART_ALL: Record<string, ExerciseArt> = { ...ART, ...ART_MORE, ...ART_CORE };
