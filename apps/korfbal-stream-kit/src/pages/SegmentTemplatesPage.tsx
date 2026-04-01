import React, {useState} from 'react';
import {SegmentTemplate, useSegmentTemplates} from '../hooks/useSegmentTemplates';
import {Card, CardContent, CardHeader, CardTitle} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Anchor, Check, Clock, Edit2, Plus, Trash2, X} from 'lucide-react';
import {Input} from '../components/ui/input';

export default function SegmentTemplatesPage() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, addItem, updateItem, deleteItem, setDefaultTemplate } = useSegmentTemplates();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createTemplate.mutateAsync(newName);
    setNewName('');
    setIsAdding(false);
  };

  const handleUpdateTemplate = async (id: number) => {
    if (!editingName.trim()) return;
    await updateTemplate.mutateAsync({ id, name: editingName });
    setEditingTemplateId(null);
  };

  const handleDeleteTemplate = async (id: number) => {
    if (window.confirm('Weet je zeker dat je deze segment template wilt verwijderen?')) {
      await deleteTemplate.mutateAsync(id);
    }
  };

  if (isLoading) return <div className="p-8 text-white">Laden...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Segment Templates</h1>
          <p className="text-white/60">Beheer templates voor wedstrijdsegmenten (bijv. KorfbalLeague, Reserve, Oploop).</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nieuwe Template
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-white/5 border-white/10 mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Input
                placeholder="Naam van de template..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-black/20 border-white/10 text-white"
                autoFocus
              />
              <Button onClick={handleCreate} disabled={createTemplate.isPending || !newName.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                Opslaan
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="ghost" className="text-white">
                Annuleren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isEditingName={editingTemplateId === template.id}
            editingName={editingName}
            setEditingName={setEditingName}
            onEditName={() => {
              setEditingTemplateId(template.id);
              setEditingName(template.name);
            }}
            onSaveName={() => handleUpdateTemplate(template.id)}
            onCancelEditName={() => setEditingTemplateId(null)}
            onDelete={() => handleDeleteTemplate(template.id)}
            onSetDefault={() => setDefaultTemplate.mutate(template.id)}
            onAddItem={(data) => addItem.mutate({ templateId: template.id, data })}
            onUpdateItem={(itemId, data) => updateItem.mutate({ itemId, data })}
            onDeleteItem={(itemId) => deleteItem.mutate(itemId)}
          />
        ))}
        {templates.length === 0 && !isAdding && (
          <div className="text-center py-12 text-white/40 border-2 border-dashed border-white/10 rounded-xl">
            Geen segment templates gevonden. Maak er een aan om te beginnen.
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isEditingName,
  editingName,
  setEditingName,
  onEditName,
  onSaveName,
  onCancelEditName,
  onDelete,
  onSetDefault,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: {
  template: SegmentTemplate;
  isEditingName: boolean;
  editingName: string;
  setEditingName: (val: string) => void;
  onEditName: () => void;
  onSaveName: () => void;
  onCancelEditName: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onAddItem: (data: any) => void;
  onUpdateItem: (itemId: number, data: any) => void;
  onDeleteItem: (itemId: number) => void;
}) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDuration, setNewItemDuration] = useState(10);
  const [newItemIsAnchor, setNewItemIsAnchor] = useState(false);

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    onAddItem({
      naam: newItemName,
      duurInMinuten: newItemDuration,
      isTimeAnchor: newItemIsAnchor,
    });
    setNewItemName('');
    setNewItemDuration(10);
    setNewItemIsAnchor(false);
    setIsAddingItem(false);
  };

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="bg-black/20 border-white/20 text-white h-8"
                autoFocus
              />
              <Button size="sm" onClick={onSaveName} className="bg-green-600 hover:bg-green-700 h-8 w-8 p-0 text-white">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEditName} className="h-8 w-8 p-0 text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <CardTitle className="text-xl text-white">{template.name}</CardTitle>
              {template.isDefault && (
                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight">
                  Standaard
                </span>
              )}
              <Button size="sm" variant="ghost" onClick={onEditName} className="text-white/40 hover:text-white">
                <Edit2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!template.isDefault && (
            <Button size="sm" variant="ghost" onClick={onSetDefault} className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/30">
              <Check className="w-4 h-4 mr-2" />
              Maak Standaard
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 hover:bg-red-950/30">
            <Trash2 className="w-4 h-4 mr-2" />
            Template Verwijderen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-left text-white border-collapse">
          <thead>
            <tr className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
              <th className="px-6 py-3 font-medium">Volgorde</th>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Duur (min)</th>
              <th className="px-6 py-3 font-medium text-center">Tijdsanker</th>
              <th className="px-6 py-3 font-medium text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {template.items?.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-white/40">{item.volgorde}</td>
                <td className="px-6 py-4 font-medium">{item.naam}</td>
                <td className="px-6 py-4 text-sm text-white/60">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {item.duurInMinuten} min
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {item.isTimeAnchor ? (
                    <div className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight">
                      <Anchor className="w-3 h-3" /> Anker
                    </div>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/40 hover:text-white h-8 w-8 p-0"
                        onClick={() => {
                          const newName = window.prompt('Nieuwe naam:', item.naam);
                          const newDuration = window.prompt('Nieuwe duur (minuten):', String(item.duurInMinuten));
                          if (newName !== null && newDuration !== null) {
                            onUpdateItem(item.id, {
                              naam: newName,
                              duurInMinuten: Number(newDuration),
                              isTimeAnchor: item.isTimeAnchor
                            });
                          }
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 w-8 p-0 ${item.isTimeAnchor ? 'text-blue-400' : 'text-white/40 hover:text-blue-400'}`}
                        title="Markeer als tijdsanker"
                        onClick={() => onUpdateItem(item.id, { isTimeAnchor: !item.isTimeAnchor })}
                      >
                        <Anchor className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400/60 hover:text-red-400 h-8 w-8 p-0"
                        onClick={() => {
                          if (window.confirm('Verwijderen?')) onDeleteItem(item.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                </td>
              </tr>
            ))}
            {isAddingItem ? (
              <tr className="bg-blue-500/5">
                <td className="px-6 py-4"></td>
                <td className="px-6 py-4">
                  <Input
                    placeholder="Naam..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="bg-black/40 border-white/20 text-white h-8"
                    autoFocus
                  />
                </td>
                <td className="px-6 py-4">
                  <Input
                    type="number"
                    value={newItemDuration}
                    onChange={(e) => setNewItemDuration(Number(e.target.value))}
                    className="bg-black/40 border-white/20 text-white h-8 w-20"
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={newItemIsAnchor}
                    onChange={(e) => setNewItemIsAnchor(e.target.checked)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                      Toevoegen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsAddingItem(false)} className="text-white h-8">
                      X
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingItem(true)}
                    className="w-full justify-start text-white/40 hover:text-white hover:bg-white/5 border border-dashed border-white/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Segment Toevoegen
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
