import { useState, useRef } from 'react';
import { X } from 'lucide-react';

export default function PillTagInput({
  value = [],
  onChange,
  placeholder = 'Type and press Enter...',
  maxPills = 20,
  allowDuplicates = false,
  disabled = false,
  label,
  id,
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addPill();
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removePill(value.length - 1);
    }
  };

  const addPill = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    if (value.length >= maxPills) {
      return;
    }

    if (!allowDuplicates && value.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue('');
      return;
    }

    onChange([...value, trimmed]);
    setInputValue('');
  };

  const removePill = (index) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <div 
        className={`flex flex-wrap gap-1.5 p-2 bg-gray-900/50 border border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((pill, index) => (
          <span
            key={`${pill}-${index}`}
            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600/30 text-indigo-200 text-sm rounded-md border border-indigo-500/40"
          >
            {pill}
            <button
              type="button"
              onClick={() => !disabled && removePill(index)}
              disabled={disabled}
              className="hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
              aria-label={`Remove ${pill}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            id={id}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addPill}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-gray-200 placeholder-gray-500"
          />
        )}
      </div>
      {value.length >= maxPills && (
        <p className="text-xs text-amber-400 mt-1">Maximum {maxPills} items reached</p>
      )}
    </div>
  );
}
