import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { currentUserId } from "@/lib/current-user";
import { restoreTransaction, TransactionIdSchema } from "@/lib/transactions";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/transactions/[id]/restore">) {
  const id = TransactionIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const ok = await restoreTransaction(getDb(), await currentUserId(), id.data);
  return new Response(null, { status: ok ? 204 : 404 });
}
