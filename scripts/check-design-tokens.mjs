import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["app", "components", "contexts", "hooks", "lib"];
const EXTENSIONS = new Set([".css", ".ts", ".tsx"]);
const COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/g,
  /\b(?:rgba?|hsla?)\(\s*[^)]+\)/g,
  /\b(?:bg|text|border|ring|shadow|from|to|via)-(?:red|green|blue|yellow|orange|purple|pink|gray|grey|slate|zinc|neutral|stone|amber|emerald|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)-\d{2,3}(?:\/\d{1,3})?\b/g,
];
const violations = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (EXTENSIONS.has(path.extname(entry.name))) inspect(fullPath);
  }
}

function inspect(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//")) return;
    const isTokenDeclaration = /^\s*--[\w-]+\s*:/.test(line);
    if (!isTokenDeclaration) {
      for (const pattern of COLOR_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of line.matchAll(pattern)) {
          violations.push({
            file: path.relative(ROOT, filePath),
            line: index + 1,
            value: match[0],
            reason: "cor fixa; use um token --nexo-*",
          });
        }
      }
      if (/\bstyle\s*=/.test(line)) {
        violations.push({
          file: path.relative(ROOT, filePath),
          line: index + 1,
          value: "style=",
          reason: "estilo inline bloqueado pela CSP; use classe CSS/token",
        });
      }
    }
  });
}

for (const root of SCAN_ROOTS) walk(path.join(ROOT, root));

if (violations.length) {
  console.error("Encontradas " + violations.length + " violações de design tokens:");
  for (const item of violations) {
    console.error(item.file + ":" + item.line + " " + item.value + " — " + item.reason);
  }
  console.error("\nMigre as ocorrências para tokens semânticos antes de ativar a checagem como bloqueio de CI.");
  process.exitCode = 1;
} else {
  console.log("Design tokens: nenhuma cor fixa ou estilo inline encontrado.");
}
