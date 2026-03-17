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
    if (!trimmed || value.length >= maxPills) return;
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
        <label htmlFor={id} className="label label-text font-medium pb-1">
          {label}
        </label>
      )}
      {/* Pill container styled like an input */}
      <div
        className={`flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-lg border border-base-300 bg-base-300 focus-within:border-primary focus-within:outline focus-within:outline-2 focus-within:outline-primary/30 transition-all cursor-text ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((pill, index) => (
          <span
            key={`${pill}-${index}`}
            className="badge badge-soft badge-primary gap-1 text-sm"
          >
            {pill}
            <button
              type="button"
              onClick={() => !disabled && removePill(index)}
              disabled={disabled}
              className="btn btn-ghost btn-circle"
              style={{ width: '16px', height: '16px', minHeight: 'unset', padding: 0 }}
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
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-base-content placeholder:opacity-40"
          />
        )}
      </div>
      {value.length >= maxPills && (
        <p className="text-xs text-warning mt-1">Maximum {maxPills} items reached</p>
      )}
    </div>
  );
}
