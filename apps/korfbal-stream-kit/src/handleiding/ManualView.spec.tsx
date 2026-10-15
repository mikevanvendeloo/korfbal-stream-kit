import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import ManualView from './ManualView';
import HelpButton from './HelpButton';

// jsdom doesn't scroll
beforeAll(() => {
  window.scrollTo = vi.fn() as never;
  Element.prototype.scrollIntoView = vi.fn();
});

function Where() {
  const {pathname, hash} = useLocation();
  return <div data-testid="where">{pathname + hash}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HelpButton/>
      <Routes>
        <Route path="/handleiding" element={<ManualView part="live"/>}/>
        <Route path="/handleiding/:chapter" element={<ManualView part="live"/>}/>
        <Route path="*" element={<div/>}/>
      </Routes>
      <Where/>
    </MemoryRouter>
  );
}

describe('ManualView', () => {
  it('opens the first chapter and lists all chapters', () => {
    renderAt('/handleiding');
    expect(screen.getByTestId('where').textContent).toBe('/handleiding/aan-de-slag');
    expect(screen.getByRole('heading', {level: 1, name: 'Aan de slag met LIVE'})).toBeTruthy();
    const toc = screen.getByRole('navigation', {name: 'Hoofdstukken'});
    expect(toc.textContent).toContain('De Show Caller');
    expect(toc.textContent).toContain('Problemen oplossen');
  });

  it('shows the sections of the open chapter and filters chapters with the search box', () => {
    renderAt('/handleiding/show-caller');
    expect(screen.getByRole('link', {name: 'De knoppen'}).getAttribute('href')).toBe('/handleiding/show-caller#de-knoppen');
    fireEvent.change(screen.getByPlaceholderText('Zoeken…'), {target: {value: 'schotklok'}});
    const toc = screen.getByRole('navigation', {name: 'Hoofdstukken'});
    expect(toc.textContent).toContain('Het scorebord');
    expect(toc.textContent).not.toContain('De Show Caller');
  });

  it('follows links in the text inside the app', () => {
    renderAt('/handleiding/actieve-productie');
    const inText = screen.getAllByRole('link', {name: 'De callsheet'}).find((a) => a.closest('article'));
    if (!inText) throw new Error('no link to the callsheet chapter in the text');
    fireEvent.click(inText);
    expect(screen.getByTestId('where').textContent).toBe('/handleiding/callsheet#interviewnamen');
  });
});

describe('HelpButton', () => {
  it('opens the chapter about the current screen', () => {
    renderAt('/callsheet/12/camera-links');
    expect(screen.getByRole('link', {name: 'Handleiding bij dit scherm'}).getAttribute('href')).toBe('/handleiding/callsheet');
  });
});
