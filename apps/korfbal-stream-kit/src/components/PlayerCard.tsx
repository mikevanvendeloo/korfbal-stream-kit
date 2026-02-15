import React from 'react';
import {createUrl} from '../lib/api';
import {MdDelete, MdEdit} from 'react-icons/md';

type PlayerCardProps = {
  name: string;
  photoUrl?: string | null;
  shirtNo?: number | null;
  function?: string | null;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
};

type PhotoCardProps = {
  photoUrl?: string | null;
  name: string;
}
export function PhotoCard({ photoUrl, name}: Readonly<PhotoCardProps>) {
  return (
    <div className="w-48 h-48 overflow-hidden rounded-lg mb-3 bg-gray-100 dark:bg-gray-800 relative">
      {photoUrl ? (
        <img
          src={createUrl(`/uploads/${photoUrl}`).toString()}
          alt={name}
          className="w-full h-full object-cover scale-125 origin-top"
          style={{objectPosition: 'center top', aspectRatio: '1'}}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function PlayerCard({name, photoUrl, shirtNo, function: playerFunction, className = '', onEdit, onDelete}: PlayerCardProps) {
  return (
    <div className={`flex flex-col items-center text-center relative group ${className}`}>
      {/* Action buttons (visible on hover) */}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              title="Bewerk speler"
            >
              <MdEdit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 bg-white dark:bg-gray-800 rounded-full shadow hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
              title="Verwijder speler"
            >
              <MdDelete className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Photo */}
      <PhotoCard name={name} photoUrl={photoUrl} />

      {/* Name and shirt number */}
      <div className="font-medium text-base">
        {name}
        {shirtNo != null && shirtNo > 0 && (
          <span className="ml-2 text-gray-500 dark:text-gray-400">(#{shirtNo})</span>
        )}
      </div>

      {/* Function/Role */}
      {playerFunction && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{playerFunction}</div>
      )}
    </div>
  );
}
