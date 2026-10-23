/**
 * Ilustrações esquemáticas de exercícios (figura de palitos) calculadas por cinemática simples.
 * São desenhos próprios do app (sem fotos, sem licença externa, funcionam offline) e pequenos.
 *
 * Ângulos em graus, medidos a partir de "para baixo" no sentido horário, olhando a figura de lado
 * (voltada para a direita): 0 = para baixo, 90 = para a frente, 180 = para cima, -90 = para trás.
 */

export const VIEW = 100;
/** Margem superior do quadro (movimentos acima da cabeça). */
export const VIEW_TOP = -16;
export const GROUND_Y = 90;

const SEG = { shin: 19, thigh: 19, torso: 24, uArm: 13, fArm: 12, neck: 4, head: 5.5, foot: 6 } as const;

export type Pt = readonly [number, number];

const dir = (deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
};
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];

export type AnchorJoint = 'ankle' | 'wrist' | 'hip' | 'knee';

export type Prop =
  | { k: 'plate'; at: 'wrist' | 'hip' | 'shoulder'; r?: number }
  | { k: 'dumbbell'; at: 'wrist' }
  | { k: 'ball'; at: 'wrist'; r?: number }
  | { k: 'kettlebell'; at: 'wrist' }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number; dash?: boolean }
  | { k: 'cable'; to: Pt; dash?: boolean; from?: 'wrist' | 'ankle'; mirror?: boolean }
  | { k: 'pulley'; x: number; y: number }
  | { k: 'wheel'; x: number; y: number; r: number }
  | { k: 'arrow'; x1: number; y1: number; x2: number; y2: number };

export interface SidePose {
  view?: 'side';
  anchor: { joint: AnchorJoint; x: number; y: number };
  torso: number;
  uArm: number;
  fArm: number;
  thigh: number;
  /** Número em graus ou 'floor' para apoiar o tornozelo no chão. */
  shin: number | 'floor';
  foot?: number;
  head?: number;
  leg2?: { thigh: number; shin: number | 'floor'; foot?: number };
  arm2?: { uArm: number; fArm: number };
  props?: Prop[];
}

/** Vista frontal simétrica (elevação lateral, polichinelo, crucifixos). Ângulos a partir de "para baixo", + = para fora. */
export interface FrontPose {
  view: 'front';
  /** Braço: ombro→cotovelo e cotovelo→punho (absolutos; + = afastando do corpo). */
  uArm: number;
  fArm: number;
  /** Abertura de cada perna (+ = para fora). */
  leg: number;
  /** Joelhos dobrados (agachamento frontal) em graus; 0 = pernas retas. */
  knee?: number;
  /** Deslocamento vertical (saltos). */
  lift?: number;
  /** Sentado (coxas apontam para a câmera): quadril na altura do assento. */
  seated?: boolean;
  props?: Prop[];
}

export type Pose = SidePose | FrontPose;

export interface Segment {
  a: Pt;
  b: Pt;
  far?: boolean;
}

export interface Geometry {
  segments: Segment[];
  head: { c: Pt; r: number };
  joints: { wrist: Pt; ankle: Pt; hip: Pt; shoulder: Pt; knee: Pt; elbow: Pt };
  wrists: Pt[];
}

export function solveSide(p: SidePose): Geometry {
  const hip0: Pt = [0, 0];
  const knee0 = add(hip0, dir(p.thigh), SEG.thigh);
  let shinDeg: number;
  if (p.shin === 'floor') shinDeg = 0; // resolvido após ancorar
  else shinDeg = p.shin;
  const compute = (shin: number, origin: Pt) => {
    const hip = origin;
    const knee = add(hip, dir(p.thigh), SEG.thigh);
    const ankle = add(knee, dir(shin), SEG.shin);
    const toe = add(ankle, dir(p.foot ?? 90), SEG.foot);
    const shoulder = add(hip, dir(p.torso), SEG.torso);
    const elbow = add(shoulder, dir(p.uArm), SEG.uArm);
    const wrist = add(elbow, dir(p.fArm), SEG.fArm);
    return { hip, knee, ankle, toe, shoulder, elbow, wrist };
  };
  let j = compute(shinDeg, hip0);
  const place = (o: { hip: Pt; knee: Pt; ankle: Pt; wrist: Pt }) => {
    const a = p.anchor;
    const joint = a.joint === 'ankle' ? o.ankle : a.joint === 'wrist' ? o.wrist : a.joint === 'knee' ? o.knee : o.hip;
    return [a.x - joint[0], a.y - joint[1]] as Pt;
  };
  if (p.shin === 'floor') {
    // Âncora no quadril/joelho/punho: acha o ângulo da canela que deixa o tornozelo no chão.
    const off0 = place(j);
    const kneeY = knee0[1] + off0[1];
    const ankleY = GROUND_Y - 4;
    const dy = Math.max(-SEG.shin, Math.min(SEG.shin, ankleY - kneeY));
    shinDeg = -(Math.acos(dy / SEG.shin) * 180) / Math.PI;
    j = compute(shinDeg, hip0);
  }
  const off = place(j);
  const T = (q: Pt): Pt => [q[0] + off[0], q[1] + off[1]];
  const hip = T(j.hip), knee = T(j.knee), ankle = T(j.ankle), toe = T(j.toe), shoulder = T(j.shoulder), elbow = T(j.elbow), wrist = T(j.wrist);
  const headC = add(shoulder, dir(p.torso + (p.head ?? 0)), SEG.neck + SEG.head);
  const segments: Segment[] = [];
  const wrists: Pt[] = [wrist];
  if (p.leg2) {
    const k2 = add(hip, dir(p.leg2.thigh), SEG.thigh);
    let s2 = p.leg2.shin === 'floor' ? 0 : p.leg2.shin;
    if (p.leg2.shin === 'floor') {
      const dy = Math.max(-SEG.shin, Math.min(SEG.shin, GROUND_Y - 4 - k2[1]));
      s2 = -(Math.acos(dy / SEG.shin) * 180) / Math.PI;
    }
    const a2 = add(k2, dir(s2), SEG.shin);
    segments.push({ a: hip, b: k2, far: true }, { a: k2, b: a2, far: true }, { a: a2, b: add(a2, dir(p.leg2.foot ?? 90), SEG.foot), far: true });
  }
  if (p.arm2) {
    const e2 = add(shoulder, dir(p.arm2.uArm), SEG.uArm);
    const w2 = add(e2, dir(p.arm2.fArm), SEG.fArm);
    segments.push({ a: shoulder, b: e2, far: true }, { a: e2, b: w2, far: true });
  }
  segments.push(
    { a: hip, b: knee },
    { a: knee, b: ankle },
    { a: ankle, b: toe },
    { a: hip, b: shoulder },
    { a: shoulder, b: elbow },
    { a: elbow, b: wrist },
  );
  return { segments, head: { c: headC, r: SEG.head }, joints: { wrist, ankle, hip, shoulder, knee, elbow }, wrists };
}

export function solveFront(p: FrontPose): Geometry {
  const cx = 50;
  const lift = p.lift ?? 0;
  const kneeBend = p.knee ?? 0;
  const drop = kneeBend > 0 ? Math.sin((kneeBend * Math.PI) / 360) * 22 : 0;
  const thighLen = p.seated ? 4 : SEG.thigh;
  const hipY = GROUND_Y - 4 - SEG.shin - thighLen + drop - lift;
  const shoulderY = hipY - SEG.torso;
  const segments: Segment[] = [];
  const wrists: Pt[] = [];
  const hipL: Pt = [cx - 4, hipY];
  const hipR: Pt = [cx + 4, hipY];
  const shL: Pt = [cx - 7, shoulderY + 1];
  const shR: Pt = [cx + 7, shoulderY + 1];
  segments.push({ a: [cx, hipY], b: [cx, shoulderY] }, { a: shL, b: shR }, { a: hipL, b: hipR });
  for (const side of [-1, 1] as const) {
    const hip = side < 0 ? hipL : hipR;
    const sh = side < 0 ? shL : shR;
    const eFixed: Pt = [sh[0] + side * dir(p.uArm)[0] * SEG.uArm, sh[1] + dir(p.uArm)[1] * SEG.uArm];
    const wFixed: Pt = [eFixed[0] + side * dir(p.fArm)[0] * SEG.fArm, eFixed[1] + dir(p.fArm)[1] * SEG.fArm];
    segments.push({ a: sh, b: eFixed }, { a: eFixed, b: wFixed });
    wrists.push(wFixed);
    // pernas: coxa abre pelo ângulo; com joelho dobrado, o joelho vai para fora e a canela volta
    const thighA = p.leg + kneeBend / 2;
    const shinA = p.leg - kneeBend / 2;
    const knee: Pt = [hip[0] + side * dir(thighA)[0] * thighLen, hip[1] + dir(thighA)[1] * thighLen];
    const ankle: Pt = [knee[0] + side * dir(shinA)[0] * SEG.shin, knee[1] + dir(shinA)[1] * SEG.shin];
    segments.push({ a: hip, b: knee }, { a: knee, b: ankle }, { a: ankle, b: [ankle[0] + side * 4, ankle[1] + 1] });
  }
  const headC: Pt = [cx, shoulderY - SEG.neck - SEG.head];
  return {
    segments,
    head: { c: headC, r: SEG.head },
    joints: { wrist: wrists[1], ankle: [cx, GROUND_Y], hip: [cx, hipY], shoulder: [cx, shoulderY], knee: [cx, hipY + 19], elbow: wrists[1] },
    wrists,
  };
}

export function solve(p: Pose): Geometry {
  return p.view === 'front' ? solveFront(p) : solveSide(p);
}

/** Assinatura estável de uma ilustração (para garantir que movimentos diferentes não repitam o desenho). */
export function artSignature(frames: Pose[]): string {
  return JSON.stringify(frames);
}
