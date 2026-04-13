/**
 * Módulo: table.js
 */
import { appState } from './state.js';
import * as dom from './dom.js';
import { cerrarModal } from './ui.js';
import { salirModoPresentation, renderPresentacion } from './presentation.js';

// --- Búsqueda en tabla ---

  dom.searchInput.addEventListener("input", () => {
    appState.filtroTexto = dom.searchInput.value.trim().toLowerCase();
    if (appState.datosTabla.length > 0) renderTabla();
  });

  
// ---- Exportar CSV ----

  
/**
 * Genera un archivo CSV con los datos actuales de las máquinas visibles (monitorizadas).
 * Incluye todas las columnas de la tabla y añade una columna extra con el estado calculado (✓, !, ⚠, etc.).
 * Dispara automáticamente la descarga en el navegador.
 * @returns {void}
 */
export function exportarCSV() {
    const datos = appState.datosTabla.filter(f => !esFalso(f.MonitorizarEstado));
    if (!datos.length) return;
    const headers = [...appState.columnasTabla, "Estado"];
    const rows = datos.map(fila => {
      const cols = appState.columnasTabla.map(col => `"${String(fila[col] ?? "").replace(/"/g, '""')}"`);
      cols.push(getEstadoControl(fila).texto);
      return cols.join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maquinas_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  
// ---- Parseo fecha ----

  
/**
 * Convierte una cadena de texto con formato YYYYMMDDHHMM (proveniente de la DB) en un objeto Date de JS.
 * @param {string|number} valor - El valor temporal en formato compacto.
 * @returns {Date|null} Objeto Date si el formato es correcto, de lo contrario null.
 */
export function parseUltimoControl(valor) {
    if (!valor) return null;
    const texto = String(valor).trim();
    if (!/^\d{12}$/.test(texto)) return null;
    return new Date(
      parseInt(texto.slice(0, 4), 10),
      parseInt(texto.slice(4, 6), 10) - 1,
      parseInt(texto.slice(6, 8), 10),
      parseInt(texto.slice(8, 10), 10),
      parseInt(texto.slice(10, 12), 10)
    );
  }

  
/**
 * Determina el estado de salud de una máquina basándose en su última conexión y alertas.
 * - Prioriza "⚠" (naranja) si tiene alertas de log activas.
 * - "✓" (verde) si conectó en los últimos 10 minutos.
 * - "!" (rojo) si lleva más de 10 minutos sin reporte.
 * - "?" (gris) si no hay datos de fecha.
 * @param {Object} fila - Objeto con los datos de la máquina.
 * @returns {{texto: string, clase: string}} Objeto con la etiqueta y la clase CSS correspondiente.
 */
export function getEstadoControl(fila) {
    if (esFalso(fila.MonitorizarAlertas)) return { texto: "⚠", clase: "estado-naranja" };
    const fechaControl = parseUltimoControl(fila.UltimoControl);
    if (!fechaControl || Number.isNaN(fechaControl.getTime())) return { texto: "?", clase: "estado-gris" };
    if ((new Date() - fechaControl) / 60000 < 10) return { texto: "✓", clase: "estado-verde" };
    return { texto: "!", clase: "estado-rojo" };
  }

  
/**
 * Normaliza la comprobación de valores "falsos" o "nulos" que pueden venir de la base de datos como strings.
 * Considera falso: null, undefined, false, 0, "0", "false", "null", "undefined" y cadenas vacías.
 * @param {any} valor - El valor a evaluar.
 * @returns {boolean} True si el valor se considera lógicamente falso para la aplicación.
 */
export function esFalso(valor) {
    if (valor === null || typeof valor === "undefined") return true;
    if (typeof valor === "boolean") return !valor;
    const v = String(valor).trim().toLowerCase();
    return v === "0" || v === "false" || v === "null" || v === "undefined" || v === "";
  }

  
/**
 * Construye el texto informativo para el tooltip de la pill de estado.
 * Muestra la fecha y hora exacta del último control formateada para humanos.
 * @param {Object} fila - Datos de la máquina.
 * @returns {string} Mensaje informativo sobre el último control.
 */
export function getTooltipEstado(fila) {
    const fecha = parseUltimoControl(fila.UltimoControl);
    if (!fecha) return "Sin fecha de control";
    const pad = n => String(n).padStart(2, "0");
    return `Último control: ${pad(fecha.getDate())}/${pad(fecha.getMonth()+1)}/${fecha.getFullYear()} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
  }

  
// ---- Renderizar tabla ----
  
/**
 * Renderiza la tabla de datos en el DOM aplicando filtros de texto y ordenación.
 * Crea las cabeceras interactivas y las filas de datos con sus respectivos badges de estado.
 * @param {Set<string>} [maquinasCambiadas=new Set()] - Conjunto de Números de Serie que han cambiado 
 * de estado desde la última actualización para aplicar efectos visuales.
 * @returns {void}
 */
export function renderTabla(maquinasCambiadas = new Set()) {
    let datosFiltrados = appState.datosTabla.filter(f => !esFalso(f.MonitorizarEstado));

    if (appState.filtroTexto) {
      datosFiltrados = datosFiltrados.filter(f =>
        appState.columnasTabla.some(col => String(f[col] ?? "").toLowerCase().includes(appState.filtroTexto))
      );
    }

    // Orden por columna activa (sin prioridad automática por estado)
    if (appState.sortCol !== null) {
      datosFiltrados = [...datosFiltrados].sort((a, b) => {
        const va = String(a[appState.sortCol] ?? "").toLowerCase();
        const vb = String(b[appState.sortCol] ?? "").toLowerCase();
        return va < vb ? -appState.sortDir : va > vb ? appState.sortDir : 0;
      });
    }

    if (!datosFiltrados.length) {
      dom.thead.innerHTML = "";
      dom.tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:1rem">${
        appState.filtroTexto ? `Sin resultados para <strong>${appState.filtroTexto}</strong>` : "Sin datos para mostrar"
      }</td></tr>`;
      return;
    }

    dom.thead.innerHTML = `
      <tr role="row">
        ${appState.columnasTabla.map(col => {
          const isActive = appState.sortCol === col;
          const arrow = isActive ? (appState.sortDir === 1 ? " ↑" : " ↓") : "";
          return `<th scope="col" data-col="${col}" class="th-sortable${isActive ? " th-active" : ""}" tabindex="0"
            aria-sort="${isActive ? (appState.sortDir === 1 ? "ascending" : "descending") : "none"}"
            title="Ordenar por ${col}">${col}${arrow}</th>`;
        }).join("")}
        <th scope="col">Estado</th>
      </tr>
    `;

    dom.thead.querySelectorAll(".th-sortable").forEach(th => {
      th.addEventListener("click", () => onSortClick(th.dataset.col));
      th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSortClick(th.dataset.col); } });
    });

    dom.tbody.innerHTML = "";
    datosFiltrados.forEach(fila => {
      const estado  = getEstadoControl(fila);
      const tooltip = getTooltipEstado(fila);
      const tr = document.createElement("tr");
      if (maquinasCambiadas.has(fila.NumeroSerie)) tr.classList.add("fila-cambiada");
      tr.innerHTML = `
        ${appState.columnasTabla.map(col => `<td>${fila[col] ?? ""}</td>`).join("")}
        <td><span class="estado-pill ${estado.clase}" title="${tooltip}" aria-label="Estado: ${estado.texto}">${estado.texto}</span></td>
      `;
      dom.tbody.appendChild(tr);
    });
    dom.exportCsvBtn.addEventListener("click", exportarCSV);
  }

  
/**
 * Maneja el evento de click en las cabeceras de la tabla para alternar la ordenación.
 * Si se pulsa en la misma columna, invierte la dirección. Si es una nueva, ordena ascendente.
 * Re-renderiza la tabla tras el cambio.
 * @param {string} col - Nombre de la columna por la que ordenar.
 * @returns {void}
 */
export function onSortClick(col) {
    if (appState.sortCol === col) appState.sortDir = -appState.sortDir;
    else { appState.sortCol = col; appState.sortDir = 1; }
    renderTabla();
  }

  
// ---- Teclado ----

  document.addEventListener("keydown", (e) => {
    const isEscape = e.key === "Escape";
    // Comprobación más fiable de si el modal está visible en pantalla (considerando CSS y estilos inline)
    const isModalOpen = dom.modalLog && 
                        window.getComputedStyle(dom.modalLog).display !== "none";

    // Prioridad: Cerrar modal si está abierto
    if (isModalOpen) {
      if (isEscape) {
        // Evitamos que el navegador procese el ESC para salir de pantalla completa
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cerrarModal();
      }
      return; // Bloqueamos otras teclas mientras el modal está abierto
    }

    if (!appState.modoPresentacion) return;

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      appState.estaPausado = !appState.estaPausado;
      dom.indicadorReproduccion.textContent = appState.estaPausado ? "⏸" : "▶";
      dom.indicadorReproduccion.style.display = "block";
      setTimeout(() => { dom.indicadorReproduccion.style.display = "none"; }, 1500);
    } else if (e.key === "ArrowRight") {
      appState.paginaPresentacionActual = (appState.paginaPresentacionActual + 1) % appState.paginasPresentacion.length;
      renderPresentacion();
    } else if (e.key === "ArrowLeft") {
      appState.paginaPresentacionActual = (appState.paginaPresentacionActual - 1 + appState.paginasPresentacion.length) % appState.paginasPresentacion.length;
      renderPresentacion();
    } else if (isEscape) {
      salirModoPresentation();
    }
  });
