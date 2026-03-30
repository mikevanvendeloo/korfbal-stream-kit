import React, {useEffect, useState} from 'react';
import {CallSheetTemplate, useCallSheetTemplates} from '../hooks/useCallSheetTemplates';
import {Card, CardContent, CardHeader, CardTitle} from './ui/card';
import {Button} from './ui/button';
import {MdCheckCircle, MdErrorOutline, MdRefresh, MdViewList} from 'react-icons/md';

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
  const { fetchTemplates, applyTemplate, loading, error } = useCallSheetTemplates();
  const [templates, setTemplates] = useState<CallSheetTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>(currentTemplateId || '');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchTemplates().then(setTemplates);
  }, [fetchTemplates]);

  useEffect(() => {
    if (currentTemplateId) setSelectedId(currentTemplateId);
  }, [currentTemplateId]);

  const handleApply = async () => {
    if (!selectedId) return;

    const result = await applyTemplate(Number(selectedId), productionId);
    if (result) {
      setStatus({ type: 'success', message: result.message || 'Draaiboek succesvol toegepast!' });
      if (onTemplateApplied) onTemplateApplied();
      setTimeout(() => setStatus(null), 5000);
    } else {
      setStatus({ type: 'error', message: 'Fout bij het toepassen van het draaiboek.' });
    }
  };

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
            Kies een draaiboek-template om de callsheet voor deze productie te initialiseren.
            Let op: Dit verwijdert alle bestaande items in het huidige draaiboek van deze productie.
          </p>

          <div className="flex gap-3">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
              className="flex-grow bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">-- Kies een draaiboek --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t._count?.items} items)</option>
              ))}
            </select>

            <Button
              onClick={handleApply}
              disabled={!selectedId || loading}
              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              {loading ? <MdRefresh className="animate-spin" /> : 'Toepassen'}
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
