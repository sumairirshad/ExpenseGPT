import { getDb } from "@/db";
import { currentUserId } from "@/lib/current-user";
import { getDashboard } from "@/lib/dashboard";

export async function GET() {
  const userId = await currentUserId();
  return Response.json(await getDashboard(getDb(), userId));
}
