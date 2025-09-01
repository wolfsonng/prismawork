const KEY = 'theme';

export function initTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enable = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', enable);
  } catch {}
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem(KEY, isDark ? 'dark' : 'light'); } catch {}
  return isDark;
}

export function setTheme(mode: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  try { localStorage.setItem(KEY, mode); } catch {}
}

