"use client";
// beui.dev/components/blocks/swipeable-list

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type SwipeSide = "left" | "right";

export type SwipeableListValue = {
  id: string;
  side: SwipeSide;
};

export type SwipeActionTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export type SwipeAction = {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  tone?: SwipeActionTone;
  disabled?: boolean;
  onClick?: (item: SwipeableListItem) => void;
};

export type SwipeableListItem = {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  content?: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  disabled?: boolean;
};

export type SwipeableListClassNames = {
  root?: string;
  item?: string;
  rail?: string;
  action?: string;
  surface?: string;
  leading?: string;
  content?: string;
  title?: string;
  description?: string;
  meta?: string;
};

export interface SwipeableListProps {
  items: SwipeableListItem[];
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
  onAction?: (payload: {
    item: SwipeableListItem;
    action: SwipeAction;
    side: SwipeSide;
  }) => void;
  actionWidth?: number;
  revealThreshold?: number;
  closeOnAction?: boolean;
  className?: string;
  classNames?: SwipeableListClassNames;
  renderItem?: (item: SwipeableListItem) => ReactNode;
}

// Distance-based release spring keeps short rebounds and full reveals feeling
// equally direct, closer to native mobile list interactions.
const ROW_SETTLE = {
  type: "spring",
  stiffness: 560,
  damping: 48,
  mass: 0.82,
  restDelta: 0.5,
  restSpeed: 8,
} as const;
const OPEN_DISTANCE_RATIO = 0.46;
const CLOSE_DISTANCE_RATIO = 0.72;
const OPEN_VELOCITY = 720;
const CLOSE_VELOCITY = 320;
const FLING_DISTANCE = 14;
const RELEASE_VELOCITY_LIMIT = 1500;

const ACTION_TONE_CLASS: Record<SwipeActionTone, string> = {
  neutral: "text-muted-foreground group-hover:text-foreground",
  primary: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

function useControllableSwipeValue({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const isControlled = value !== undefined;
  const currentValue = value ?? internalValue;

  const setValue = useCallback(
    (next: SwipeableListValue | null) => {
      if (!isControlled) {
        setInternalValue(next);
      }

      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return [currentValue, setValue] as const;
}

function isActionableSide(value: number, sideWidth: number) {
  return sideWidth > 0 && Math.abs(value) > 0;
}

function clampReleaseVelocity(velocity: number) {
  return Math.max(
    -RELEASE_VELOCITY_LIMIT,
    Math.min(RELEASE_VELOCITY_LIMIT, velocity),
  );
}

function SwipeActionButton({
  action,
  actionWidth,
  side,
  focusable,
  onAction,
  className,
}: {
  action: SwipeAction;
  actionWidth: number;
  side: SwipeSide;
  focusable: boolean;
  onAction: (action: SwipeAction, side: SwipeSide) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-swipe-action={side}
      disabled={action.disabled}
      tabIndex={focusable ? 0 : -1}
      aria-label={typeof action.label === "string" ? action.label : undefined}
      onClick={() => onAction(action, side)}
      className={cn(
        "group flex h-full shrink-0 items-center justify-center outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      style={{ width: actionWidth }}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full transition-[background-color,color,transform] duration-150 group-hover:bg-background group-active:scale-95",
          ACTION_TONE_CLASS[action.tone ?? "neutral"],
        )}
      >
        {action.icon}
      </span>
      <span className="sr-only">{action.label}</span>
    </button>
  );
}

function SwipeableListRow({
  item,
  actionWidth,
  revealThreshold,
  openValue,
  setOpenValue,
  closeOnAction,
  onAction,
  classNames,
  renderItem,
}: {
  item: SwipeableListItem;
  actionWidth: number;
  revealThreshold: number;
  openValue: SwipeableListValue | null;
  setOpenValue: (value: SwipeableListValue | null) => void;
  closeOnAction: boolean;
  onAction?: SwipeableListProps["onAction"];
  classNames?: SwipeableListClassNames;
  renderItem?: (item: SwipeableListItem) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const wheelSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const wheelVelocityRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const commandedTargetRef = useRef(0);
  const focusActionSideRef = useRef<SwipeSide | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const leftActions = item.leftActions ?? [];
  const rightActions = item.rightActions ?? [];
  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;
  const openSide = openValue?.id === item.id ? openValue.side : null;
  const targetX =
    openSide === "left" ? leftWidth : openSide === "right" ? -rightWidth : 0;

  const settleX = useCallback(
    (nextX: number, velocity = 0) => {
      commandedTargetRef.current = nextX;
      animationRef.current?.stop();

      if (reduce) {
        x.set(nextX);
        return;
      }

      animationRef.current = animate(x, nextX, {
        ...ROW_SETTLE,
        velocity: clampReleaseVelocity(velocity),
        onComplete: () => x.set(nextX),
      });
    },
    [reduce, x],
  );

  useEffect(() => {
    return () => {
      animationRef.current?.stop();
      if (wheelSettleTimerRef.current) {
        clearTimeout(wheelSettleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (commandedTargetRef.current === targetX) {
      return;
    }

    settleX(targetX);
  }, [settleX, targetX]);

  useEffect(() => {
    if (!openSide || focusActionSideRef.current !== openSide) return;

    rowRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-swipe-action="${openSide}"]:not(:disabled)`,
      )
      ?.focus();
    focusActionSideRef.current = null;
  }, [openSide]);

  const getTargetX = useCallback(
    (side: SwipeSide | null) =>
      side === "left" ? leftWidth : side === "right" ? -rightWidth : 0,
    [leftWidth, rightWidth],
  );

  const snapTo = useCallback(
    (side: SwipeSide | null, velocity = 0) => {
      setOpenValue(side ? { id: item.id, side } : null);
      settleX(getTargetX(side), velocity);
    },
    [getTargetX, item.id, setOpenValue, settleX],
  );

  const onDragStart = useCallback(() => {
    animationRef.current?.stop();

    if (openValue && openValue.id !== item.id) {
      setOpenValue(null);
    }
  }, [item.id, openValue, setOpenValue]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === "Escape" && openSide) {
        event.preventDefault();
        returnFocusRef.current?.focus();
        snapTo(null);
        return;
      }

      const side =
        event.key === "ArrowLeft" && rightWidth > 0
          ? "right"
          : event.key === "ArrowRight" && leftWidth > 0
            ? "left"
            : null;

      if (!side) return;

      event.preventDefault();
      returnFocusRef.current = event.target as HTMLElement;
      focusActionSideRef.current = side;
      snapTo(side);
    },
    [leftWidth, openSide, rightWidth, snapTo],
  );

  const settleReleasedPosition = useCallback(
    (velocity: number) => {
      const latest = x.get();
      const leftOpenThreshold = Math.max(
        revealThreshold,
        leftWidth * OPEN_DISTANCE_RATIO,
      );
      const rightOpenThreshold = Math.max(
        revealThreshold,
        rightWidth * OPEN_DISTANCE_RATIO,
      );

      if (openSide === "left") {
        if (
          latest < leftWidth * CLOSE_DISTANCE_RATIO ||
          velocity < -CLOSE_VELOCITY
        ) {
          snapTo(null, velocity);
          return;
        }

        snapTo("left", velocity);
        return;
      }

      if (openSide === "right") {
        if (
          Math.abs(latest) < rightWidth * CLOSE_DISTANCE_RATIO ||
          velocity > CLOSE_VELOCITY
        ) {
          snapTo(null, velocity);
          return;
        }

        snapTo("right", velocity);
        return;
      }

      if (
        isActionableSide(latest, leftWidth) &&
        (latest > leftOpenThreshold ||
          (velocity > OPEN_VELOCITY && latest > FLING_DISTANCE))
      ) {
        snapTo("left", velocity);
        return;
      }

      if (
        isActionableSide(latest, rightWidth) &&
        (latest < -rightOpenThreshold ||
          (velocity < -OPEN_VELOCITY && latest < -FLING_DISTANCE))
      ) {
        snapTo("right", velocity);
        return;
      }

      snapTo(null, velocity);
    },
    [
      leftWidth,
      openSide,
      revealThreshold,
      rightWidth,
      snapTo,
      x,
    ],
  );

  const onDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      settleReleasedPosition(info.velocity.x);
    },
    [settleReleasedPosition],
  );

  const onWheel = useCallback(
    (event: WheelEvent) => {
      if (
        item.disabled ||
        event.ctrlKey ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY) ||
        Math.abs(event.deltaX) < 1
      ) {
        return;
      }

      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? rowRef.current?.clientWidth ?? 1
            : 1;
      const deltaX = event.deltaX * unit;
      const currentX = x.get();
      const nextX = Math.max(
        -rightWidth,
        Math.min(leftWidth, currentX - deltaX),
      );

      if (nextX === currentX) return;

      event.preventDefault();
      animationRef.current?.stop();

      if (openValue && openValue.id !== item.id) {
        setOpenValue(null);
      }

      const now = performance.now();
      const elapsed = lastWheelTimeRef.current
        ? Math.max(now - lastWheelTimeRef.current, 8)
        : 16;
      wheelVelocityRef.current = ((nextX - currentX) / elapsed) * 1000;
      lastWheelTimeRef.current = now;
      x.set(nextX);

      if (wheelSettleTimerRef.current) {
        clearTimeout(wheelSettleTimerRef.current);
      }

      wheelSettleTimerRef.current = setTimeout(() => {
        wheelSettleTimerRef.current = null;
        lastWheelTimeRef.current = 0;
        settleReleasedPosition(wheelVelocityRef.current);
      }, 100);
    },
    [
      item.disabled,
      item.id,
      leftWidth,
      openValue,
      rightWidth,
      setOpenValue,
      settleReleasedPosition,
      x,
    ],
  );

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const handleAction = useCallback(
    (action: SwipeAction, side: SwipeSide) => {
      action.onClick?.(item);
      onAction?.({ item, action, side });

      if (closeOnAction) {
        snapTo(null);
      }
    },
    [closeOnAction, item, onAction, snapTo],
  );

  const defaultContent = (
    <div className="flex min-w-0 items-center gap-3">
      {item.leading ? (
        <div className={cn("shrink-0", classNames?.leading)}>
          {item.leading}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", classNames?.content)}>
        {item.title ? (
          <div
            className={cn(
              "truncate text-sm font-medium text-foreground",
              classNames?.title,
            )}
          >
            {item.title}
          </div>
        ) : null}
        {item.description ? (
          <div
            className={cn(
              "mt-0.5 truncate text-xs text-muted-foreground",
              classNames?.description,
            )}
          >
            {item.description}
          </div>
        ) : null}
      </div>
      {item.meta ? (
        <div
          className={cn(
            "shrink-0 text-xs font-medium text-muted-foreground",
            classNames?.meta,
          )}
        >
          {item.meta}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      ref={rowRef}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-muted",
        item.disabled && "opacity-60",
        classNames?.item,
      )}
    >
      <div
        aria-hidden={!openSide}
        inert={!openSide}
        className={cn(
          "absolute inset-0 z-0 flex overflow-hidden rounded-2xl",
          classNames?.rail,
        )}
      >
        <div className="flex h-full overflow-hidden rounded-l-2xl">
          {leftActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              className={classNames?.action}
              focusable={openSide === "left"}
              onAction={handleAction}
              side="left"
            />
          ))}
        </div>
        <div className="ml-auto flex h-full overflow-hidden rounded-r-2xl">
          {rightActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              className={classNames?.action}
              focusable={openSide === "right"}
              onAction={handleAction}
              side="right"
            />
          ))}
        </div>
      </div>

      <motion.div
        ref={surfaceRef}
        drag={item.disabled ? false : "x"}
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onKeyDown={onKeyDown}
        style={{ x }}
        className={cn(
          "relative z-10 min-h-[72px] cursor-grab touch-pan-y select-none rounded-2xl border border-border bg-card px-4 py-3 shadow-sm active:cursor-grabbing",
          classNames?.surface,
        )}
      >
        {renderItem ? renderItem(item) : item.content ?? defaultContent}
      </motion.div>
    </div>
  );
}

export function SwipeableList({
  items,
  value,
  defaultValue = null,
  onValueChange,
  onAction,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  className,
  classNames,
  renderItem,
}: SwipeableListProps) {
  const [openValue, setOpenValue] = useControllableSwipeValue({
    value,
    defaultValue,
    onValueChange,
  });

  return (
    <div className={cn("flex w-full flex-col gap-2", className, classNames?.root)}>
      {items.map((item) => (
        <SwipeableListRow
          key={item.id}
          item={item}
          actionWidth={actionWidth}
          revealThreshold={revealThreshold}
          openValue={openValue}
          setOpenValue={setOpenValue}
          closeOnAction={closeOnAction}
          onAction={onAction}
          classNames={classNames}
          renderItem={renderItem}
        />
      ))}
    </div>
  );
}
