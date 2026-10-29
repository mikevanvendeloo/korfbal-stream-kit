import React from 'react';
import {MdDownload, MdUpload} from 'react-icons/md';
import {downloadExport} from '../lib/download';
import {DraaiboekImportResult, useImportDraaiboek} from '../hooks/useCallsheet';

const BUTTON = 'px-3 py-1 border rounded flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function importSummary({items, newChapters}: DraaiboekImportResult): string {
  const itemText = `${items} ${items === 1 ? 'item' : 'items'} geïmporteerd`;
  if (newChapters.length === 0) return `${itemText}.`;
  return `${itemText}; nieuwe ${newChapters.length === 1 ? 'hoofdstuk' : 'hoofdstukken'}: ${newChapters.join(', ')}.`;
}

/**
 * The production draaiboek as a file (Draaiboek tab): Exporteer JSON / Exporteer Excel download it,
 * Importeer draaiboek replaces its items by those of a JSON file (after a confirmation).
 */
export default function DraaiboekFileActions({productionId, callSheetId}: { productionId: number; callSheetId?: number }) {
  const importDraaiboek = useImportDraaiboek(productionId);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const disabled = !callSheetId;
  const title = disabled ? 'Kies eerst een draaiboek-template' : undefined;

  async function handleFile(file: File) {
    if (!callSheetId) return;
    setResult(null);
    const confirmed = window.confirm(
      `Het draaiboek van deze productie wordt vervangen door dat uit ${file.name}. De huidige items gaan verloren. Doorgaan?`,
    );
    if (!confirmed) return;
    try {
      setResult({ok: true, text: importSummary(await importDraaiboek.mutateAsync({callSheetId, file}))});
    } catch (e) {
      setResult({ok: false, text: e instanceof Error ? e.message : 'Importeren mislukt'});
    }
  }

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON} disabled={disabled} title={title}
                onClick={() => callSheetId && downloadExport(`/api/production/callsheets/${callSheetId}/export-json`, `draaiboek-${productionId}.json`)}>
          <MdDownload/> Exporteer JSON
        </button>
        <button type="button" className={BUTTON} disabled={disabled} title={title}
                onClick={() => callSheetId && downloadExport(`/api/production/callsheets/${callSheetId}/export-excel`, `draaiboek-${productionId}.xlsx`)}>
          <MdDownload/> Exporteer Excel
        </button>
        <button type="button" className={BUTTON} disabled={disabled || importDraaiboek.isPending} title={title}
                onClick={() => fileInput.current?.click()}>
          <MdUpload/> {importDraaiboek.isPending ? 'Importeren…' : 'Importeer draaiboek'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Draaiboekbestand (JSON)"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // the same file can be chosen again
            if (file) void handleFile(file);
          }}
        />
      </div>
      {result && (
        <div role={result.ok ? 'status' : 'alert'}
             className={`rounded-md border px-3 py-2 text-sm ${result.ok
               ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
               : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
          {result.text}
        </div>
      )}
    </div>
  );
}
