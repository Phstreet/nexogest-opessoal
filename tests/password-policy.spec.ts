import { test, expect } from "@playwright/test";
import {
  checkPwnedPassword,
  parsePwnedRangeResponse,
  sha1Password,
} from "../lib/auth/password-policy";

test.describe("Política de senhas vazadas do NEXO", () => {
  test("gera SHA-1 hexadecimal em maiúsculas", () => {
    expect(sha1Password("password")).toBe(
      "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8"
    );
  });

  test("interpreta ocorrência na resposta da API por sufixo", () => {
    const suffix = "B7EE68FD8".padStart(35, "A");
    expect(parsePwnedRangeResponse(`${suffix}:42\nOTHER:2`, suffix)).toBe(42);
    expect(parsePwnedRangeResponse("INVALID", suffix)).toBe(0);
  });

  test("consulta apenas o prefixo de cinco caracteres do hash", async () => {
    let requestedUrl = "";
    const fakeFetch: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response("", { status: 200 });
    };
    const result = await checkPwnedPassword("UmaSenhaSegura!2026", fakeFetch);
    expect(requestedUrl).toMatch(/\/range\/[A-F0-9]{5}$/);
    expect(requestedUrl).not.toContain("UmaSenhaSegura");
    expect(result.status).toBe("safe");
  });

  test("adota fail-open em falha de rede", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("network down");
    };
    const result = await checkPwnedPassword("UmaSenhaSegura!2026", fakeFetch);
    expect(result).toEqual({ status: "unavailable" });
  });

  test("detecta uma senha presente na resposta da API", async () => {
    const hash = sha1Password("password");
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const fakeFetch: typeof fetch = async (input) => {
      expect(String(input)).toContain(prefix);
      return new Response(`${suffix}:123\n`, { status: 200 });
    };
    const result = await checkPwnedPassword("password", fakeFetch);
    expect(result).toEqual({ status: "pwned", occurrences: 123 });
  });
});
