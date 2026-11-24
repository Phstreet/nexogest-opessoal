import { z } from "zod";

export const SETTINGS_SCHEMA_VERSION = 2;

const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const userSettingsSchema = z.object({
  schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
  general: z.object({
    language: z.enum(["pt-BR"]),
    timeZone: z.enum(["America/Sao_Paulo", "UTC"]),
    dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd"]),
    timeFormat: z.enum(["24h", "12h"]),
    weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]),
    currency: z.enum(["BRL"]),
    homePage: z.enum(["/", "/financeiro", "/rotina/agenda", "/rotina/habitos", "/metas"]),
  }),
  navigation: z.object({
    sidebarCompact: z.boolean(),
  }),
  routine: z.object({
    defaultEventDuration: z.number().int().min(5).max(480),
    defaultReminderMinutes: z.number().int().min(0).max(10080),
    dayStart: clockSchema,
    dayEnd: clockSchema,
    showWeekends: z.boolean(),
    habitReminderTime: clockSchema,
    streakRule: z.enum(["consecutive", "scheduled-days"]),
  }),
  finance: z.object({
    monthStartDay: z.number().int().min(1).max(28),
    dueAlertDays: z.number().int().min(0).max(30),
    hideValues: z.boolean(),
    defaultMonth: z.enum(["current", "previous"]),
  }),
  appearance: z.object({
    theme: z.enum(["graphite", "light", "system", "midnight", "warm"]),
    cornerRadius: z.enum(["sharp", "medium", "rounded"]),
    accent: z.enum(["silver", "blue", "violet", "emerald", "amber", "rose"]),
    density: z.enum(["comfortable", "compact"]),
    fontScale: z.enum(["small", "normal", "large"]),
    reduceMotion: z.boolean(),
    highContrast: z.boolean(),
  }),
  security: z.object({
    inactivityMinutes: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
  }),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
export type SettingsSection = Exclude<keyof UserSettings, "schemaVersion">;
export type SettingsPatch = {
  [K in SettingsSection]?: Partial<UserSettings[K]>;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  general: {
    language: "pt-BR",
    timeZone: "America/Sao_Paulo",
    dateFormat: "dd/MM/yyyy",
    timeFormat: "24h",
    weekStartsOn: 1,
    currency: "BRL",
    homePage: "/",
  },
  navigation: { sidebarCompact: false },
  routine: {
    defaultEventDuration: 60,
    defaultReminderMinutes: 15,
    dayStart: "06:00",
    dayEnd: "22:00",
    showWeekends: true,
    habitReminderTime: "20:00",
    streakRule: "consecutive",
  },
  finance: {
    monthStartDay: 1,
    dueAlertDays: 5,
    hideValues: false,
    defaultMonth: "current",
  },
  appearance: {
    theme: "graphite",
    accent: "silver",
    cornerRadius: "medium",
    density: "comfortable",
    fontScale: "normal",
    reduceMotion: false,
    highContrast: false,
  },
  security: { inactivityMinutes: 0 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateUserSettings(input: unknown): UserSettings {
  if (!isRecord(input)) return DEFAULT_USER_SETTINGS;

  const candidate = isRecord(input.settingsV1)
    ? input.settingsV1
    : isRecord(input.settings)
      ? input.settings
      : input;

  const legacyWeekStart = input.weekStartsOn;
  const legacySidebar = input.sidebarCollapsed;

  const migrated: unknown = {
    ...DEFAULT_USER_SETTINGS,
    ...candidate,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    general: {
      ...DEFAULT_USER_SETTINGS.general,
      ...(isRecord(candidate.general) ? candidate.general : {}),
      weekStartsOn:
        isRecord(candidate.general) &&
        [0, 1, 6].includes(Number(candidate.general.weekStartsOn))
          ? Number(candidate.general.weekStartsOn)
          : legacyWeekStart === "sunday"
            ? 0
            : 1,
    },
    navigation: {
      ...DEFAULT_USER_SETTINGS.navigation,
      ...(isRecord(candidate.navigation) ? candidate.navigation : {}),
      sidebarCompact:
        isRecord(candidate.navigation) && typeof candidate.navigation.sidebarCompact === "boolean"
          ? candidate.navigation.sidebarCompact
          : legacySidebar === true,
    },
    routine: {
      ...DEFAULT_USER_SETTINGS.routine,
      ...(isRecord(candidate.routine) ? candidate.routine : {}),
    },
    finance: {
      ...DEFAULT_USER_SETTINGS.finance,
      ...(isRecord(candidate.finance) ? candidate.finance : {}),
    },
    appearance: {
      ...DEFAULT_USER_SETTINGS.appearance,
      ...(isRecord(candidate.appearance) ? candidate.appearance : {}),
      theme: isRecord(candidate.appearance) &&
        ["graphite", "light", "system", "midnight", "warm"].includes(String(candidate.appearance.theme))
        ? candidate.appearance.theme
        : candidate.appearance && isRecord(candidate.appearance) && candidate.appearance.theme === "light"
          ? "light"
          : "graphite",
      cornerRadius: isRecord(candidate.appearance) &&
        ["sharp", "medium", "rounded"].includes(String(candidate.appearance.cornerRadius))
        ? candidate.appearance.cornerRadius
        : "medium",
    },
    security: {
      ...DEFAULT_USER_SETTINGS.security,
      ...(isRecord(candidate.security) ? candidate.security : {}),
    },
  };

  const parsed = userSettingsSchema.safeParse(migrated);
  return parsed.success ? parsed.data : DEFAULT_USER_SETTINGS;
}

export function mergeUserSettings(current: UserSettings, patch: SettingsPatch): UserSettings {
  const merged = {
    ...current,
    ...patch,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    general: { ...current.general, ...patch.general },
    navigation: { ...current.navigation, ...patch.navigation },
    routine: { ...current.routine, ...patch.routine },
    finance: { ...current.finance, ...patch.finance },
    appearance: { ...current.appearance, ...patch.appearance },
    security: { ...current.security, ...patch.security },
  };
  return userSettingsSchema.parse(merged);
}
