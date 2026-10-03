import { getDb } from "@/db";
import { currentUserId } from "@/lib/current-user";
import { createManualTransaction, CreateTransactionSchema } from "@/lib/transactions";

export async function POST(request: Request) {
  const body = CreateTransactionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { title: "Invalid request", detail: "Send { type: \"expense\" | \"income\", categoryId: uuid, amount: positive number }." },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  const userId = await currentUserId();
  const result = await createManualTransaction(getDb(), userId, body.data);
  if (!result.ok) {
    return Response.json(
      { title: "Invalid category", detail: "That category doesn't exist." },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  return Response.json(result.transaction, { status: 201 });
}
