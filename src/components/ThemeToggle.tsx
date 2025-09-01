import React, { useEffect, useState } from 'react';
import { toggleTheme } from '../theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  return (
    <button
      className="px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-gray-100"
      title={dark ? 'Switch to light' : 'Switch to dark'}
      onClick={() => setDark(toggleTheme())}
    >
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}
