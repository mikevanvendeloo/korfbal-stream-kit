import React from 'react';

interface MultiSelectOption {
  label: string;
  value: number;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: number[];
  onChange: (selectedValues: number[]) => void;
  placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleCheckboxChange = (optionValue: number) => {
    const newSelected = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newSelected);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center justify-between w-full border rounded px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700 text-left cursor-pointer"
        onClick={handleToggle}
      >
        <span className="flex-grow">
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : (
            <span className="text-gray-500">{placeholder || 'Selecteer...'}</span>
          )}
        </span>
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-gray-500">Geen opties beschikbaar</div>
          ) : (
            options.map((option) => (
              <label key={option.value} className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600 dark:text-blue-400 rounded"
                  checked={value.includes(option.value)}
                  onChange={() => handleCheckboxChange(option.value)}
                />
                <span className="ml-2 text-gray-800 dark:text-gray-100">{option.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
