import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/**
 * Get the name of the directory based on the import meta provided.
 *
 * @param meta - Import meta to extract directory name from.
 */
export function getDirname(meta: ImportMeta) {
  return dirname(fileURLToPath(meta.url));
}
