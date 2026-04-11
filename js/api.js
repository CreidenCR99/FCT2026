/**
 * Módulo: api.js
 */
import { appState } from './state.js';
import * as dom from './dom.js';
import { renderKPIs, renderLogsNormal, mostrarSkeleton } from './ui.js';
import { getEstadoControl, renderTabla } from './table.js';
import { calcularMaxLineas, construirPaginasPresentacion, renderPresentacion } from './presentation.js';

// --- Inicialización ---
  
/**
 * @description Función cargarOrganismos.
 * @returns {void|any}
 */
export async function cargarOrganismos() {
    try {
      const res = await fetch("datos.php?modo=organismos");
      const data = await res.json();
      dom.selectOrganismo.innerHTML = `<option value="">Todos los organismos</option>`;
      data.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.Organismo;
        opt.textContent = item.Organismo;
        dom.selectOrganismo.appendChild(opt);
      });
    } catch (e) {
      dom.selectOrganismo.innerHTML = `<option value="">Error al cargar</option>`;
      console.error(e);
    }
  }

  
/**
 * @description Función cargarProvincias.
 * @param {any} organismo
 * @returns {void|any}
 */
export async function cargarProvincias(organismo = "") {
    try {
      const res = await fetch(`datos.php?modo=provincias&organismo=${encodeURIComponent(organismo)}`);
      const data = await res.json();
      const valorActual = dom.selectProvincia.value;
      dom.selectProvincia.innerHTML = `<option value="">Todas las provincias</option>`;
      data.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.Provincia;
        opt.textContent = item.Provincia;
        dom.selectProvincia.appendChild(opt);
      });
      if (data.some(item => item.Provincia === valorActual)) {
        dom.selectProvincia.value = valorActual;
      }
    } catch (e) {
      dom.selectProvincia.innerHTML = `<option value="">Error al cargar</option>`;
      console.error(e);
    }
  }

  dom.selectOrganismo.addEventListener("change", () => { cargarProvincias(dom.selectOrganismo.value); });

  dom.limpiarFiltrosBtn.addEventListener("click", () => {
    dom.selectOrganismo.value = "";
    dom.selectProvincia.value = "";
    cargarProvincias("");
  });

  
// ---- Fetch + render ----

  
/**
 * @description Función fetchAndRenderData.
 * @returns {void|any}
 */
export async function fetchAndRenderData() {
    if (appState.currentController) appState.currentController.abort();
    appState.currentController = new AbortController();
    try {
      const res = await fetch(
        `datos.php?modo=maquinas&organismo=${encodeURIComponent(appState.filtroOrganismo)}&provincia=${encodeURIComponent(appState.filtroProvincia)}`,
        { signal: appState.currentController.signal }
      );
      const data = await res.json();

      const nuevosEstados = {};
      data.forEach(m => { nuevosEstados[m.NumeroSerie] = getEstadoControl(m).clase; });
      const maquinasCambiadas = new Set();
      if (Object.keys(appState.prevEstados).length > 0) {
        data.forEach(m => {
          if (appState.prevEstados[m.NumeroSerie] && appState.prevEstados[m.NumeroSerie] !== nuevosEstados[m.NumeroSerie]) {
            maquinasCambiadas.add(m.NumeroSerie);
          }
        });
      }
      appState.prevEstados = nuevosEstados;
      appState.datosTabla = data;

      if (data.length > 0 && appState.columnasTabla.length === 0) {
        appState.columnasTabla = Object.keys(data[0]).filter(col =>
          col !== "UltimoControl" && col !== "MonitorizarEstado" &&
          col !== "NumeroSerie" && col !== "MonitorizarAlertas" && col !== "Logs"
        );
      } else if (data.length === 0) {
        appState.columnasTabla = [];
      }

      renderKPIs(data);
      
      if (!appState.modoPresentacion) {
        renderLogsNormal(data);
      }

      if (appState.modoPresentacion) {
        calcularMaxLineas();
        appState.paginasPresentacion = construirPaginasPresentacion(data);
        if (appState.paginaPresentacionActual >= appState.paginasPresentacion.length) appState.paginaPresentacionActual = 0;
        renderPresentacion();
      } else {
        renderTabla(maquinasCambiadas);
        dom.tabla.style.display = "table";
      }

      let msg = `${data.length} máquina${data.length !== 1 ? "s" : ""} total${data.length !== 1 ? "es" : ""}`;
      if (appState.filtroOrganismo && appState.filtroProvincia) msg += ` — "${appState.filtroOrganismo}" en "${appState.filtroProvincia}"`;
      else if (appState.filtroOrganismo) msg += ` — "${appState.filtroOrganismo}"`;
      else if (appState.filtroProvincia) msg += ` — "${appState.filtroProvincia}"`;
      dom.estadoTabla.textContent = msg;

    } catch (error) {
      if (error.name === "AbortError") return;
      dom.estadoTabla.textContent = "Error al cargar los datos.";
      console.error("Error al actualizar datos:", error);
    }
  }
