import { createHash } from "node:crypto";
import { z } from "zod";

const OBVIOUS_PASSWORDS = new Set([
  "1234567890",
  "123456789",
  "password123",
  "senha12345",
  "senha123",
  "qwerty12345",
  "qwerty123",
  "admin12345",
  "abc1234567",
  "iloveyou",
  "welcome123",
  "letmein123",
]);

export const NewPasswordSchema = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua ao menos um número.")
  .regex(/[^A-Za-z0-9]/, "Inclua ao menos um símbolo.")
  .refine(
    (value) => !OBVIOUS_PASSWORDS.has(value.toLowerCase()),
    "Essa senha é muito comum. Escolha uma senha mais exclusiva."
  )
  .refine(
    (value) => !/(.)\1{4,}/.test(value),
    "Evite repetir o mesmo caractere muitas vezes."
  );

export type PwnedCheckResult =
  | { status: "safe" }
  | { status: "pwned"; occurrences: number }
  | { status: "unavailable" };

export function sha1Password(password: string): string {
  return createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
}

export function parsePwnedRangeResponse(
  responseText: string,
  suffix: string
): number {
  const normalizedSuffix = suffix.trim().toUpperCase();
  if (!/^[A-F0-9]{35}$/.test(normalizedSuffix)) return 0;

  for (const line of responseText.split(/\r?\n/)) {
    const [candidate, count] = line.trim().split(":");
    if (!candidate || !count || !/^[A-F0-9]{35}$/i.test(candidate)) continue;
    if (candidate.toUpperCase() !== normalizedSuffix) continue;
    const occurrences = Number.parseInt(count, 10);
    return Number.isSafeInteger(occurrences) && occurrences > 0 ? occurrences : 0;
  }
  return 0;
}

/**
 * Consulta somente o prefixo de 5 caracteres do SHA-1 (k-anonimato).
 * Em indisponibilidade, retorna "unavailable": a política é fail-open.
 */
export async function checkPwnedPassword(
  password: string,
  fetcher: typeof fetch = fetch
): Promise<PwnedCheckResult> {
  const hash = sha1Password(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const response = await fetcher(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        method: "GET",
        headers: {
          "Add-Padding": "true",
          "User-Agent": "NEXO-Password-Security/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!response.ok) return { status: "unavailable" };

    const occurrences = parsePwnedRangeResponse(await response.text(), suffix);
    return occurrences > 0
      ? { status: "pwned", occurrences }
      : { status: "safe" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function validateNewPassword(password: unknown): Promise<string | null> {
  const parsed = NewPasswordSchema.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Senha inválida.";

  const breach = await checkPwnedPassword(parsed.data);
  if (breach.status === "pwned") {
    return "Essa senha já apareceu em vazamentos conhecidos. Escolha outra senha antes de continuar.";
  }
  if (breach.status === "unavailable") {
    // Fail-open deliberado: a indisponibilidade externa não impede o cadastro.
    console.warn("[NEXO][security] Pwned Passwords indisponível; validação local aplicada.");
  }
  return null;
}
