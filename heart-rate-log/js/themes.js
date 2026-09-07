const THEME_STORAGE_KEY = 'hrlog_theme_v1';

const THEMES = [
  {
    id: 'rose',
    name: 'Rose',
    note: 'Warm, a little urgent — closest to ZIO\'s own alert-red energy.',
    accent: '#d6336c',
    accent2: '#ff6b9d',
  },
  {
    id: 'teal',
    name: 'Clinical Teal',
    note: 'Calmer, reads like a monitor trace.',
    accent: '#0e8f83',
    accent2: '#4fd1c5',
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    note: 'Friendlier and less alarming — a logbook, not a warning light.',
    accent: '#b7791f',
    accent2: '#f0b429',
  },
  {
    id: 'indigo',
    name: 'Muted Indigo',
    note: 'Quiet and modern — recedes and lets the data lead.',
    accent: '#5b5fc7',
    accent2: '#a5a8e8',
  },
];

function getSavedThemeId() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'rose';
}

function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent-2', theme.accent2);
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  return theme.id;
}
