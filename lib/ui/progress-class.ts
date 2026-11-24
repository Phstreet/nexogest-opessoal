function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function progressWidthClass(value: number, baseClass = ""): string {
  return [baseClass, `nexo-progress-width-${clampPercent(value)}`].filter(Boolean).join(" ");
}

export function progressHeightClass(value: number, baseClass = ""): string {
  return [baseClass, `nexo-progress-height-${clampPercent(value)}`].filter(Boolean).join(" ");
}

export function progressRingClass(value: number, baseClass = ""): string {
  return [baseClass, `nexo-progress-ring-${clampPercent(value)}`].filter(Boolean).join(" ");
}

export function progressHeightPxClass(value: number, baseClass = ""): string {
  const pixels = Number.isFinite(value) ? Math.min(150, Math.max(3, Math.round(value))) : 3;
  return [baseClass, `nexo-progress-height-px-${pixels}`].filter(Boolean).join(" ");
}
