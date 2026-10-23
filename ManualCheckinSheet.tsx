import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { NumberField } from './NumberField';
import { MANUAL_ACTIVITY_LABELS } from '../domain/checkins';
import type { ManualActivity } from '../domain/checkins';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';

const ACTIVITIES = Object.keys(MANUAL_ACTIVITY_LABELS) as ManualActivity[];

/** Check-in manual de uma atividade feita fora do app. */
export function ManualCheckinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { manualCheckin } = useData();
  const toast = useToast();
  const [activity, setActivity] = useState<ManualActivity | null>(null);
  const [minutes, setMinutes] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setActivity(null);
    setMinutes(undefined);
    setNote('');
  };
  const close = () => {
    reset();
    onClose();
  };
  const submit = async () => {
    if (!activity) return;
    setBusy(true);
    const saved = await manualCheckin({ activity, minutes, note });
    setBusy(false);
    if (saved) {
      toast.show('Check-in registrado (manual)');
      close();
    } else {
      toast.show('Não foi possível salvar neste aparelho');
    }
  };

  return (
    <BottomSheet open={open} title="Check-in de hoje" onClose={close}>
      <p className="muted">Fez uma atividade fora do app? Registre aqui. Ela fica marcada como manual e conta como dia ativo.</p>
      <div className="chips" role="radiogroup" aria-label="Atividade">
        {ACTIVITIES.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={activity === a} className={`chip${activity === a ? ' chip--selected' : ''}`} onClick={() => setActivity(a)}>
            {MANUAL_ACTIVITY_LABELS[a]}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Duração em minutos (opcional)</span>
        <NumberField label="Duração em minutos" value={minutes} max={600} placeholder="Ex.: 30" onCommit={setMinutes} />
      </label>
      <label className="field">
        <span className="field__label">Observação (opcional)</span>
        <input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="button" className="btn btn--primary" disabled={!activity || busy} onClick={() => void submit()}>
        Registrar check-in
      </button>
    </BottomSheet>
  );
}
