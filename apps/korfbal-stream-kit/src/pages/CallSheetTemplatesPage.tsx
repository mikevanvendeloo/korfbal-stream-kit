import React, {useEffect, useState} from 'react';
import {CallSheetTemplate, useCallSheetTemplates} from '../hooks/useCallSheetTemplates';
import {Card, CardContent, CardHeader, CardTitle} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Download, FileSpreadsheet, Plus, Trash2, Upload} from 'lucide-react';
import {Input} from '../components/ui/input';
import {Link} from 'react-router-dom';
import {createUrl} from "../lib/api";

export default function CallSheetTemplatesPage() {
  const { fetchTemplates, createTemplate, deleteTemplate, importTemplate, loading } = useCallSheetTemplates();
  const [templates, setTemplates] = useState<CallSheetTemplate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importName, setImportName] = useState('');

  const loadTemplates = async () => {
    const data = await fetchTemplates();
    setTemplates(data);
  };

  useEffect(() => {
    loadTemplates();
  }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await createTemplate(newName);
    if (created) {
      setNewName('');
      setIsAdding(false);
      loadTemplates();
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Weet je zeker dat je dit draaiboek wilt verwijderen?')) {
      const ok = await deleteTemplate(id);
      if (ok) loadTemplates();
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importName.trim()) return;

    const imported = await importTemplate(importName, file);
    if (imported) {
      setImportName('');
      setIsImporting(false);
      loadTemplates();
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Draaiboeken</h1>
          <p className="text-white/60">Beheer callsheet templates die je kunt toepassen op producties.</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setIsImporting(true)}
            variant="outline"
            className="border-white/10 hover:bg-white/5"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importeren
          </Button>
          <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nieuw Draaiboek
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="bg-white/5 border-white/10 mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Input
                placeholder="Naam van het draaiboek..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-black/20 border-white/10 text-white"
                autoFocus
              />
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                Opslaan
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="ghost">
                Annuleren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isImporting && (
        <Card className="bg-white/5 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-lg">Draaiboek importeren uit Excel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Naam voor het nieuwe draaiboek..."
                value={importName}
                onChange={(e) => setImportName((e.target as HTMLInputElement).value)}
                className="bg-black/20 border-white/10 text-white"
              />
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".xlsx"
                  onChange={handleImport}
                  disabled={!importName.trim()}
                  className="bg-black/20 border-white/10 text-white cursor-pointer"
                />
                <Button onClick={() => setIsImporting(false)} variant="ghost">
                  Annuleren
                </Button>
              </div>
              <p className="text-xs text-white/40 italic">
                De Excel moet de volgende kolommen bevatten: Titel, Notitie, Duur (sec), Posities, Tijd Anchor, Anchor Type, Auto Advance, Zaal, Stream.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-semibold text-white">
                {template.name}
              </CardTitle>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={createUrl(`/api/callsheets/templates/${template.id}/export`)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white"
                  title="Exporteren naar Excel"
                >
                  <Download className="w-4 h-4" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <span className="text-white/40 text-sm">
                  {template._count?.items || 0} items
                </span>
                <Link to={`/admin/callsheets/templates/${template.id}`}>
                  <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5">
                    Bekijken / Bewerken
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-xl">
            <FileSpreadsheet className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">Geen draaiboeken gevonden. Maak er een aan of importeer uit Excel.</p>
          </div>
        )}
      </div>
    </div>
  );
}
