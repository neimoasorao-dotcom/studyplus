'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Check } from 'lucide-react';

export type AutocompleteOption = { id: string; label: string; detail?: string };
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();

/** A supplementary picker: selection always uses the existing form callback. */
export function Autocomplete({ label, options, selectedId, disabled, onSelect }: {
    label: string;
    options: AutocompleteOption[];
    selectedId?: string;
    disabled?: boolean;
    onSelect: (id: string) => void;
}) {
    const id = useId(), input = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState(''), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
    const matches = useMemo(() => options.filter(option => normalize(option.label).includes(normalize(query))), [options, query]);
    useEffect(() => setActive(-1), [options]);
    const activeId = active >= 0 && active < matches.length ? `${id}-option-${active}` : undefined;
    function choose(option: AutocompleteOption) {
        onSelect(option.id);
        setQuery('');
        setOpen(false);
        setActive(-1);
        input.current?.focus({ preventScroll: true });
    }
    function focusOption(next: number) {
        const index = Math.max(0, Math.min(matches.length - 1, next));
        setActive(index);
        requestAnimationFrame(() => document.getElementById(`${id}-option-${index}`)?.scrollIntoView({ block: 'nearest' }));
    }
    return <div className="material-autocomplete" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); }
    }}>
        <label className="field" htmlFor={`${id}-input`}><span>{label}</span><div className="autocomplete-input"><Search size={16} aria-hidden="true"/><input
            ref={input} id={`${id}-input`} role="combobox" type="search" autoComplete="off" disabled={disabled}
            aria-autocomplete="list" aria-expanded={open && !disabled} aria-controls={open && !disabled ? `${id}-list` : undefined} aria-activedescendant={open && !disabled ? activeId : undefined}
            value={query} placeholder="教材名の一部で検索" onFocus={() => setOpen(true)}
            onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
                else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); focusOption(active < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1) : active + (event.key === 'ArrowDown' ? 1 : -1)); }
                else if (open && (event.key === 'Home' || event.key === 'End')) { event.preventDefault(); focusOption(event.key === 'Home' ? 0 : matches.length - 1); }
                else if (event.key === 'Enter' && open) { event.preventDefault(); if (matches[active]) choose(matches[active]); }
            }}/></div></label>
        {open && !disabled && <div className="autocomplete-popup">
            <span className="autocomplete-count" role="status">{matches.length ? `${matches.length}件 · 現在の並び順` : '一致する教材がありません'}</span>
            <ul id={`${id}-list`} role="listbox" aria-label={label}>{matches.map((option, index) => <li key={option.id} id={`${id}-option-${index}`} role="option" aria-selected={selectedId === option.id} data-highlighted={active === index || undefined}>
                <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
                    <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>{selectedId === option.id && <Check size={16} aria-hidden="true"/>}
                </button>
            </li>)}</ul>
        </div>}
    </div>;
}
