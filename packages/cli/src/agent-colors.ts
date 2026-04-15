/**
 * 8 distinguishable agent colors from ARCHITECTURE.md spec.
 * Each has light and dark mode variants.
 */
export const AGENT_COLORS = [
  { name: 'Blue', light: '#2563eb', dark: '#60a5fa', chalk: 'blue' },
  { name: 'Green', light: '#16a34a', dark: '#4ade80', chalk: 'green' },
  { name: 'Orange', light: '#ea580c', dark: '#fb923c', chalk: 'yellow' },
  { name: 'Purple', light: '#9333ea', dark: '#c084fc', chalk: 'magenta' },
  { name: 'Red', light: '#dc2626', dark: '#f87171', chalk: 'red' },
  { name: 'Teal', light: '#0d9488', dark: '#2dd4bf', chalk: 'cyan' },
  { name: 'Pink', light: '#db2777', dark: '#f472b6', chalk: 'magentaBright' },
  { name: 'Yellow', light: '#ca8a04', dark: '#facc15', chalk: 'yellowBright' },
] as const;

const agentColorMap = new Map<string, (typeof AGENT_COLORS)[number]>();
let nextColorIndex = 0;

/** Get a consistent color assignment for an agent ID. */
export function getAgentColor(agentId: string): (typeof AGENT_COLORS)[number] {
  let color = agentColorMap.get(agentId);
  if (!color) {
    color = AGENT_COLORS[nextColorIndex % AGENT_COLORS.length];
    agentColorMap.set(agentId, color);
    nextColorIndex++;
  }
  return color;
}
