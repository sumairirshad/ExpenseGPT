import { getDb } from "@/db";
import { currentUserId } from "@/lib/current-user";
import { createCategory, listCategories, NewCategorySchema } from "@/lib/finance-categories";

export async function GET() {
  const userId = await currentUserId();
  return Response.json(await listCategories(getDb(), userId));
}

export async function POST(request: Request) {
  const body = NewCategorySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { title: "Invalid request", detail: "Send { label: string (1-60 chars) }." },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  const userId = await currentUserId();
  const result = await createCategory(getDb(), userId, body.data.label);
  if (!result.ok) {
    const detail = result.error === "duplicate" ? "A category with that name already exists." : "That category name isn't valid.";
    return Response.json(
      { title: "Invalid category", detail },
      { status: result.error === "duplicate" ? 409 : 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  return Response.json(result.category, { status: 201 });
}
