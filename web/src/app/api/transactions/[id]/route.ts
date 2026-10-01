import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { currentUserId } from "@/lib/current-user";
import { softDeleteTransaction, TransactionIdSchema } from "@/lib/transactions";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const id = TransactionIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const ok = await softDeleteTransaction(getDb(), await currentUserId(), id.data);
  return new Response(null, { status: ok ? 204 : 404 });
}
