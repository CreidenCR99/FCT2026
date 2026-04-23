/**
 * Módulo: main.js
 */
import { appState } from './state.js';
import * as dom from './dom.js';
import { fetchAndRenderData, cargarPaises, cargarOrganismos, cargarProvincias } from './api.js';
import { iniciarActualizacionEstado, detenerActualizacionEstado } from './presentation.js';
import { mostrarSkeleton } from './ui.js';
import './theme.js';
import './table.js';
import { initSearchMaster } from './searchMaster.js';
import { initAllMaestros } from './entityMaster.js';

// --- visibilitychange ---

/**
 * Gestiona el ciclo de vida de la actualización automática cuando el usuario
 * cambia de pestaña o minimiza el navegador para ahorrar recursos.
 */
document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		detenerActualizacionEstado();
	} else if (appState.datosTabla.length > 0) {
    fetchAndRenderData();
    iniciarActualizacionEstado();
	}
});


// --- Submit ---

/**
 * Manejador del evento de envío del formulario de búsqueda principal.
 */
dom.form.addEventListener("submit", async (event) => {
	event.preventDefault();
	appState.filtroPais = dom.selectPais.value;
	appState.filtroOrganismo = dom.selectOrganismo.value;
	appState.filtroProvincia = dom.selectProvincia.value;
	appState.sortCol = null;
	appState.sortDir = 1;
	appState.filtroTexto = "";
	dom.searchInput.value = "";
	appState.animarTabla = true; // Habilitar animaciones para esta búsqueda
	mostrarSkeleton();
	dom.thead.innerHTML = "";
	dom.tbody.innerHTML = "";
	dom.tabla.style.display = "none";
	dom.logsNormalSection.hidden = true;
	dom.presentacionLista.hidden = true;
	dom.presentacionLista.innerHTML = "";
	appState.columnasTabla = [];
	appState.prevEstados = {};
	appState.lastDataHash = "";
	detenerActualizacionEstado();
	await fetchAndRenderData();
	appState.animarTabla = false; // Deshabilitar para siguientes refrescos automáticos
	iniciarActualizacionEstado();
});

// Inicialización
cargarPaises(); // Carga inicial de países en el selector
cargarOrganismos(); // Carga inicial de organismos en el selector
cargarProvincias(); // Carga inicial de provincias en el selector
initSearchMaster(); // Inicializar Maestro de Búsqueda (F2)
initAllMaestros(); // Inicializar Sistema Unificado de Maestros

// Ejecutar búsqueda inicial sin filtros para mostrar todas las máquinas al cargar la aplicación
dom.form.dispatchEvent(new Event('submit'));