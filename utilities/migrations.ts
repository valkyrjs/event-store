import fs from "node:fs/promises";
import { join } from "node:path";

import { ensureDir, hasFolder } from "~utilities/fs.ts";
import { getModuleMeta } from "~utilities/jsr.ts";

/**
 * Prepares the migration files for execution by placing them in the
 * given output target.
 *
 * @param meta   - Import meta to extract directory name from.
 * @param output - Location to place the migration files.
 */
export async function prepareMigrationFiles(meta: ImportMeta, output: string) {
  if (await hasFolder(output)) {
    await fs.rm(output, { recursive: true });
  }
  await ensureDir(output);
  if (meta.dirname !== undefined) {
    return copyLocalMigrationFiles(join(meta.dirname, "migrations"), output);
  }
  if (meta.url !== undefined && isRemoteUrl(meta.url)) {
    return copyRemoteMigrationFiles(meta.url, output);
  }
}

/*
 |--------------------------------------------------------------------------------
 | Helpers
 |--------------------------------------------------------------------------------
 */

function isRemoteUrl(url: string) {
  return url.includes("https://jsr.io/@valkyr/event-store");
}

async function copyLocalMigrationFiles(source: string, destination: string): Promise<void> {
  await fs.cp(source, destination, { recursive: true });
}

async function copyRemoteMigrationFiles(url: string, destination: string): Promise<void> {
  const [version, , target] = url.replace("https://jsr.io/@valkyr/event-store/", "").split("/");
  const { manifest } = await getModuleMeta(version);
  for (const key in manifest) {
    if (key.includes(`stores/${target}/migrations`) === true && key.endsWith(".ts") === false) {
      const dest = join(destination, key.replace(`/stores/${target}/migrations`, ""));
      const file = await getRemoteFile(`https://jsr.io/@valkyr/event-store/${version}${key}`);
      await ensureDir(dest);
      await fs.writeFile(dest, file, "utf-8");
    }
  }
}

async function getRemoteFile(url: string): Promise<any> {
  const res = await fetch(url);
  if (res.status !== 200) {
    throw new Error("Failed to fetch migration file");
  }
  return res.text();
}
