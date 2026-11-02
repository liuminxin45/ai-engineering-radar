"use client";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Search, X, LoaderCircle } from "./search-icons";
import type { SearchSession } from "../site-search";
import type { SearchResultState } from "./search-results";
import "./site-search.css";

// Keep the dialog and input available immediately; only the results engine is lazy.
const SearchResults = lazy(() => import("./search-results"));
const emptyState: SearchResultState = {
  ready: false,
  activeIndex: -1,
  count: 0,
  message: "",
};

class SearchErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="site-search-results">
        <div className="site-search-state" role="alert">
          <p>搜索暂时无法加载，请重试。</p>
          <button
            type="button"
            className="search-retry"
            onClick={() => {
              sessionStorage.setItem("radar-search-retry", "1");
              window.location.reload();
            }}
          >
            重试
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function SearchDialog({
  open,
  onClose,
  triggerRef,
  query,
  type,
  onQueryChange,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  query: string;
  type: "blog" | "paper";
  onQueryChange: (query: string) => void;
}) {
  const [selection, setSelection] = useState(emptyState);
  const session = useRef<SearchSession | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const backdropDown = useRef(false);
  const restoreFocus = useRef(false);
  const onState = useCallback(
    (state: SearchResultState) => setSelection(state),
    [],
  );
  useLayoutEffect(() => {
    if (!open) {
      dialog.current?.close();
      if (restoreFocus.current) {
        triggerRef.current?.focus();
        restoreFocus.current = false;
      }
      return;
    }
    const element = dialog.current;
    element?.showModal();
    input.current?.focus();
    restoreFocus.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, triggerRef]);
  const outside = (event: React.PointerEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  };
  return (
    <dialog
      ref={dialog}
      className="site-search-dialog"
      aria-labelledby="search-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "input:not([disabled]), button:not([disabled]), a[href]",
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropDown.current =
          event.target === event.currentTarget && outside(event);
      }}
      onPointerUp={(event) => {
        if (backdropDown.current && outside(event)) onClose();
        backdropDown.current = false;
      }}
    >
      <h2 className="sr-only" id="search-title">
        搜索{type === "paper" ? "论文" : "文章"}
      </h2>
      <div className="site-search-input">
        <Search size={20} strokeWidth={1.6} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            type === "paper" ? "搜索论文、关键词…" : "搜索文章、关键词…"
          }
          aria-label={`搜索所有面板的${type === "paper" ? "论文" : "文章"}`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={selection.count > 0}
          aria-controls={selection.ready ? "site-search-results" : undefined}
          aria-activedescendant={
            selection.activeIndex >= 0
              ? `search-result-${selection.activeIndex}`
              : undefined
          }
          onChange={(event) => {
            onQueryChange(event.target.value);
            session.current?.setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              session.current?.selectNext(event.key === "ArrowDown" ? 1 : -1);
            }
            if (event.key === "Enter" && selection.activeIndex >= 0) {
              event.preventDefault();
              dialog.current
                ?.querySelector<HTMLAnchorElement>(
                  `#search-result-${selection.activeIndex} a`,
                )
                ?.click();
            }
          }}
        />
        <button type="button" aria-label="关闭搜索" onClick={onClose}>
          <X size={20} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <SearchErrorBoundary>
          <Suspense
            fallback={
              <div className="site-search-results" aria-busy="true">
                <div className="site-search-state" role="status">
                  <LoaderCircle
                    size={22}
                    className="search-spinner"
                    aria-hidden="true"
                  />
                  <p>正在加载搜索…</p>
                </div>
              </div>
            }
          >
            <SearchResults
              key={type}
              type={type}
              query={query}
              onClose={onClose}
              controlsRef={session}
              onState={onState}
            />
          </Suspense>
        </SearchErrorBoundary>
      )}
      <footer className="site-search-footer">
        <span>
          <kbd>Esc</kbd> 关闭
        </span>
        <span role="status">{selection.message}</span>
      </footer>
    </dialog>
  );
}
