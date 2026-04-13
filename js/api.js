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
 * Realiza una petición al backend para obtener la lista de organismos únicos disponibles.
 * Una vez obtenidos, puebla dinámicamente el selector (select) de organismos en el formulario.
 * @async
 * @returns {Promise<void>}
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
 * Obtiene la lista de provincias desde el servidor, opcionalmente filtrada por un organismo específico.
 * Actualiza el selector de provincias y trata de mantener la selección previa si esta sigue existiendo
 * en los nuevos resultados.
 * @async
 * @param {string} [organismo=""] - Nombre del organismo para filtrar las provincias.
 * @returns {Promise<void>}
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
 * Función principal de sincronización de datos. Realiza lo siguiente:
 * 1. Aborta peticiones anteriores pendientes.
 * 2. Solicita el dataset de máquinas y logs filtrado por los criterios actuales.
 * 3. Compara estados para detectar cambios y disparar animaciones visuales.
 * 4. Orquesta el renderizado de KPIs, errores activos y la vista (Tabla o Presentación).
 * @async
 * @returns {Promise<void>}
 */
export async function fetchAndRenderData() {
    // Cancelamos cualquier petición anterior que todavía esté en vuelo
    if (appState.currentController) appState.currentController.abort();
    appState.currentController = new AbortController();

    try {
      // Realizamos la llamada al backend con los filtros actuales de estado
      const res = await fetch(
        `datos.php?modo=maquinas&organismo=${encodeURIComponent(appState.filtroOrganismo)}&provincia=${encodeURIComponent(appState.filtroProvincia)}`,
        { signal: appState.currentController.signal }
      );
      const data = await res.json();

      // Validación de seguridad: Si el backend devuelve un objeto de error en lugar de un array
      if (!Array.isArray(data)) throw new Error(data.error || "La respuesta del servidor no es un listado válido.");

      // Identificamos el estado de cada máquina para comparar cambios
      const nuevosEstados = {};
      data.forEach(m => { nuevosEstados[m.NumeroSerie] = getEstadoControl(m).clase; });
      
      const maquinasCambiadas = new Set();
      if (Object.keys(appState.prevEstados).length > 0) {
        data.forEach(m => {
          // Si el estado visual (clase CSS) ha cambiado, la añadimos para animar la fila
          if (appState.prevEstados[m.NumeroSerie] && appState.prevEstados[m.NumeroSerie] !== nuevosEstados[m.NumeroSerie]) {
            maquinasCambiadas.add(m.NumeroSerie);
          }
        });
      }
      appState.prevEstados = nuevosEstados;
      appState.datosTabla = data;

      // Si es la primera carga con datos, extraemos dinámicamente las columnas de la tabla
      if (data.length > 0 && appState.columnasTabla.length === 0) {
        appState.columnasTabla = Object.keys(data[0]).filter(col =>
          col !== "UltimoControl" && col !== "MonitorizarEstado" &&
          col !== "NumeroSerie" && col !== "MonitorizarAlertas" && col !== "Logs"
        );
      } else if (data.length === 0) {
        appState.columnasTabla = [];
      }

      // Renderizado de componentes globales
      renderKPIs(data);
      
      if (!appState.modoPresentacion) {
        renderLogsNormal(data);
      }

      // Decidimos qué vista renderizar según el modo actual
      if (appState.modoPresentacion) {
        calcularMaxLineas();
        appState.paginasPresentacion = construirPaginasPresentacion(data);
        if (appState.paginaPresentacionActual >= appState.paginasPresentacion.length) appState.paginaPresentacionActual = 0;
        renderPresentacion();
      } else {
        renderTabla(maquinasCambiadas);
        dom.tabla.style.display = "table";
      }

      // Actualizamos el mensaje de estado en la parte inferior de los filtros
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
