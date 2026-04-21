/**
 * Módulo: theme.js
 */
import { themeToggle } from './dom.js';

// --- Modo oscuro ---

/**
 * Elemento raíz para aplicar el atributo de tema.
 */
const htmlEl = document.documentElement;
/**
 * Detecta la preferencia inicial del sistema o navegador.
 */
let currentTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "dark" : "light";
htmlEl.setAttribute("data-theme", currentTheme);
updateThemeIcon();

/** Evento para alternar el tema visual de la aplicación. */
themeToggle.addEventListener("click", () => {
	currentTheme = currentTheme === "light" ? "dark" : "light";
	htmlEl.setAttribute("data-theme", currentTheme);
	updateThemeIcon();
});


/**
 * Actualiza el icono y la etiqueta de accesibilidad del botón de tema según el estado actual.
 * Tambien actualiza el logo de claro a oscuro
 * @returns {void}
 */
export function updateThemeIcon() {
	const logos = document.querySelectorAll('img[src*="LOGO_SicoLares"]');
	logos.forEach(img => {
		if (currentTheme === "dark") {
			img.src = img.src.replace("LOGO_SicoLares.png", "LOGO_SicoLares_Negativo.png");
		} else {
			img.src = img.src.replace("LOGO_SicoLares_Negativo.png", "LOGO_SicoLares.png");
		}
	});

	themeToggle.innerHTML = currentTheme === "light" ?
		`<svg width="2vh" height="2vh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>` :
		`<svg width="2vh" height="2vh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
	themeToggle.setAttribute("aria-label", `Cambiar a modo ${currentTheme === "light" ? "claro" : "oscuro"}`);
}