import React from 'react';
import {useSegmentTemplates} from '../hooks/useSegmentTemplates';
import {MdViewList} from 'react-icons/md';
import IconButton from "./IconButton";

interface SegmentTemplateSelectorProps {
  productionId: number;
  onTemplateApplied?: () => void;
}

export function SegmentTemplateSelector({ productionId, onTemplateApplied }: SegmentTemplateSelectorProps) {
  const { templates, applyTemplate, isLoading } = useSegmentTemplates();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleApply = async (templateId: number) => {
    if (window.confirm('Weet je zeker dat je deze segment template wilt toepassen? Alle huidige segmenten en hun specifieke bezetting voor deze productie worden verwijderd.')) {
      try {
        await applyTemplate.mutateAsync({ templateId, productionId });
        setIsOpen(false);
        if (onTemplateApplied) onTemplateApplied();
      } catch (err: any) {
        alert('Toepassen mislukt: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  if (isLoading) return null;
  if (templates.length === 0) return null;

  return (
    <div className="relative">
      <IconButton
        ariaLabel="Template toepassen"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MdViewList className="w-5 h-5" />
      </IconButton>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20 py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              Kies een segment template
            </div>
            <div className="max-h-60 overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleApply(template.id)}
                  disabled={applyTemplate.isPending}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between group"
                >
                  <span>{template.name}</span>
                  {applyTemplate.isPending && <span className="text-xs animate-pulse">Bezig...</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
