import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const userProfileSchema = z.object({
  displayName: z.string().trim().min(2, "O nome de exibição deve ter pelo menos 2 caracteres.").max(60, "O nome de exibição deve ter no máximo 60 caracteres.").refine((value) => !/[<>]/.test(value), "O nome de exibição não pode conter HTML.").default(""),
  fullName: optionalText(120),
  phone: optionalText(30),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  motto: optionalText(160),
  avatarUrl: z.string().max(240_000).regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/).optional().or(z.literal("")),
  avatarPath: z.string().max(80).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i).optional().or(z.literal("")),
  sex: optionalText(30),
  monthlyIncome: optionalText(40),
  profession: optionalText(80),
}).passthrough();

export type UserProfile = z.infer<typeof userProfileSchema>;
