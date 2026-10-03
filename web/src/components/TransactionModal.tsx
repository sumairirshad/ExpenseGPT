"use client";

import { useEffect, useState } from "react";
import type { TransactionType } from "@/lib/categories";
import type { CategoryView } from "@/lib/finance-categories";

interface Props {
  type: TransactionType;
  label: string;
  onClose: () => void;
  onSaved: () => void;
}

const fieldClass =
  "rounded-xl bg-zinc-100 px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-zinc-400 dark:bg-zinc-800 dark:focus:ring-zinc-600";

/** Shared popup for recording a Debit (expense) or Credit (income) transaction. */
export function TransactionModal({ type, label, onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<CategoryView[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/categories", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: CategoryView[] = await res.json();
        if (cancelled) return;
        setCategories(data);
        setCategoryId((id) => id || data[0]?.id || "");
      } catch {
        if (!cancelled) setError("Couldn't load categories. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Category name cannot be empty.");
      return;
    }
    setCreatingCategory(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: name }),
      });
      if (res.status === 409) {
        setError("That category already exists.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const created: CategoryView = await res.json();
      setCategories((list) => [...(list ?? []), created]);
      setCategoryId(created.id);
      setNewCategoryName("");
      setAddingCategory(false);
    } catch {
      setError("Couldn't create that category. Please try again.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function submit() {
    setError(null);
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }
    const amountValue = Number(amount);
    if (!amount.trim() || !Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, categoryId, amount: amountValue }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onSaved();
      onClose();
    } catch {
      setError("Couldn't save the transaction. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} transaction`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label} transaction</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-lg leading-none text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
              <option value="" disabled>
                {categories ? "Select a category" : "Loading…"}
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {addingCategory ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addCategory();
                  }
                }}
                placeholder="New category name"
                maxLength={60}
                className={`flex-1 ${fieldClass}`}
              />
              <button
                type="button"
                onClick={() => void addCategory()}
                disabled={creatingCategory}
                className="shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName("");
                }}
                className="shrink-0 rounded-xl px-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="self-start text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
            >
              + New Category
            </button>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Amount</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </label>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !categories}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {submitting ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
