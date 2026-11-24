import { expect, test } from "@playwright/test";
import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  migrateUserSettings,
  userSettingsSchema,
} from "../lib/settings/schema";
import { userProfileSchema } from "../lib/settings/profile-schema";

test.describe("NEXO user settings schema", () => {
  test("migrates legacy preferences without losing the sidebar choice", () => {
    const migrated = migrateUserSettings({
      weekStartsOn: "sunday",
      sidebarCollapsed: true,
      navigationFavorites: ["/financeiro"],
    });

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.appearance.theme).toBe("graphite");
    expect(migrated.appearance.cornerRadius).toBe("medium");
    expect(migrated.general.weekStartsOn).toBe(0);
    expect(migrated.navigation.sidebarCompact).toBe(true);
  });

  test("migrates the previous dark theme to Grafite without losing user preferences", () => {
    const migrated = migrateUserSettings({
      settingsV1: {
        ...DEFAULT_USER_SETTINGS,
        schemaVersion: 1,
        appearance: { ...DEFAULT_USER_SETTINGS.appearance, theme: "dark" },
        general: { ...DEFAULT_USER_SETTINGS.general, homePage: "/financeiro" },
      },
    });
    expect(migrated.appearance.theme).toBe("graphite");
    expect(migrated.general.homePage).toBe("/financeiro");
  });

  test("validates appearance values and rejects unsupported themes", () => {
    const invalid = {
      ...DEFAULT_USER_SETTINGS,
      appearance: { ...DEFAULT_USER_SETTINGS.appearance, theme: "neon" },
    };
    expect(userSettingsSchema.safeParse(invalid).success).toBe(false);
  });

  test("merges a privacy change without resetting unrelated preferences", () => {
    const updated = mergeUserSettings(DEFAULT_USER_SETTINGS, {
      finance: { hideValues: true },
      appearance: { accent: "blue" },
    });
    expect(updated.finance.hideValues).toBe(true);
    expect(updated.appearance.accent).toBe("blue");
    expect(updated.general.homePage).toBe("/");
  });
});

test.describe("NEXO profile validation", () => {
  test("accepts a basic profile", () => {
    expect(userProfileSchema.safeParse({ displayName: "NEXO User" }).success).toBe(true);
  });

  test("rejects an oversized avatar payload", () => {
    const result = userProfileSchema.safeParse({
      displayName: "NEXO User",
      avatarUrl: "data:image/webp;base64," + "A".repeat(240001),
    });
    expect(result.success).toBe(false);
  });
});
