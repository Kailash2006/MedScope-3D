"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

// Accessible custom dropdown (listbox) that matches the glass design system.
// The popup is position:fixed and anchored to the trigger so it is never
// clipped by an ancestor's overflow (e.g. the intake console).
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  ariaLabel,
  id,
  style,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;

  const selected = options.find((o) => o.value === value && o.value !== "");

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (b) setRect({ left: b.left, top: b.bottom + 6, width: b.width });
  };
  const openMenu = () => {
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (v: string) => { onChange(v); close(); btnRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); close(); btnRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (active >= 0) choose(options[active].value); }
  };

  return (
    <div className="sel" style={{ position: "relative", ...style }}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        className="input sel-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "" : "sel-placeholder"}>{selected ? selected.label : placeholder}</span>
        <svg className="sel-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && rect && (
        <ul
          ref={listRef}
          role="listbox"
          id={listId}
          aria-label={ariaLabel}
          className="sel-list glass"
          style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width }}
        >
          {options.map((o, i) => (
            <li
              key={o.value || "__empty"}
              role="option"
              aria-selected={o.value === value}
              className="sel-option"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
            >
              <span>{o.label}</span>
              {o.value === value && <span className="sel-check" aria-hidden>✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
