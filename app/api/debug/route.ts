import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const cwd = process.cwd();
  const dbDeploy = path.join(cwd, "database", "sluizen_deploy.db");
  const dbFull = path.join(cwd, "database", "sluizen.db");
  const dbDir = path.join(cwd, "database");

  let dirContents: string[] = [];
  try { dirContents = fs.readdirSync(dbDir); } catch { dirContents = ["ERROR reading dir"]; }

  let sqliteTest = "not tested";
  try {
    // Dynamic import to avoid build issues
    const Database = (await import("better-sqlite3")).default;
    if (fs.existsSync(dbDeploy)) {
      const db = new Database(dbDeploy, { readonly: true });
      const count = db.prepare("SELECT COUNT(*) as c FROM sluizen").get() as { c: number };
      db.close();
      sqliteTest = `OK - ${count.c} records`;
    } else {
      sqliteTest = "deploy DB not found";
    }
  } catch (e) {
    sqliteTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return Response.json({
    cwd,
    dbDeployExists: fs.existsSync(dbDeploy),
    dbFullExists: fs.existsSync(dbFull),
    dbDirExists: fs.existsSync(dbDir),
    dirContents,
    sqliteTest,
  });
}
