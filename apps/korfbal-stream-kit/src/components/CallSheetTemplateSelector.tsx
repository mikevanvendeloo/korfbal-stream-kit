import {useEffect, useState} from 'react';
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
  const { fetchTemplates, applyTemplate, loading: templatesLoading, error: templatesError } = useCallSheetTemplates();
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

    if (!window.confirm('Weet je zeker dat je het huidige draaiboek wilt overschrijven met dit nieuwe template? Alle huidige items en tijden worden gewist.')) {
      return;
    }

    const result = await applyTemplate(Number(selectedId), productionId, {
      replace: true
    });
    if (result) {
      setStatus({ type: 'success', message: result.message || 'Draaiboek succesvol toegepast!' });
      if (onTemplateApplied) onTemplateApplied();
      setTimeout(() => setStatus(null), 5000);
    } else {
      setStatus({ type: 'error', message: 'Fout bij het toepassen van het draaiboek.' });
    }
  };

  const loading = templatesLoading;
  const error = templatesError;

  return (
    <Card className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
          <MdViewList className="text-blue-500 dark:text-blue-400" />
          Draaiboek (CallSheet Template)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-white/60">
            Kies een draaiboek-template om deze productie in te richten. <strong>Let op:</strong> bestaande items worden verwijderd.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-white/40 ml-1">Template</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
                className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="" className="bg-white dark:bg-gray-900">-- Kies een draaiboek --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id} className="bg-white dark:bg-gray-900">
                    {t.name} ({t._count?.items} items)
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleApply}
              disabled={!selectedId || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full mt-2 shadow-sm"
            >
              {loading ? <MdRefresh className="animate-spin" /> : 'Draaiboek toepassen'}
            </Button>
          </div>

          {status && (
            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              status.type === 'success'
                ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
            }`}>
              {status.type === 'success' ? <MdCheckCircle /> : <MdErrorOutline />}
              {status.message}
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
