// Validated reference palette from the dataviz skill (references/palette.md).
// Fixed order — never cycle or reassign per-filter. Verified with
// scripts/validate_palette.js against the light surface below: all hard
// gates PASS (worst adjacent CVD ΔE 9.1, worst adjacent normal-vision ΔE
// 19.6). Slots 3/4/5 (aqua/yellow/magenta) sit under 3:1 contrast on a
// light surface by design — every chart using them ships direct labels or
// a legend (the "relief" the palette doc requires), never color alone.
export const CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

// Sequential default hue (single-hue magnitude charts — bar/line with one series).
export const SEQUENTIAL_BLUE = "#2a78d6";

export const CHART_INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
  surface: "#ffffff", // matches this app's Card background
} as const;
