"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Heading = { id: string; level: number; text: string };
type Image = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  trigger: HTMLImageElement;
};

function Lightbox({ image, onClose }: { image: Image; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
      image.trigger.focus({ preventScroll: true });
    };
  }, [image]);
  return (
    <dialog
      ref={dialog}
      className="image-lightbox"
      aria-label={image.alt || "图片预览"}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          event.currentTarget
            .querySelector<HTMLButtonElement>("button")
            ?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="image-lightbox-close"
        type="button"
        aria-label="关闭图片预览"
        onClick={onClose}
        autoFocus
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
      {status !== "ready" && (
        <p
          className="image-lightbox-status"
          role={status === "error" ? "alert" : "status"}
        >
          {status === "error"
            ? "图片暂时无法加载，可在原文中查看。"
            : "正在加载大图…"}
        </p>
      )}
    </dialog>
  );
}

export function ArticleReading({
  headings,
  children,
}: {
  headings: Heading[];
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [portal, setPortal] = useState<Element | null>(null);
  const [active, setActive] = useState(headings[0]?.id || "");
  const [image, setImage] = useState<Image | null>(null);
  useEffect(() => {
    setPortal(document.querySelector(".radar-ui") || document.body);
    let frame: number | undefined;
    const update = () => {
      const distance = document.documentElement.scrollHeight - innerHeight;
      const progress =
        distance > 0 ? Math.max(0, Math.min(1, scrollY / distance)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      const elements = headings
        .map((heading) => document.getElementById(heading.id))
        .filter((node): node is HTMLElement => Boolean(node));
      if (!elements.length) return;
      const readingLine = Math.min(112, innerHeight * 0.25);
      let current = elements[0].id;
      for (const element of elements) {
        if (element.getBoundingClientRect().top > readingLine + 1) break;
        current = element.id;
      }
      if (
        scrollY > 0 &&
        scrollY + innerHeight >= document.documentElement.scrollHeight - 64
      )
        current = elements.at(-1)!.id;
      setActive(current);
    };
    const schedule = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    for (const event of ["scroll", "resize", "hashchange", "popstate"])
      window.addEventListener(event, schedule, { passive: true });
    if (location.hash) {
      try {
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView({ block: "start" });
      } catch {
        /* Malformed fragments are ignored. */
      }
    }
    schedule();
    return () => {
      observer.disconnect();
      for (const event of ["scroll", "resize", "hashchange", "popstate"])
        window.removeEventListener(event, schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [headings]);
  const links = headings.map((heading) => (
    <a
      key={heading.id}
      href={`#${heading.id}`}
      className={heading.level === 3 ? "is-subheading" : ""}
      aria-current={active === heading.id ? "location" : undefined}
    >
      {heading.text}
    </a>
  ));
  function open(target: EventTarget | null) {
    if (
      !(target instanceof HTMLImageElement) ||
      !root.current?.contains(target)
    )
      return false;
    setImage({
      src: target.currentSrc || target.src,
      alt: target.alt,
      width: target.naturalWidth || undefined,
      height: target.naturalHeight || undefined,
      trigger: target,
    });
    return true;
  }
  return (
    <>
      {portal &&
        createPortal(
          <div className="reading-progress" aria-hidden="true">
            <span ref={bar} />
          </div>,
          portal,
        )}
      <div className="record-reading-layout">
        <div
          className="record-reading-main"
          ref={root}
          onClick={(event) => {
            if (open(event.target)) event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (
              (event.key === "Enter" || event.key === " ") &&
              open(event.target)
            )
              event.preventDefault();
          }}
        >
          {headings.length > 0 && (
            <details className="article-toc-mobile">
              <summary>文章目录</summary>
              <nav aria-label="文章目录">{links}</nav>
            </details>
          )}
          {children}
        </div>
        {headings.length > 0 && (
          <aside className="article-toc">
            <nav aria-label="文章目录">{links}</nav>
          </aside>
        )}
      </div>
      {image && (
        <Lightbox
          key={image.src}
          image={image}
          onClose={() => setImage(null)}
        />
      )}
    </>
  );
}
