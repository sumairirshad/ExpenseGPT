import { z } from "zod";
import { getDb } from "@/db";
import { createDrizzleStore } from "@/lib/chat/drizzle-store";
import { createChatService } from "@/lib/chat/service";
import { currentUserId } from "@/lib/current-user";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  requestId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { title: "Invalid request", detail: "Send { message: string (1-500 chars), requestId?: uuid }." },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  const userId = await currentUserId();
  const service = createChatService({ store: createDrizzleStore(getDb()) });
  const reply = await service.handle({ userId, message: body.data.message, requestId: body.data.requestId });
  return Response.json(reply);
}
