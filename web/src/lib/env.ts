/** Read env vars from process.env or Cloudflare Worker bindings */
export async function getEnvVar(name: string): Promise<string | undefined> {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const value = (env as unknown as Record<string, string | undefined>)[name];
    if (value) return value;
  } catch {
    // Local `next dev` without Cloudflare bindings
  }

  return undefined;
}
