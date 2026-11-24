import { getAuth } from "@/lib/server/auth";

async function handle(request: Request) {
  return (await getAuth()).handler(request);
}

export { handle as GET, handle as POST };
