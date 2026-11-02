"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "./search-icons";
import SearchDialog from "./search-dialog";

export default function SearchLauncher({ type }: { type: "blog" | "paper" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const show = useCallback(() => {
    if (open) return;
    setSession((value) => value + 1);
    setOpen(true);
  }, [open]);
  useEffect(() => {
    if (sessionStorage.getItem("radar-search-retry") !== "1") return;
    sessionStorage.removeItem("radar-search-retry");
    const timer = setTimeout(show, 0);
    return () => clearTimeout(timer);
  }, [show]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.isComposing
      ) {
        if (!open && document.querySelector("dialog[open]")) return;
        event.preventDefault();
        show();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [open, show]);
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="icon-action"
        aria-label={type === "paper" ? "搜索论文" : "搜索文章"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <Search size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <SearchDialog
        key={session}
        open={open}
        onClose={close}
        triggerRef={trigger}
        query={query}
        type={type}
        onQueryChange={setQuery}
      />
    </>
  );
}
