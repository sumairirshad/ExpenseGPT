"use client";

import type { Ref } from "react";

interface Props {
  ref: Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
}

export function ChatInput({ ref, value, onChange, onSend }: Props) {
  const submit = () => {
    const text = value.trim();
    if (text) onSend(text);
  };

  return (
    <form
      className="flex items-end gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-zinc-200 focus-within:ring-2 focus-within:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-800 dark:focus-within:ring-zinc-600"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={ref}
        autoFocus
        rows={1}
        maxLength={500}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="I spent 850 on dinner…"
        aria-label="Message"
        className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-zinc-400"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Send"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
          <path d="M3.1 2.3a.75.75 0 0 1 .82-.05l13.5 7a.75.75 0 0 1 0 1.33l-13.5 7A.75.75 0 0 1 2.85 16.8L4.6 10 2.85 3.2a.75.75 0 0 1 .25-.9ZM6.03 10.75l-1.2 4.6L14.6 10 4.83 4.65l1.2 4.6h4.72a.75.75 0 0 1 0 1.5H6.03Z" />
        </svg>
      </button>
    </form>
  );
}
