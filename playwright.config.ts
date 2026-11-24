import net from "node:net";
import { defineConfig, devices } from "@playwright/test";

const productionPwaTest = process.env.NEXO_PWA_E2E_PRODUCTION === "true";

// Em CI, os testes usam APIs mockadas e não dependem de uma sessão real do Supabase.
// Em CI, os testes usam APIs mockadas e não dependem de uma sessão real do Supabase.
if (process.env.CI) process.env.NEXO_E2E_TEST_MODE = "true";

// Evita que ambientes com Node.js 24 iniciem conexões com timeout automático inválido.
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

export default defineConfig({
  testDir: "./tests",

  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { open: "never" }]
  ],

  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
              }
            }
          : {})
      }
    }
  ],

  webServer: {
    command: productionPwaTest
      ? "npm run start -- --hostname 127.0.0.1 --port 3001"
      : "npm run dev -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: productionPwaTest ? {} : { NEXO_E2E_TEST_MODE: "true" }
  }
});
