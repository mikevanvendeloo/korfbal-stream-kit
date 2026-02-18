import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

type SimpleCalendarProps = {
  value: Date;
  onChange: (date: Date) => void;
  markedDates?: string[]; // YYYY-MM-DD
};

export default function SimpleCalendar({ value, onChange, markedDates = [] }: SimpleCalendarProps) {
  // Initialize viewDate based on value, but ensure it's valid
  const [viewDate, setViewDate] = React.useState(() => {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  });

  // Ensure viewDate is always first of month to avoid overflow issues when navigating
  const currentMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  // getDay(): 0=Sun, 1=Mon. We want Mon=0, ..., Sun=6.
  const startDay = (currentMonth.getDay() + 6) % 7;

  const grid: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Preserve local time 00:00:00 roughly, parent handles formatting
    onChange(newDate);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const isMarked = (year: number, month: number, day: number) => {
    // Month is 0-indexed
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const iso = `${year}-${m}-${d}`;
    return markedDates.includes(iso);
  };

  return (
    <div className="p-3 bg-white dark:bg-gray-900 rounded shadow border dark:border-gray-700 w-64 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handlePrev} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"><MdChevronLeft className="w-5 h-5" /></button>
        <div className="font-medium text-gray-800 dark:text-gray-200">
          {currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={handleNext} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"><MdChevronRight className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1 text-gray-500 dark:text-gray-400 font-medium">
        <div>Ma</div><div>Di</div><div>Wo</div><div>Do</div><div>Vr</div><div>Za</div><div>Zo</div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateToCheck = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const isSelected = isSameDay(dateToCheck, value);
          const marked = isMarked(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const isToday = isSameDay(dateToCheck, new Date());

          return (
            <button
              key={day}
              onClick={(e) => handleDayClick(day, e)}
              className={`
                h-8 w-8 rounded-full flex items-center justify-center text-sm relative transition-colors
                ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}
                ${isToday && !isSelected ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}
              `}
            >
              {day}
              {marked && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
