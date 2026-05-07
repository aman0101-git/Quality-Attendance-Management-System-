import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Optional clear handler — when present, an X button shows when there is a value */
  onClear?: () => void;
  size?: "sm" | "md";
  containerClassName?: string;
}

/**
 * Compact search input with leading icon and optional clear button.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      containerClassName,
      onClear,
      size = "md",
      value,
      placeholder = "Search…",
      ...props
    },
    ref
  ) => {
    const id = useId();
    const showClear = Boolean(value && onClear);

    return (
      <div
        className={cn(
          "relative flex items-center",
          containerClassName
        )}
      >
        <Search
          className={cn(
            "pointer-events-none absolute left-3 text-fg-subtle",
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
        />

        <input
          ref={ref}
          id={id}
          value={value}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-border bg-bg-elevated text-fg",
            "placeholder:text-fg-subtle transition-colors",
            "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
            size === "sm" ? "h-8 pl-8 pr-8 text-xs" : "h-9 pl-9 pr-9 text-sm",
            className
          )}
          {...props}
        />

        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className={cn(
              "absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded",
              "text-fg-subtle hover:bg-bg-muted hover:text-fg"
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export default SearchInput;
