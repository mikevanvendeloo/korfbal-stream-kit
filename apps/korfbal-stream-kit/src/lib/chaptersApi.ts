import {createUrl, extractError} from './api';
import type {Structure} from './chapterStructure';

/**
 * Hoofdstukken of a draaiboek template and of a production (openspec/changes/chapters D4). Every call
 * throws with the server's message, for the page to show.
 */

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(createUrl(path), {
    method,
    headers: body === undefined ? undefined : {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res;
}

// Draaiboek templates
export const addTemplateChapter = async (templateId: number, name: string) =>
  (await send(`/api/callsheets/templates/${templateId}/chapters`, 'POST', {name})).json() as Promise<{ id: string; name: string }>;
export const updateTemplateChapter = (chapterId: string, change: { name?: string; positionIds?: number[] }) =>
  send(`/api/callsheets/templates/chapters/${encodeURIComponent(chapterId)}`, 'PUT', change);
export const deleteTemplateChapter = (chapterId: string) => send(`/api/callsheets/templates/chapters/${encodeURIComponent(chapterId)}`, 'DELETE');
export const saveTemplateStructure = (templateId: number, chapters: Structure<string>) =>
  send(`/api/callsheets/templates/${templateId}/structure`, 'PUT', {chapters});

// Productions (the hoofdstukken belong to the production; the order is saved per callsheet)
export const addProductionChapter = async (productionId: number, name: string) =>
  (await send(`/api/production/${productionId}/chapters`, 'POST', {name})).json() as Promise<{ id: number; name: string }>;
export const renameProductionChapter = (chapterId: number, name: string) => send(`/api/production/chapters/${chapterId}`, 'PUT', {name});
export const deleteProductionChapter = (chapterId: number) => send(`/api/production/chapters/${chapterId}`, 'DELETE');
export const saveCallSheetStructure = (callSheetId: number, chapters: Structure<number>) =>
  send(`/api/production/callsheets/${callSheetId}/structure`, 'PUT', {chapters});

/** Opslaan als template: the callsheet with its hoofdstukken as a new draaiboek template. */
export const saveCallSheetAsTemplate = async (callSheetId: number, name: string) =>
  (await send(`/api/callsheets/templates/from-callsheet/${callSheetId}`, 'POST', {name})).json() as Promise<{ id: number; name: string }>;
