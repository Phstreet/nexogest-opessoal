import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const userProfileSchema = z.object({
  displayName: z.string().trim().max(60).default(""),
  fullName: optionalText(120),
  phone: optionalText(30),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  motto: optionalText(160),
  avatarUrl: z.string().max(240_000).regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/).optional().or(z.literal("")),
  sex: optionalText(30),
  monthlyIncome: optionalText(40),
  profession: optionalText(80),
}).passthrough();

export type UserProfile = z.infer<typeof userProfileSchema>;
