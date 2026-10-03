"use client";

import { useState } from "react";

const TRIM_LENGTH = 100;

/** A chat reply, trimmed to one short line with a "Show more" toggle when it runs long. */
export function ExpandableMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TRIM_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, TRIM_LENGTH).trimEnd()}…`;

  return (
    <>
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
