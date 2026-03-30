import {useEffect, useState} from 'react';
import {CallSheetTemplate, useCallSheetTemplates} from '../hooks/useCallSheetTemplates';
import {Card, CardContent, CardHeader, CardTitle} from './ui/card';
import {Button} from './ui/button';
import {MdCheckCircle, MdErrorOutline, MdLayers, MdLayersClear, MdRefresh, MdViewList} from 'react-icons/md';
import {useProductionSegments} from "../hooks/useProductions";

interface CallSheetTemplateSelectorProps {
  productionId: number;
  currentTemplateId?: number | null;
  onTemplateApplied?: () => void;
}

export function CallSheetTemplateSelector({
  productionId,
  currentTemplateId,
  onTemplateApplied
}: CallSheetTemplateSelectorProps) {
  const { fetchTemplates, applyTemplate, loading: templatesLoading, error: templatesError } = useCallSheetTemplates();
  const segments = useProductionSegments(productionId);
  const [templates, setTemplates] = useState<CallSheetTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>(currentTemplateId || '');
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | ''>('');
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchTemplates().then(setTemplates);
  }, [fetchTemplates]);

  useEffect(() => {
    if (currentTemplateId) setSelectedId(currentTemplateId);
  }, [currentTemplateId]);

  useEffect(() => {
    if (segments.data && segments.data.length > 0) {
      if (!selectedSegmentId || !segments.data.find(s => s.id === selectedSegmentId)) {
        setSelectedSegmentId(segments.data[0].id);
      }
    }
  }, [segments.data, selectedSegmentId]);

  const handleApply = async () => {
    if (!selectedId) return;

    if (replace && !window.confirm('Weet je zeker dat je alle bestaande segmenten en draaiboek items wilt verwijderen?')) {
      return;
    }

    const result = await applyTemplate(Number(selectedId), productionId, {
      segmentId: selectedSegmentId ? Number(selectedSegmentId) : undefined,
      replace
    });
    if (result) {
      setStatus({ type: 'success', message: result.message || 'Draaiboek succesvol toegepast!' });
      if (onTemplateApplied) onTemplateApplied();
      setTimeout(() => setStatus(null), 5000);
    } else {
      setStatus({ type: 'error', message: 'Fout bij het toepassen van het draaiboek.' });
    }
  };

  const loading = templatesLoading || segments.isLoading;
  const error = templatesError || (segments.isError ? (segments.error as any).message : null);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MdViewList className="text-blue-400" />
          Draaiboek (CallSheet Template)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Kies een draaiboek-template om items aan deze productie toe te voegen.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40 ml-1">Template</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
                className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">-- Kies een draaiboek --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t._count?.items} items)</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40 ml-1">Toevoegen aan segment</label>
              <select
                value={selectedSegmentId}
                onChange={(e) => setSelectedSegmentId(e.target.value ? Number(e.target.value) : '')}
                className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || replace}
              >
                {segments.data?.map(s => (
                  <option key={s.id} value={s.id}>{s.naam}</option>
                ))}
                {(!segments.data || segments.data.length === 0) && (
                  <option value="">(Nieuw segment 'Algemeen')</option>
                )}
              </select>
            </div>

            <div className="flex items-center gap-4 py-1">
               <button
                 type="button"
                 onClick={() => setReplace(false)}
                 className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm transition-colors ${
                   !replace
                     ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                     : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/20'
                 }`}
               >
                 <MdLayers className="w-4 h-4" />
                 Toevoegen
               </button>
               <button
                 type="button"
                 onClick={() => setReplace(true)}
                 className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm transition-colors ${
                   replace
                     ? 'bg-red-600/20 border-red-500 text-red-400'
                     : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/20'
                 }`}
               >
                 <MdLayersClear className="w-4 h-4" />
                 Overschrijven
               </button>
            </div>

            <Button
              onClick={handleApply}
              disabled={!selectedId || loading}
              className={`${replace ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} w-full mt-2`}
            >
              {loading ? <MdRefresh className="animate-spin" /> : (replace ? 'Draaiboek overschrijven' : 'Items toevoegen')}
            </Button>
          </div>

          {status && (
            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {status.type === 'success' ? <MdCheckCircle /> : <MdErrorOutline />}
              {status.message}
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
