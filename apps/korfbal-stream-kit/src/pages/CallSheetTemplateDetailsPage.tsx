import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {FullCallSheetTemplate, useCallSheetTemplates} from '../hooks/useCallSheetTemplates';
import {Card, CardContent} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Anchor, FastForward, FilePenLine, Plus, Save, Trash2} from 'lucide-react';
import {Input} from '../components/ui/input';
import {usePositionsCatalog} from "../hooks/usePositions";
import {MdArrowBack} from "react-icons/md";


export default function CallSheetTemplateDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchTemplate, updateTemplate, addTemplateItem, updateTemplateItem, deleteTemplateItem, loading } = useCallSheetTemplates();
  const { data: positions = [], isLoading: positionsLoading, error: positionsError } = usePositionsCatalog();
  const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
  const [template, setTemplate] = useState<FullCallSheetTemplate | null>(null);
  const [isEditingItem, setIsEditingItem] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  const loadData = async () => {
    if (id) {
      const data = await fetchTemplate(Number(id));
      setTemplate(data);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, fetchTemplate]);

  const handleUpdateName = async () => {
    if (!id || !newName) return;
    const ok = await updateTemplate(Number(id), newName);
    if (ok) {
      setIsEditingName(false);
      loadData();
    }
  };

  const handleAddItem = async () => {
    if (!id || !template) return;
    const showcaller = positions.find(p => p.name === 'Showcaller');
    const newItem = await addTemplateItem(template.id, {
      title: 'Nieuw item',
      durationSec: 60,
      orderIndex: (template?.items?.length || 0) + 1,
      isInLivestream: true,
      isInVenue: false,
      positionIds: showcaller ? [showcaller.id] : []
    });
    if (newItem) loadData();
  };

  const handleStartEdit = (item: any) => {
    setIsEditingItem(item.id);
    setEditData({
      ...item,
      positionIds: item.positions.map((p: any) => p.positionId)
    });
  };

  const handleSaveEdit = async () => {
    if (!isEditingItem) return;
    const ok = await updateTemplateItem(isEditingItem, editData);
    if (ok) {
      setIsEditingItem(null);
      loadData();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm('Item verwijderen?')) {
      const ok = await deleteTemplateItem(itemId);
      if (ok) loadData();
    }
  };

  const togglePosition = (posId: number) => {
    const current = editData.positionIds || [];
    const showcaller = positions.find(p => p.name === 'Showcaller');

    if (showcaller && posId === showcaller.id) return; // Kan showcaller niet uitvinken

    if (current.includes(posId)) {
      setEditData({ ...editData, positionIds: current.filter((p: number) => Number(p) !== Number(posId)) });
    } else {
      setEditData({ ...editData, positionIds: [...current, Number(posId)] });
    }
  };

  if (!template && !loading) return <div className="p-10 text-white">Template niet gevonden</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/callsheets/templates')}>
          <MdArrowBack className="text-white" />
        </Button>
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-black/40 border-white/10 text-white text-3xl font-bold h-12 w-96"
              autoFocus
            />
            <Button size="icon" onClick={handleUpdateName} className="bg-green-600 hover:bg-green-700">
              <Save className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4 group">
            <h1 className="text-3xl font-bold text-white">{template?.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                setNewName(template?.name || '');
                setIsEditingName(true);
              }}
            >
              <FilePenLine className="w-4 h-4 text-white/40" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {template?.items?.map((item) => (
          <Card key={item.id} className="bg-white/5 border-white/10 overflow-hidden">
            <CardContent className="p-0">
              {isEditingItem === item.id ? (
                <div className="p-6 space-y-4 bg-blue-900/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-white/40 uppercase">Titel</label>
                      <Input
                        value={editData.title}
                        onChange={e => setEditData({...editData, title: (e.target as HTMLInputElement).value})}
                        className="bg-black/40 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-white/40 uppercase">Duur (seconden)</label>
                      <Input
                        type="number"
                        value={editData.durationSec}
                        onChange={e => setEditData({...editData, durationSec: Number((e.target as HTMLInputElement).value)})}
                        className="bg-black/40 border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-white/40 uppercase">Notitie</label>
                    <Input
                      value={editData.note || ''}
                      onChange={e => setEditData({...editData, note: e.target.value})}
                      className="bg-black/40 border-white/10 text-white"
                    />
                  </div>

                  <div className="flex gap-6 py-2">
                    <label className="flex items-center gap-2 text-white cursor-pointer">
                      <input type="checkbox" checked={editData.isInVenue} onChange={e => setEditData({...editData, isInVenue: e.target.checked})} />
                      Zaal
                    </label>
                    <label className="flex items-center gap-2 text-white cursor-pointer">
                      <input type="checkbox" checked={editData.isInLivestream} onChange={e => setEditData({...editData, isInLivestream: e.target.checked})} />
                      Stream
                    </label>
                    <label className="flex items-center gap-2 text-white cursor-pointer">
                      <input type="checkbox" checked={editData.isTimeAnchor} onChange={e => setEditData({...editData, isTimeAnchor: e.target.checked})} />
                      Tijd Anchor
                    </label>
                    {editData.isTimeAnchor && (
                      <select
                        value={editData.anchorType || ''}
                        onChange={e => setEditData({...editData, anchorType: e.target.value})}
                        className="bg-black/40 border-white/10 text-white text-xs rounded px-2 py-1 outline-none"
                      >
                        <option value="">Kies type...</option>
                        <option value="MATCH_START">Wedstrijd starttijd</option>
                        <option value="LIVESTREAM_START">Livestream start</option>
                      </select>
                    )}
                    <label className="flex items-center gap-2 text-white cursor-pointer">
                      <input type="checkbox" checked={editData.autoAdvance} onChange={e => setEditData({...editData, autoAdvance: e.target.checked})} />
                      Auto Advance
                    </label>

                    <div className="flex flex-col gap-1 min-w-[200px]">
                      <label className="text-xs text-white/40 uppercase">Koppel aan item (Parent)</label>
                      <select
                        value={editData.parentId || ''}
                        onChange={e => setEditData({...editData, parentId: e.target.value || null})}
                        className="bg-black/40 border-white/10 text-white text-xs rounded px-2 py-1 outline-none focus:border-blue-500/50"
                      >
                        <option value="">Geen (Hoofdlijn)</option>
                        {template?.items
                          ?.filter(it => it.id !== editData.id)
                          ?.map(it => (
                            <option key={it.id} value={it.id}>
                              {it.title}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-white/40 uppercase font-bold">Posities (vink aan om toe te wijzen)</label>
                    {positionsLoading ? (
                      <div className="text-white/40 text-xs italic">Posities laden...</div>
                    ) : positionsError ? (
                      <div className="text-red-400 text-xs italic">Fout bij laden posities: {(positionsError as Error).message}</div>
                    ) : sortedPositions.length === 0 ? (
                      <div className="text-orange-400 text-xs italic">Geen posities gevonden in de catalogus. Ga naar de posities-pagina om deze aan te maken.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-black/20 p-3 rounded-lg border border-white/5">
                        {sortedPositions.map(pos => {
                          const isShowcaller = pos.name === 'Showcaller';
                          const isSelected = (editData.positionIds || []).some((id: number) => Number(id) === Number(pos.id)) || isShowcaller;
                          return (
                            <label
                              key={pos.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600/20 border border-blue-500/50 text-white'
                                  : 'bg-white/5 border border-transparent text-white/40 hover:bg-white/10'
                              } ${isShowcaller ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isShowcaller}
                                onChange={() => togglePosition(pos.id)}
                                className="w-4 h-4 rounded border-white/20 bg-black/40 text-blue-600 focus:ring-blue-500/50"
                              />
                              <span className="text-xs font-medium truncate">{pos.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setIsEditingItem(null)}>Annuleren</Button>
                    <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                      <Save className="w-4 h-4 mr-2" /> Opslaan
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center p-4 hover:bg-white/5 transition-colors group">
                  <div className="w-16 font-mono text-white/40 text-sm">{item.durationSec}s</div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{item.title}</span>
                      {item.isTimeAnchor && (
                        <div className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-[10px] border border-orange-500/30 font-bold uppercase">
                          <Anchor className="w-3 h-3" />
                          {item.anchorType === 'MATCH_START' ? 'Wedstrijd Start' : item.anchorType === 'LIVESTREAM_START' ? 'Stream Start' : 'Anchor'}
                        </div>
                      )}
                      {item.autoAdvance && <FastForward className="w-3 h-3 text-purple-400" />}
                    </div>
                    {item.note && <div className="text-xs text-white/40 italic">{item.note}</div>}
                    <div className="flex gap-2 mt-1">
                      {item.isInVenue && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase border border-amber-500/30">Zaal</span>}
                      {item.isInLivestream && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase border border-blue-500/30">Stream</span>}
                      {item.positions?.map(p => (
                        <span key={p.positionId} className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-medium">
                          {p.position.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleStartEdit(item)}>
                      <FilePenLine className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-400" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          onClick={handleAddItem}
          variant="outline"
          className="w-full border-dashed border-white/10 hover:bg-white/5 py-8 text-white/40 hover:text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Item toevoegen
        </Button>
      </div>
    </div>
  );
}
