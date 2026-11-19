import {describe, expect, it} from 'vitest';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {confirmDialog, promptDialog} from './dialogs';

async function openConfirm(...args: Parameters<typeof confirmDialog>) {
  let answer!: Promise<boolean>;
  await act(async () => { answer = confirmDialog(...args); });
  return {answer};
}

async function openPrompt(...args: Parameters<typeof promptDialog>) {
  let answer!: Promise<string | null>;
  await act(async () => { answer = promptDialog(...args); });
  return {answer};
}

describe('confirmDialog', () => {
  it('shows the question and resolves true on the confirm button', async () => {
    const {answer} = await openConfirm('Item verwijderen?', {title: 'Verwijderen', confirmLabel: 'Verwijderen', danger: true});
    const dialog = screen.getByRole('alertdialog', {name: 'Verwijderen'});
    expect(dialog).toHaveTextContent('Item verwijderen?');
    expect(screen.getByRole('button', {name: 'Verwijderen'})).toHaveClass('bg-red-600');
    fireEvent.click(screen.getByRole('button', {name: 'Verwijderen'}));
    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument());
  });

  it('resolves false on Annuleren, Escape and a click next to it', async () => {
    let {answer} = await openConfirm('Doorgaan?');
    fireEvent.click(screen.getByRole('button', {name: 'Annuleren'}));
    await expect(answer).resolves.toBe(false);

    ({answer} = await openConfirm('Doorgaan?'));
    fireEvent.keyDown(screen.getByRole('button', {name: 'OK'}), {key: 'Escape'});
    await expect(answer).resolves.toBe(false);

    ({answer} = await openConfirm('Doorgaan?'));
    fireEvent.mouseDown(screen.getByTestId('app-dialog').parentElement as HTMLElement);
    await expect(answer).resolves.toBe(false);
  });

  it('focuses the confirm button and gives the focus back afterwards', async () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const {answer} = await openConfirm('Doorgaan?');
    expect(screen.getByRole('button', {name: 'OK'})).toHaveFocus();
    fireEvent.click(screen.getByRole('button', {name: 'OK'}));
    await answer;
    expect(button).toHaveFocus();
    button.remove();
  });
});

describe('promptDialog', () => {
  it('resolves with the typed text on Enter', async () => {
    const {answer} = await openPrompt('Naam van het nieuwe template', {defaultValue: 'Thuis'});
    const input = screen.getByRole('textbox', {name: 'Naam van het nieuwe template'});
    expect(input).toHaveValue('Thuis');
    expect(input).toHaveFocus();
    fireEvent.change(input, {target: {value: 'Uit'}});
    fireEvent.submit(input);
    await expect(answer).resolves.toBe('Uit');
  });

  it('resolves null on Annuleren', async () => {
    const {answer} = await openPrompt('Seconden');
    fireEvent.click(screen.getByRole('button', {name: 'Annuleren'}));
    await expect(answer).resolves.toBeNull();
  });
});
