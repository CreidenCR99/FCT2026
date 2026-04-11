/**
 * Módulo: presentation.js
 */
import { appState, INTERVALO_MS } from './state.js';
import * as dom from './dom.js';
import { getEstadoControl, esFalso, renderTabla } from './table.js';
import { renderLogsNormal, iniciarProgressBar, detenerProgressBar, escapeHtml, abrirModalError, obtenerErroresActivos } from './ui.js';
import { fetchAndRenderData } from './api.js';

// ---- Calcular max líneas presentación ----

/**
 * @description Función calcularMaxLineas.
 * @returns {void|any}
 */
export function calcularMaxLineas() {
    const calculo = Math.floor(window.innerHeight / 54);
    appState.maxLineasPresentacion = Math.min(36, Math.max(20, calculo));
  }

  
// ---- Resize con debounce ----

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (appState.modoPresentacion) {
        calcularMaxLineas();
        appState.paginasPresentacion = construirPaginasPresentacion(appState.datosTabla);
        if (appState.paginaPresentacionActual >= appState.paginasPresentacion.length) appState.paginaPresentacionActual = 0;
        renderPresentacion();
      }
    }, 200);
  });

  
// ---- Intervalo de actualización ----

  
/**
 * @description Función iniciarActualizacionEstado.
 * @returns {void|any}
 */
export function iniciarActualizacionEstado() {
    detenerActualizacionEstado();
    iniciarProgressBar();
    appState.estadoInterval = setInterval(async () => {
      await fetchAndRenderData();
      
      // Sincronización: Si estamos en presentación y no está pausado, cambiamos de página
      if (appState.modoPresentacion && !appState.estaPausado) {
        appState.paginaPresentacionActual = (appState.paginaPresentacionActual + 1) % appState.paginasPresentacion.length;
        renderPresentacion();
      }

      // El progress bar se reinicia siempre para marcar el siguiente ciclo
      iniciarProgressBar();
    }, INTERVALO_MS);
  }

  
/**
 * @description Función detenerActualizacionEstado.
 * @returns {void|any}
 */
export function detenerActualizacionEstado() {
    if (appState.estadoInterval) { clearInterval(appState.estadoInterval); appState.estadoInterval = null; }
    detenerProgressBar();
  }

  
// ---- Construir páginas de presentación ----

  // Agrupa por organismo→provincia→cliente para que nunca se corte un bloque de cliente
  
/**
 * @description Función construirPaginasPresentacion.
 * @param {any} datos
 * @returns {void|any}
 */
export function construirPaginasPresentacion(datos) {
    const monitorizadas = datos.filter(m => !esFalso(m.MonitorizarEstado));

    const agrupado = {};
    monitorizadas.forEach(m => {
      const org  = m.Organismo  || "Sin organismo";
      const prov = m.Provincia  || "Sin provincia";
      const cli  = m.Cliente    || "Sin cliente";
      if (!agrupado[org]) agrupado[org] = {};
      if (!agrupado[org][prov]) agrupado[org][prov] = {};
      if (!agrupado[org][prov][cli]) agrupado[org][prov][cli] = [];
      agrupado[org][prov][cli].push({
        tipo: "maquina",
        texto: m.Descripcion,
        estado: getEstadoControl(m),
        fila: m
      });
    });

    const paginas = [];
    let paginaActual = [];
    let lineasActuales = 0;

    Object.keys(agrupado).forEach(org => {
      let orgEnPagina = false;
      Object.keys(agrupado[org]).forEach(prov => {
        let provEnPagina = false;
        Object.keys(agrupado[org][prov]).forEach(cli => {
          const maquinas = agrupado[org][prov][cli];
          const lineasNecesarias =
            (orgEnPagina  ? 0 : 1) +
            (provEnPagina ? 0 : 1) +
            1 + maquinas.length;

          if (lineasActuales > 0 && lineasActuales + lineasNecesarias > appState.maxLineasPresentacion) {
            paginas.push(paginaActual);
            paginaActual   = [];
            lineasActuales = 0;
            orgEnPagina    = false;
            provEnPagina   = false;
          }

          if (!orgEnPagina)  { paginaActual.push({ tipo: "organismo", texto: org  }); lineasActuales++; orgEnPagina  = true; }
          if (!provEnPagina) { paginaActual.push({ tipo: "provincia", texto: prov }); lineasActuales++; provEnPagina = true; }

          paginaActual.push({ tipo: "cliente", texto: cli });
          lineasActuales++;
          maquinas.forEach(m => { paginaActual.push(m); lineasActuales++; });
        });
      });
    });

    if (paginaActual.length) paginas.push(paginaActual);
    return paginas.length ? paginas : [[]];
  }

  
// ---- Renderizar presentación ----

  // El punto de corte entre columnas solo puede ocurrir al final de un bloque de cliente
  
/**
 * @description Función renderPresentacion.
 * @returns {void|any}
 */
export function renderPresentacion() {
    if (!appState.paginasPresentacion.length || !appState.paginasPresentacion[0].length) {
      dom.presentacionLista.innerHTML = `<div style="grid-column:span 2;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:3vh;font-weight:600">No hay datos para presentar.</div>`;
      dom.paginacionInfo.textContent = "Sin datos";
      return;
    }

    const todosErrores = obtenerErroresActivos(appState.datosTabla);

    const ERR_POR_PAGINA = 8;
    const paginasErr = Math.ceil(todosErrores.length / ERR_POR_PAGINA) || 1;
    const errIdx     = appState.paginaPresentacionActual % paginasErr;
    const errPagina  = todosErrores.slice(errIdx * ERR_POR_PAGINA, (errIdx + 1) * ERR_POR_PAGINA);

    const pagina   = appState.paginasPresentacion[appState.paginaPresentacionActual];
    const midpoint = Math.ceil(pagina.length / 2);

    // Buscar el punto de corte más cercano al centro que respete los bloques de cliente
    let splitIdx  = pagina.length;
    let mejorDist = Infinity;
    for (let j = 0; j <= pagina.length; j++) {
      const esValido =
        j === 0 ||
        (pagina[j - 1]?.tipo === "maquina" &&
         (j >= pagina.length || pagina[j].tipo !== "maquina"));
      if (esValido) {
        const dist = Math.abs(j - midpoint);
        if (dist < mejorDist || (dist === mejorDist && j > splitIdx)) {
          mejorDist = dist;
          splitIdx  = j;
        }
      }
    }

    const col1    = pagina.slice(0, splitIdx);
    const col2    = pagina.slice(splitIdx);
    const errCol1 = errPagina.slice(0, 4);
    const errCol2 = errPagina.slice(4);

    const erroresHTML = todosErrores.length > 0 ? `
      <div class="presentacion-errores-footer">
        <div class="presentacion-errores-titulo">
          ERRORES ACTIVOS
        </div>
        <div class="presentacion-errores-columnas">
          <div class="presentacion-columna-errores">
            ${errCol1.map((e, i) => `<div class="presentacion-error-item clickable-error" data-erridx="${i}"><strong style="color:#f58a07">${escapeHtml(e.maquina.Descripcion)}:</strong> ${escapeHtml(e.log.Mensaje)}</div>`).join("")}
          </div>
          <div class="presentacion-columna-errores">
            ${errCol2.map((e, i) => `<div class="presentacion-error-item clickable-error" data-erridx="${i + 4}"><strong style="color:#f58a07">${escapeHtml(e.maquina.Descripcion)}:</strong> ${escapeHtml(e.log.Mensaje)}</div>`).join("")}
          </div>
        </div>
      </div>` : "";

    dom.presentacionLista.style.display = "grid";
    dom.presentacionLista.hidden = false;
    dom.presentacionLista.innerHTML = `
      <div class="presentacion-columna">${col1.map(renderItem).join("")}</div>
      <div class="presentacion-columna">${col2.map(renderItem).join("")}</div>
      ${erroresHTML}
    `;

    dom.paginacionInfo.textContent = `Página ${appState.paginaPresentacionActual + 1} de ${appState.paginasPresentacion.length}`;

    // Attach listeners to footer errors
    dom.presentacionLista.querySelectorAll(".clickable-error").forEach(item => {
      item.addEventListener("click", (e) => {
        abrirModalError(errPagina[e.currentTarget.dataset.erridx % ERR_POR_PAGINA]);
      });
    });
  }

  
/**
 * @description Función renderItem.
 * @param {any} item
 * @returns {void|any}
 */
function renderItem(item) {
    if (item.tipo === "organismo") return `<div class="linea-organismo">${escapeHtml(item.texto)}</div>`;
    if (item.tipo === "provincia") return `<div class="linea-provincia">${escapeHtml(item.texto)}</div>`;
    if (item.tipo === "cliente")   return `<div class="linea-cliente">${escapeHtml(item.texto)}</div>`;
    if (item.tipo === "maquina") {
      const colorMap = { "estado-verde": "#28a745", "estado-rojo": "#a10702", "estado-naranja": "#f58a07", "estado-gris": "#6e6e73" };
      const bg = colorMap[item.estado.clase] || "#6e6e73";
      return `<div class="linea-maquina" style="background:${bg}"><span class="maquina-badge">${escapeHtml(item.estado.texto)}</span>${escapeHtml(item.texto)}</div>`;
    }
    return "";
  }

  
// ---- Botón modo presentación ----

  dom.modoPresentacionBtn.addEventListener("click", async () => {
    if (appState.datosTabla.length === 0) {
      await fetchAndRenderData();
      if (appState.datosTabla.length === 0) return;
      iniciarActualizacionEstado();
    }
    try {
      appState.modoPresentacion = true;
      calcularMaxLineas();
      appState.paginasPresentacion = construirPaginasPresentacion(appState.datosTabla);
      appState.paginaPresentacionActual = 0;
      appState.estaPausado = false;
      dom.tabla.style.display = "none";
      dom.logsNormalSection.hidden = true;
      dom.tablaWrapper.style.display = "none";
      dom.presentacionLista.hidden = false;
      dom.modoPresentacionBtn.style.display = "none";
      dom.salirPresentacionBtn.style.display = "";
      renderPresentacion();
      await (dom.tablaSection.requestFullscreen?.() ?? dom.tablaSection.webkitRequestFullscreen?.call(dom.tablaSection));
    } catch (error) {
      console.error("No se pudo activar pantalla completa", error);
    }
  });

  dom.salirPresentacionBtn.addEventListener("click", () => salirModoPresentation());

  
/**
 * @description Función salirModoPresentation.
 * @returns {void|any}
 */
export function salirModoPresentation() {
    appState.modoPresentacion = false;
    appState.estaPausado = false;
    if (document.fullscreenElement) document.exitFullscreen();
    dom.presentacionLista.hidden = true;
    dom.tabla.style.display = "table";
    dom.tablaWrapper.style.display = "";
    dom.modoPresentacionBtn.style.display = "";
    dom.salirPresentacionBtn.style.display = "none";
    dom.presentacionLista.style.display = "none";
    dom.paginacionInfo.textContent = "";
    dom.indicadorReproduccion.style.display = "none";
    renderTabla();
    renderLogsNormal(appState.datosTabla);
  }
