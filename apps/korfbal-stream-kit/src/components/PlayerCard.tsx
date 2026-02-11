import React from 'react';
import {createUrl} from '../lib/api';

type PlayerCardProps = {
  name: string;
  photoUrl?: string | null;
  shirtNo?: number | null;
  function?: string | null;
  className?: string;
};

export default function PlayerCard({name, photoUrl, shirtNo, function: playerFunction, className = ''}: PlayerCardProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Photo */}
      <div className="w-48 h-48 overflow-hidden rounded-lg mb-3 bg-gray-100 dark:bg-gray-800">
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
