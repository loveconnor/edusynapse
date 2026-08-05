"use client";

import { motion, useReducedMotion } from "motion/react";
import { Search } from "love-ui/icons";
import {
  type ElementType,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  group?: string;
  hint?: string;
  keywords?: string[];
  icon?: ElementType<{
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  badge?: ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
};

export interface CommandPaletteProps {
  items: CommandItem[] | ((query: string) => CommandItem[]);
  /** Opens with Cmd/Ctrl + this key. Default: "k" */
  shortcut?: string;
  placeholder?: string;
  emptyMessage?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function fuzzyMatch(needle: string, hay: string) {
  if (!needle) return true;
  needle = needle.toLowerCase();
  hay = hay.toLowerCase();
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

function firstEnabledIndex(items: CommandItem[]) {
  return items.findIndex((item) => !item.disabled && item.onSelect);
}

function nextEnabledIndex(
  items: CommandItem[],
  current: number,
  direction: 1 | -1,
) {
  if (items.length === 0) return -1;

  for (let step = 1; step <= items.length; step += 1) {
    const index = (current + direction * step + items.length) % items.length;
    const item = items[index];
    if (item && !item.disabled && item.onSelect) return index;
  }

  return -1;
}

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// Opened via a keyboard shortcut many times a day — entrance must read as
// instant. Tight spring, even faster exit.
const PANEL_SPRING = {
  type: "spring",
  stiffness: 560,
  damping: 40,
  mass: 0.5,
} as const;

export function CommandPalette({
  items,
  shortcut = "k",
  placeholder = "Type a command or search…",
  emptyMessage = "No results found.",
  open: controlledOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (!controlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange],
  );

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  // The portal target only exists client-side; render nothing during SSR.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot,
  );
  const uid = useId();
  const reduce = useReducedMotion();
  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setActive(0);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === shortcut.toLowerCase()
      ) {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shortcut, setOpen]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      updateQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && wasOpenRef.current) {
      requestAnimationFrame(() => {
        const focusedElement = document.activeElement;
        if (
          focusedElement === document.body ||
          (focusedElement instanceof Node &&
            paletteRef.current?.contains(focusedElement))
        ) {
          previousFocusRef.current?.focus();
        }
      });
    }

    wasOpenRef.current = open;
  }, [open, updateQuery]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  const availableItems = useMemo(
    () => (typeof items === "function" ? items(query) : items),
    [items, query],
  );

  const filtered = useMemo(() => {
    if (!query) return availableItems;
    return availableItems.filter((it) => {
      const haystacks = [
        it.label,
        it.description ?? "",
        it.group ?? "",
        ...(it.keywords ?? []),
      ];
      return haystacks.some((h) => fuzzyMatch(query, h));
    });
  }, [availableItems, query]);

  const activeItem = filtered[active];
  const activeIndex =
    activeItem && !activeItem.disabled && activeItem.onSelect
      ? active
      : firstEnabledIndex(filtered);

  // Reserve the icon column only when at least one item brings an icon, so
  // icon-less lists don't render a dead gap before every label.
  const hasIcons = useMemo(
    () => availableItems.some((it) => it.icon),
    [availableItems],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((it) => {
      const g = it.group ?? "Results";
      const groupItems = map.get(g) ?? [];
      groupItems.push(it);
      map.set(g, groupItems);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(nextEnabledIndex(filtered, activeIndex, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(nextEnabledIndex(filtered, activeIndex, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[activeIndex];
      if (it && !it.disabled && it.onSelect) {
        it.onSelect();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  let cursor = 0;

  if (!mounted) return null;

  // Always-mounted container; pointer events fully disabled when closed so clicks
  // pass through to the page. Portaled to <body> so ancestors with transforms,
  // filters, or fixed positioning can't trap the overlay in their stacking context.
  return createPortal(
    <div
      ref={paletteRef}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-0 z-[100]",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: open ? 0.18 : 0.12, ease: EASE_OUT }}
        onPointerDown={() => setOpen(false)}
        className={cn(
          "absolute inset-0 bg-background/5 [backdrop-filter:blur(12px)_saturate(140%)] [-webkit-backdrop-filter:blur(12px)_saturate(140%)]",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center p-4 pt-[18vh]">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={false}
          animate={{
            opacity: open ? 1 : 0,
            y: open || reduce ? 0 : -8,
            scale: open || reduce ? 1 : 0.97,
          }}
          transition={
            reduce
              ? { duration: 0.1 }
              : open
                ? PANEL_SPRING
                : { duration: 0.12, ease: EASE_OUT }
          }
          onKeyDown={onKeyDown}
          className={cn(
            "w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl will-change-transform",
            open ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder={placeholder}
              tabIndex={open ? 0 : -1}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${uid}-list`}
              aria-activedescendant={
                activeIndex >= 0 ? `${uid}-opt-${activeIndex}` : undefined
              }
              aria-autocomplete="list"
              className="h-12 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>
          <div
            ref={listRef}
            id={`${uid}-list`}
            role="listbox"
            aria-label="Commands"
            className="max-h-[60vh] overflow-y-auto overscroll-contain p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              grouped.map(([group, list], groupIndex) => (
                <div
                  key={group}
                  role="group"
                  aria-labelledby={`${uid}-group-${groupIndex}`}
                  className="mb-1 last:mb-0"
                >
                  <div
                    id={`${uid}-group-${groupIndex}`}
                    className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {group}
                  </div>
                  {list.map((it) => {
                    const idx = cursor++;
                    const isActive = idx === activeIndex;
                    const Icon = it.icon;
                    return (
                      <div
                        key={it.id}
                        id={`${uid}-opt-${idx}`}
                        role="option"
                        aria-selected={isActive}
                        aria-disabled={it.disabled || !it.onSelect || undefined}
                        data-index={idx}
                        onMouseEnter={() => {
                          if (!it.disabled && it.onSelect) setActive(idx);
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (it.disabled || !it.onSelect) return;
                          it.onSelect();
                          setOpen(false);
                        }}
                        className={cn(
                          "relative isolate flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "cursor-pointer text-foreground"
                            : it.disabled || !it.onSelect
                              ? "cursor-not-allowed text-muted-foreground/60"
                              : "cursor-pointer text-muted-foreground",
                        )}
                      >
                        {isActive ? (
                          <motion.span
                            layoutId={`${uid}-active`}
                            className="absolute inset-0 z-0 rounded-md bg-primary/[0.05]"
                            transition={
                              reduce
                                ? { duration: 0 }
                                : // Tracks rapid arrow-key navigation — keep it tighter
                                  // than SPRING_LAYOUT so it never lags the active row.
                                  {
                                    type: "spring",
                                    stiffness: 480,
                                    damping: 38,
                                  }
                            }
                          />
                        ) : null}
                        {Icon ? (
                          <Icon
                            aria-hidden="true"
                            className="relative z-10 h-4 w-4 shrink-0"
                          />
                        ) : hasIcons ? (
                          <span className="relative z-10 h-4 w-4" />
                        ) : null}
                        <span className="relative z-10 min-w-0 flex-1">
                          <span className="block truncate">{it.label}</span>
                          {it.description ? (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {it.description}
                            </span>
                          ) : null}
                        </span>
                        {it.badge ? (
                          <span className="relative z-10 shrink-0">
                            {it.badge}
                          </span>
                        ) : null}
                        {it.hint ? (
                          <kbd className="relative z-10 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {it.hint}
                          </kbd>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}
