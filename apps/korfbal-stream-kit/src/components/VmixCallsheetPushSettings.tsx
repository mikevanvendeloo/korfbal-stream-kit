import React from 'react';
import {usePositionsCatalog} from '../hooks/usePositions';
import {
  CallsheetColors,
  TimingState,
  useCallsheetTiming,
  usePushCallsheetToVmix,
  useSaveVmixCallsheetPushConfig,
  useVmixCallsheetPushConfig,
  VmixCallsheetPushConfig
} from '../hooks/useVmixCallsheetPush';

const inputClass = 'mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
const stateLabels: Record<TimingState, string> = {normal: 'Normaal', warning: 'Bijna op', overtime: 'Over tijd'};

function FieldInput({id, label, value, placeholder, onChange}: {
  id: string; label: string; value: string; placeholder?: string; onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass}/>
    </div>
  );
}

function ColorsEditor({prefix, colors, onChange}: {
  prefix: string; colors: CallsheetColors; onChange: (colors: CallsheetColors) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(stateLabels) as TimingState[]).map((state) => (
        <div key={state} className="rounded-md p-2 text-sm" style={{background: colors[state].background, color: colors[state].text}}>
          <div className="font-semibold">{stateLabels[state]}</div>
          <label className="flex items-center justify-between gap-2 mt-1">
            Achtergrond
            <input type="color" aria-label={`${prefix} ${stateLabels[state]} achtergrond`} value={colors[state].background.slice(0, 7)}
                   onChange={(e) => onChange({...colors, [state]: {...colors[state], background: e.target.value.toUpperCase()}})}/>
          </label>
          <label className="flex items-center justify-between gap-2 mt-1">
            Tekst
            <input type="color" aria-label={`${prefix} ${stateLabels[state]} tekst`} value={colors[state].text.slice(0, 7)}
                   onChange={(e) => onChange({...colors, [state]: {...colors[state], text: e.target.value.toUpperCase()}})}/>
          </label>
        </div>
      ))}
    </div>
  );
}

function PreviewBox({label, title, lines, state, colors}: {
  label: string; title: string; lines: string[]; state: TimingState; colors: CallsheetColors;
}) {
  return (
    <div className="rounded-md p-3 min-w-[14rem]" style={{background: colors[state].background, color: colors[state].text}}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-semibold">{title || '—'}</div>
      {lines.filter(Boolean).map((line) => <div key={line} className="text-sm tabular-nums">{line}</div>)}
    </div>
  );
}

/** Settings for pushing the current/next callsheet item (presentator & analist) to a vMix title. */
export default function VmixCallsheetPushSettings() {
  const configQuery = useVmixCallsheetPushConfig();
  const save = useSaveVmixCallsheetPushConfig();
  const push = usePushCallsheetToVmix();
  const timing = useCallsheetTiming();
  const positions = usePositionsCatalog();
  const [config, setConfig] = React.useState<VmixCallsheetPushConfig | null>(null);

  React.useEffect(() => {
    if (configQuery.data) setConfig(configQuery.data);
  }, [configQuery.data]);

  if (configQuery.isLoading || !config) {
    return <div className="mt-4 text-gray-700 dark:text-gray-300">{configQuery.isError ? 'Instellingen laden mislukt' : 'Laden…'}</div>;
  }

  const setCurrent = (patch: Partial<VmixCallsheetPushConfig['current']>) => setConfig({...config, current: {...config.current, ...patch}});
  const setNext = (patch: Partial<VmixCallsheetPushConfig['next']>) => setConfig({...config, next: {...config.next, ...patch}});
  const togglePosition = (name: string) => setConfig({
    ...config,
    positions: config.positions.includes(name) ? config.positions.filter((p) => p !== name) : [...config.positions, name],
  });
  const splitFields = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (config) save.mutate(config);
  }

  const t = timing.data;

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({...config, enabled: e.target.checked})}/>
          Automatisch pushen naar vMix
        </label>
        <div className="flex-1 min-w-[12rem]">
          <FieldInput id="push-input" label="vMix title (naam, nummer of key)" value={config.input} placeholder="Callsheet Presentatie"
                      onChange={(input) => setConfig({...config, input})}/>
        </div>
        <div className="w-40">
          <label htmlFor="push-warning" className={labelClass}>Oranje vanaf (sec)</label>
          <input id="push-warning" type="number" min={0} max={3600} value={config.warningSeconds} className={inputClass}
                 onChange={(e) => setConfig({...config, warningSeconds: Math.max(0, Number(e.target.value) || 0)})}/>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Posities</legend>
        <p className="text-xs text-gray-500 dark:text-gray-400">Een item telt mee als een van deze posities erop staat, of als het item geen posities heeft. Niets aangevinkt = alle items.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {(positions.data ?? []).map((p) => (
            <label key={p.id} className="flex items-center gap-1 text-sm text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={config.positions.includes(p.name)} onChange={() => togglePosition(p.name)}/>
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Veldnamen zijn de vMix SelectedName van de title, bijvoorbeeld <code>Titel.Text</code>. Een leeg veld wordt niet gepusht.
        De achtergrond wordt gezet met SetColor (een rechthoek/shape), de tekstkleur met SetTextColour.
      </p>

      <section className="space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Huidig item</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FieldInput id="cur-title" label="Titel veld" value={config.current.titleField} placeholder="Titel.Text" onChange={(titleField) => setCurrent({titleField})}/>
          <FieldInput id="cur-timer" label="Resterende tijd veld" value={config.current.timerField} placeholder="Timer.Text" onChange={(timerField) => setCurrent({timerField})}/>
          <FieldInput id="cur-start" label="Starttijd veld" value={config.current.startTimeField} placeholder="Start.Text" onChange={(startTimeField) => setCurrent({startTimeField})}/>
          <FieldInput id="cur-bg" label="Achtergrond (shape)" value={config.current.backgroundField} placeholder="Achtergrond" onChange={(backgroundField) => setCurrent({backgroundField})}/>
          <div className="md:col-span-2">
            <FieldInput id="cur-textcolor" label="Tekstkleur velden (komma gescheiden)" value={config.current.textColorFields.join(', ')} placeholder="Titel.Text, Timer.Text"
                        onChange={(v) => setCurrent({textColorFields: splitFields(v)})}/>
          </div>
        </div>
        <ColorsEditor prefix="Huidig" colors={config.current.colors} onChange={(colors) => setCurrent({colors})}/>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Volgend item</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">De kleur volgt de tijd tot het volgende item begint.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FieldInput id="next-title" label="Titel veld" value={config.next.titleField} placeholder="Volgend.Text" onChange={(titleField) => setNext({titleField})}/>
          <FieldInput id="next-duration" label="Duur veld" value={config.next.durationField} placeholder="VolgendDuur.Text" onChange={(durationField) => setNext({durationField})}/>
          <FieldInput id="next-startsin" label="Begint over veld" value={config.next.startsInField} placeholder="VolgendOver.Text" onChange={(startsInField) => setNext({startsInField})}/>
          <FieldInput id="next-start" label="Starttijd veld" value={config.next.startTimeField} placeholder="VolgendStart.Text" onChange={(startTimeField) => setNext({startTimeField})}/>
          <FieldInput id="next-bg" label="Achtergrond (shape)" value={config.next.backgroundField} placeholder="VolgendAchtergrond" onChange={(backgroundField) => setNext({backgroundField})}/>
          <FieldInput id="next-textcolor" label="Tekstkleur velden (komma gescheiden)" value={config.next.textColorFields.join(', ')} placeholder="Volgend.Text"
                      onChange={(v) => setNext({textColorFields: splitFields(v)})}/>
        </div>
        <ColorsEditor prefix="Volgend" colors={config.next.colors} onChange={(colors) => setNext({colors})}/>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Voorbeeld (live)</h3>
        {t ? (
          <div className="mt-2 flex flex-wrap gap-3">
            <PreviewBox label="Nu" title={t.currentTitle} state={t.currentState} colors={config.current.colors}
                        lines={[t.currentRemaining && `Nog ${t.currentRemaining}`, t.currentStartTime && `Gestart ${t.currentStartTime}`]}/>
            <PreviewBox label="Straks" title={t.nextTitle} state={t.nextState} colors={config.next.colors}
                        lines={[t.nextDuration && `Duur ${t.nextDuration}`, t.nextStartsIn && `Over ${t.nextStartsIn}`, t.nextStartTime && `Om ${t.nextStartTime}`]}/>
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">{timing.isError ? 'Geen actieve productie of timing niet beschikbaar' : 'Laden…'}</div>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Het voorbeeld gebruikt de opgeslagen posities. Data source voor vMix: <code>/api/vmix/callsheet/timing?position=Presentatie,Analist</code>
        </p>
      </section>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={save.isPending}
                className="px-3 py-2 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
          {save.isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        <button type="button" disabled={push.isPending} onClick={() => push.mutate()}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
          {push.isPending ? 'Pushen…' : 'Nu pushen'}
        </button>
      </div>

      {save.isSuccess && <div role="status" className="text-sm text-green-700 dark:text-green-400">Instellingen opgeslagen</div>}
      {save.isError && <div role="alert" className="text-sm text-red-600">{(save.error as Error).message}</div>}
      {push.data && (
        <div role={push.data.errors.length ? 'alert' : 'status'} className={`text-sm ${push.data.errors.length ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>
          {push.data.sent} velden naar vMix gestuurd{push.data.errors.length ? `, fouten: ${push.data.errors.join('; ')}` : ''}
        </div>
      )}
      {push.isError && <div role="alert" className="text-sm text-red-600">{(push.error as Error).message}</div>}
    </form>
  );
}
