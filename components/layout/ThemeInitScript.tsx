// Server Component — injects inline script to apply saved theme before first paint
// This prevents the flash of wrong theme on page load (no 'use client' needed)
export default function ThemeInitScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem('padelgo-theme');
        var theme = stored ? JSON.parse(stored).state?.theme : 'dark';
        document.documentElement.setAttribute('data-theme', theme || 'dark');
      } catch(e) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
