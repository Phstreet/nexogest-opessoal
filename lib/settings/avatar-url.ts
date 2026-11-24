const AVATAR_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i;

export function getNexoAvatarUrl(path: string | undefined): string {
  if (!path || !AVATAR_PATH_PATTERN.test(path)) return "";
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return "";
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return base + "/storage/v1/object/public/nexo-avatars/" + safePath;
}
