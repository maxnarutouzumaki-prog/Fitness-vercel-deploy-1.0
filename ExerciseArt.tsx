import { solve, VIEW, VIEW_TOP, GROUND_Y } from '../domain/figure';
import type { Pose, Prop, Geometry, Pt } from '../domain/figure';
import type { ExerciseArt as ArtData } from '../domain/exerciseArt';

const f = (n: number) => Math.round(n * 10) / 10;

function propNode(p: Prop, g: Geometry, key: number) {
  const at = (name: 'wrist' | 'hip' | 'shoulder'): Pt => (name === 'wrist' ? g.joints.wrist : name === 'hip' ? g.joints.hip : g.joints.shoulder);
  switch (p.k) {
    case 'plate': {
      const [x, y] = at(p.at);
      return <circle key={key} className="art-prop art-prop--fill" cx={f(x)} cy={f(y)} r={p.r ?? 4} />;
    }
    case 'ball': {
      const [x, y] = at(p.at);
      return <circle key={key} className="art-prop art-prop--fill" cx={f(x)} cy={f(y)} r={p.r ?? 5} />;
    }
    case 'dumbbell': {
      const [x, y] = at(p.at);
      return (
        <g key={key} className="art-prop art-prop--fill">
          <rect x={f(x - 5)} y={f(y - 1)} width={10} height={2} rx={1} />
          <rect x={f(x - 7)} y={f(y - 3.5)} width={3} height={7} rx={1} />
          <rect x={f(x + 4)} y={f(y - 3.5)} width={3} height={7} rx={1} />
        </g>
      );
    }
    case 'kettlebell': {
      const [x, y] = at(p.at);
      return (
        <g key={key} className="art-prop">
          <circle className="art-prop--fill" cx={f(x)} cy={f(y + 3)} r={5} />
          <path d={`M ${f(x - 3)} ${f(y - 0.5)} a 3 3 0 0 1 6 0`} fill="none" />
        </g>
      );
    }
    case 'rect':
      return <rect key={key} className="art-prop art-prop--fill" x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r ?? 1} />;
    case 'line':
      return <line key={key} className="art-prop" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeWidth={p.w ?? 2} strokeDasharray={p.dash ? '3 2' : undefined} />;
    case 'pulley':
      return <circle key={key} className="art-prop" cx={p.x} cy={p.y} r={2.5} fill="none" />;
    case 'wheel':
      return <circle key={key} className="art-prop" cx={p.x} cy={p.y} r={p.r} fill="none" strokeWidth={1.6} />;
    case 'cable': {
      const starts: Pt[] = p.from === 'ankle' ? [g.joints.ankle] : p.mirror ? g.wrists : [g.joints.wrist];
      return (
        <g key={key} className="art-prop">
          {starts.map((s, i) => {
            const to: Pt = p.mirror && i === 0 ? [100 - p.to[0], p.to[1]] : p.to;
            return <line key={i} x1={f(s[0])} y1={f(s[1])} x2={to[0]} y2={to[1]} strokeWidth={1.2} strokeDasharray={p.dash ? '3 2' : undefined} />;
          })}
          <circle cx={p.to[0]} cy={p.to[1]} r={2} fill="none" />
          {p.mirror ? <circle cx={100 - p.to[0]} cy={p.to[1]} r={2} fill="none" /> : null}
        </g>
      );
    }
    case 'arrow': {
      const ang = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
      const hx = (d: number) => f(p.x2 - 4 * Math.cos(ang + d));
      const hy = (d: number) => f(p.y2 - 4 * Math.sin(ang + d));
      return (
        <g key={key} className="art-arrow">
          <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
          <polyline points={`${hx(0.5)},${hy(0.5)} ${p.x2},${p.y2} ${hx(-0.5)},${hy(-0.5)}`} fill="none" />
        </g>
      );
    }
  }
}

export function Frame({ pose }: { pose: Pose }) {
  const g = solve(pose);
  return (
    <>
      <line className="art-floor" x1={4} y1={GROUND_Y} x2={VIEW - 4} y2={GROUND_Y} />
      {(pose.props ?? []).filter((p) => p.k !== 'plate' && p.k !== 'dumbbell' && p.k !== 'ball' && p.k !== 'kettlebell' && p.k !== 'cable' && p.k !== 'arrow').map((p, i) => propNode(p, g, i))}
      {g.segments.filter((s) => s.far).map((s, i) => (
        <line key={`f${i}`} className="art-limb art-limb--far" x1={f(s.a[0])} y1={f(s.a[1])} x2={f(s.b[0])} y2={f(s.b[1])} />
      ))}
      {g.segments.filter((s) => !s.far).map((s, i) => (
        <line key={`n${i}`} className="art-limb" x1={f(s.a[0])} y1={f(s.a[1])} x2={f(s.b[0])} y2={f(s.b[1])} />
      ))}
      <circle className="art-head" cx={f(g.head.c[0])} cy={f(g.head.c[1])} r={g.head.r} />
      {(pose.props ?? []).filter((p) => p.k === 'plate' || p.k === 'dumbbell' || p.k === 'ball' || p.k === 'kettlebell' || p.k === 'cable' || p.k === 'arrow').map((p, i) => propNode(p, g, 100 + i))}
    </>
  );
}

interface ExerciseArtProps {
  art: ArtData;
  /** 'thumb' mostra um quadro só; 'detail' mostra início e fim lado a lado. */
  mode: 'thumb' | 'detail';
  label: string;
}

export function ExerciseArtView({ art, mode, label }: ExerciseArtProps) {
  if (mode === 'thumb') {
    const pose = art.frames[art.thumb ?? art.frames.length - 1];
    return (
      <svg className="art" viewBox={`0 ${VIEW_TOP} ${VIEW} ${VIEW - VIEW_TOP}`} role="img" aria-label={`Ilustração: ${label}`}>
        <Frame pose={pose} />
      </svg>
    );
  }
  return (
    <div className="art-detail" role="img" aria-label={`Ilustração: ${label}, ${art.frames.length > 1 ? 'posição inicial e final' : 'posição'}`}>
      {art.frames.map((pose, i) => (
        <figure key={i} className="art-detail__frame">
          <svg className="art" viewBox={`0 ${VIEW_TOP} ${VIEW} ${VIEW - VIEW_TOP}`} aria-hidden="true">
            <Frame pose={pose} />
          </svg>
          {art.frames.length > 1 ? <figcaption>{i === 0 ? 'Início' : 'Fim'}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}
