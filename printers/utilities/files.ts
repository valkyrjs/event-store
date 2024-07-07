import { mkdir, readdir } from "node:fs/promises";

export async function ensureOutputDirectory(output: string): Promise<void> {
  const target = output.split("/").slice(0, -1).join("/");
  const dir = await readdir(target).catch(() => undefined);
  if (dir === undefined) {
    await mkdir(target, { recursive: true });
  }
}
