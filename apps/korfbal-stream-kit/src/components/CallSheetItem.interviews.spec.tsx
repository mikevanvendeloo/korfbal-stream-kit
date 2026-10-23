import {fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CallSheetItem} from './CallSheetItem';
import {StaticInterviewNames} from './InterviewText';
import {InterviewPhotosToggle} from './InterviewPhotosToggle';
import {INTERVIEW_PHOTOS_STORAGE_KEY, resetInterviewPhotosForTests} from '../hooks/useInterviewPhotos';
import {interviewNames} from '../test/interviews';
import {showItem} from '../test/showCaller';

vi.mock('../hooks/useFontSize', () => ({useFontSize: () => ({fontSize: 'm'})}));

function renderItem(title: string, extra: {note?: string; showInterviewPhotos?: boolean} = {}) {
  const {showInterviewPhotos, ...rest} = extra;
  return render(
    <StaticInterviewNames names={interviewNames}>
      <InterviewPhotosToggle/>
      <CallSheetItem item={showItem('i', 1, title, rest)} showInterviewPhotos={showInterviewPhotos}/>
    </StaticInterviewNames>
  );
}

describe('CallSheetItem interview photos', () => {
  beforeEach(() => {
    window.localStorage.removeItem(INTERVIEW_PHOTOS_STORAGE_KEY);
    resetInterviewPhotosForTests();
  });

  it('puts a photo next to each filled-in name, from title and note', () => {
    renderItem('Interview {speler-thuis} & {coach-uit:kort}', {note: 'Daarna {speler-tegenstander:achternaam}'});

    const people = screen.getAllByTestId('interview-person');
    expect(people.map((p) => p.textContent)).toEqual(['Anna de Vries#7', 'KCK. Coach', '12Bakker']);
    // Anna has a photo (and her number next to the name), Kees is a coach (initials), Bram has no photo (number)
    expect(within(people[0]).getByRole('img', {name: 'Foto van Anna de Vries'})).toBeTruthy();
    expect(within(people[1]).getByRole('img', {name: 'Kees Coach'}).textContent).toBe('KC');
    expect(within(people[2]).getByRole('img', {name: 'Bram Bakker, rugnummer 12'}).textContent).toBe('12');
  });

  it('shows no photo for a placeholder nobody is chosen for, nor for plain text', () => {
    renderItem('Interview {coach-thuis} en de presentator');
    expect(screen.queryAllByTestId('interview-person')).toEqual([]);
    expect(screen.getByRole('heading').textContent).toBe('Interview coach thuis en de presentator');
  });

  it('leaves the photos out where the view says so (Show Caller: only current and next)', () => {
    renderItem('Interview {speler-thuis}', {showInterviewPhotos: false});
    expect(screen.queryAllByTestId('interview-person')).toEqual([]);
    expect(screen.getByRole('heading').textContent).toBe('Interview Anna de Vries');
  });

  it('hides the photos with the Interviewfoto\'s switch, and keeps that choice', () => {
    renderItem('Interview {speler-thuis}');
    const toggle = screen.getByRole('switch', {name: /Interviewfoto's/});
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryAllByTestId('interview-person')).toEqual([]);
    expect(screen.getByRole('heading').textContent).toBe('Interview Anna de Vries');
    expect(window.localStorage.getItem(INTERVIEW_PHOTOS_STORAGE_KEY)).toBe('off');
  });
});
