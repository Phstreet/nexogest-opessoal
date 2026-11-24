import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import {
  copyResponseCookies,
  fetchSupabaseUser,
  getSupabaseConfig,
  getValidAccessToken,
  hasValidOrigin,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function jsonWithCookies(source: NextResponse, body: Record<string, unknown>, status = 200) {
  return copyResponseCookies(source, NextResponse.json(body, { status, headers: source.headers }));
}

function isWebp(buffer: Buffer) {
  return buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
}

async function authenticate(request: NextRequest) {
  const response = NextResponse.json({ ok: false });
  const access = await getValidAccessToken(request, response);
  if (!access) return { access: null, user: null, response };
  const user = await fetchSupabaseUser(access);
  if (!user || typeof user.id !== "string") return { access: null, user: null, response };
  return { access, user: user as { id: string }, response };
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  }

  const auth = await authenticate(request);
  if (!auth.access || !auth.user) {
    return jsonWithCookies(auth.response, { error: "Autenticação necessária." }, 401);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonWithCookies(auth.response, { error: "Selecione uma imagem para o avatar." }, 400);
    }
    if (file.type !== "image/webp") {
      return jsonWithCookies(auth.response, { error: "A imagem precisa ser convertida para WebP antes do envio." }, 415);
    }
    if (file.size < 1 || file.size > MAX_AVATAR_BYTES) {
      return jsonWithCookies(auth.response, { error: "O avatar deve ter no máximo 2 MB." }, 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!isWebp(bytes)) {
      return jsonWithCookies(auth.response, { error: "O conteúdo enviado não é uma imagem WebP válida." }, 415);
    }

    const { url, key } = getSupabaseConfig();
    const path = auth.user.id + "/" + crypto.randomUUID() + ".webp";
    const uploaded = await fetch(url + "/storage/v1/object/nexo-avatars/" + path, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + auth.access,
        "Content-Type": "image/webp",
        "x-upsert": "false",
      },
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      cache: "no-store",
    });

    if (!uploaded.ok) {
      return jsonWithCookies(auth.response, { error: "Não foi possível enviar o avatar para o armazenamento seguro." }, 502);
    }

    return jsonWithCookies(auth.response, {
      path,
      url: url + "/storage/v1/object/public/nexo-avatars/" + path,
    });
  } catch {
    return jsonWithCookies(auth.response, { error: "Falha ao processar o avatar. Tente novamente." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  }

  const auth = await authenticate(request);
  if (!auth.access || !auth.user) {
    return jsonWithCookies(auth.response, { error: "Autenticação necessária." }, 401);
  }

  try {
    const body = await request.json() as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    const prefix = auth.user.id + "/";
    if (!path.startsWith(prefix) || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(path)) {
      return jsonWithCookies(auth.response, { error: "Caminho de avatar inválido." }, 400);
    }

    const { url, key } = getSupabaseConfig();
    const removed = await fetch(url + "/storage/v1/object/nexo-avatars", {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: "Bearer " + auth.access,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
      cache: "no-store",
    });
    if (!removed.ok) {
      return jsonWithCookies(auth.response, { error: "Não foi possível remover o avatar antigo." }, 502);
    }
    return jsonWithCookies(auth.response, { ok: true });
  } catch {
    return jsonWithCookies(auth.response, { error: "Falha ao remover o avatar." }, 500);
  }
}
