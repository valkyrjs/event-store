/**
 * Get the event-store meta data for the given version.
 *
 * @param version - Version to get meta from.
 */
export async function getModuleMeta(version: string) {
  const res = await fetch(`https://jsr.io/@valkyr/event-store/${version}_meta.json`);
  if (res.status !== 200) {
    throw new Error("Failed to retrieve @valkyr/event-store meta from jsr.io");
  }
  return res.json();
}
