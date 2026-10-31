/** UI themes and scale steps, shared by the main-menu settings and the phone's System app. */
export const THEMES = [
  { id: 'functional', label: 'Functional', note: 'CRT green · nicotine amber', dot: '#6fae82' },
  { id: 'amber', label: 'Amber', note: 'Shale Mobile · warm glass', dot: '#ffb347' },
  { id: 'ice', label: 'Ice', note: 'Clinic blue · cold readout', dot: '#63c8ff' },
  { id: 'vhs', label: 'VHS', note: 'Magenta bleed · late rental', dot: '#ff7ad9' },
  { id: 'primo', label: 'Primo', note: 'Indigo glass · cyan pills', dot: '#4cc9ff' },
  { id: 'bodega', label: 'Bodega', note: 'Neon sign · 3am grill', dot: '#ff5f8f' },
  { id: 'graphite', label: 'Graphite', note: 'Monochrome · quiet hours', dot: '#e8e8ec' },
];

export const SCALES = [
  { value: 0.9, label: 'S' },
  { value: 1, label: 'M' },
  { value: 1.12, label: 'L' },
];

export const themeLabel = (id) => (THEMES.find((t) => t.id === id) || THEMES[0]).label;
