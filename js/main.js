/**
 * Módulo: main.js
 */
import { appState } from './state.js';
import * as dom from './dom.js';
import { fetchAndRenderData, cargarOrganismos, cargarProvincias } from './api.js';
import { iniciarActualizacionEstado, detenerActualizacionEstado } from './presentation.js';
import { mostrarSkeleton } from './ui.js';
import './theme.js';
import './table.js';

// --- visibilitychange ---

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      detenerActualizacionEstado();
    } else if (appState.filtroOrganismo !== "" || appState.filtroProvincia !== "") {
      iniciarActualizacionEstado();
    }
  });

  
// --- Submit ---

  dom.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    appState.filtroOrganismo = dom.selectOrganismo.value;
    appState.filtroProvincia = dom.selectProvincia.value;
    appState.sortCol = null; appState.sortDir = 1;
    appState.filtroTexto = ""; dom.searchInput.value = "";
    mostrarSkeleton();
    dom.thead.innerHTML = ""; dom.tbody.innerHTML = "";
    dom.tabla.style.display = "none";
    dom.logsNormalSection.hidden = true;
    dom.presentacionLista.hidden = true;
    dom.presentacionLista.innerHTML = "";
    appState.columnasTabla = []; appState.prevEstados = {};
    detenerActualizacionEstado();
    await fetchAndRenderData();
    iniciarActualizacionEstado();
  });

// Inicialización
cargarOrganismos();
cargarProvincias();
