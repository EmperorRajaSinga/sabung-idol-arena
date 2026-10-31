import React, { useState, useRef, useEffect } from 'react';
import { Idol } from '../types';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface SearchableIdolSelectProps {
  idols: Idol[];
  selectedIdolId: string | null | undefined;
  onSelectIdol: (idolId: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  accentColor?: 'indigo' | 'purple' | 'amber' | 'emerald' | 'red';
  allowClear?: boolean;
  size?: 'sm' | 'md';
}

export const SearchableIdolSelect: React.FC<SearchableIdolSelectProps> = ({
  idols,
  selectedIdolId,
  onSelectIdol,
  placeholder = 'Search idol name or group...',
  className = '',
  label,
  accentColor = 'indigo',
  allowClear = true,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIdol = idols.find((i) => i.id === selectedIdolId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIdols = idols.filter((i) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      i.girlGroup.toLowerCase().includes(q) ||
      (i.seed && i.seed.toLowerCase().includes(q)) ||
      (i.nationality && i.nationality.toLowerCase().includes(q))
    );
  });

  const borderFocusColor =
    accentColor === 'purple'
      ? 'focus-within:ring-purple-500 focus-within:border-purple-500'
      : accentColor === 'amber'
      ? 'focus-within:ring-amber-500 focus-within:border-amber-500'
      : accentColor === 'emerald'
      ? 'focus-within:ring-emerald-500 focus-within:border-emerald-500'
      : accentColor === 'red'
      ? 'focus-within:ring-red-500 focus-within:border-red-500'
      : 'focus-within:ring-indigo-500 focus-within:border-indigo-500';

  const paddingClass = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
          {label}
        </label>
      )}

      {/* Trigger / Input Box */}
      <div
        className={`flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 ${paddingClass} font-semibold text-white transition-all ring-1 ring-transparent ${borderFocusColor} cursor-pointer`}
        onClick={() => setIsOpen(true)}
      >
        <Search className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-slate-400 flex-shrink-0`} />
        
        {selectedIdol && !isOpen && selectedIdol.photoUrl && (
          <img
            src={selectedIdol.photoUrl}
            alt={selectedIdol.name}
            className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} rounded-full object-cover border border-slate-700 flex-shrink-0`}
          />
        )}

        <input
          type="text"
          value={isOpen ? query : selectedIdol ? `${selectedIdol.name} (${selectedIdol.girlGroup})` : ''}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none min-w-0"
        />

        {allowClear && selectedIdol && !isOpen && (
          <button
            type="button"
            title="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onSelectIdol('');
            }}
            className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
          >
            <X className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        )}

        {isOpen && query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
            }}
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        )}

        <ChevronDown
          className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-slate-400 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/98 backdrop-blur-md shadow-2xl p-1.5 space-y-1 divide-y divide-slate-800/40">
          {allowClear && selectedIdolId && (
            <button
              type="button"
              onClick={() => {
                onSelectIdol('');
                setIsOpen(false);
                setQuery('');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-red-400 hover:bg-red-950/40 font-bold transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear slot (Empty)</span>
            </button>
          )}

          {filteredIdols.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 font-medium">
              No idols matching &quot;{query}&quot;
            </div>
          ) : (
            filteredIdols.map((idol) => {
              const isSelected = idol.id === selectedIdolId;
              return (
                <button
                  key={idol.id}
                  type="button"
                  onClick={() => {
                    onSelectIdol(idol.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-indigo-600/30 text-white font-bold border border-indigo-500/30'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {idol.photoUrl ? (
                      <img
                        src={idol.photoUrl}
                        alt={idol.name}
                        className="h-6 w-6 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                        {idol.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="truncate">
                      <span className="font-extrabold block text-white truncate text-xs">
                        {idol.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block truncate">
                        {idol.girlGroup} &bull; {idol.seed}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-indigo-400 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
