/**
 * Módulo: theme.js
 */
import { themeToggle } from './dom.js';

// --- Modo oscuro ---

  const htmlEl = document.documentElement;
  let currentTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "dark" : "light";
  htmlEl.setAttribute("data-theme", currentTheme);
  updateThemeIcon();

  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", currentTheme);
    updateThemeIcon();
  });

  
/**
 * @description Función updateThemeIcon.
 * @returns {void|any}
 */
export function updateThemeIcon() {
    themeToggle.innerHTML = currentTheme === "light"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    themeToggle.setAttribute("aria-label", `Cambiar a modo ${currentTheme === "light" ? "claro" : "oscuro"}`);
  }
