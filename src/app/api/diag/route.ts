import { DatabaseSync } from "node:sqlite";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "(não definida)";
  const dbPath = url.startsWith("file:") ? url.slice(5) : url;

  const result: Record<string, unknown> = { url, dbPath };

  try {
    const db = new DatabaseSync(dbPath);
    const users = db
      .prepare('SELECT id, email, role, length(password) as passLen FROM "User"')
      .all();
    db.close();
    result.users = users;
    result.ok = true;
  } catch (err) {
    result.ok = false;
    result.error = String(err);
  }

  return Response.json(result);
}
