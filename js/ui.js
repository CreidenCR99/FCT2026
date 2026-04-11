/**
 * Módulo: ui.js
 */
import { appState, INTERVALO_MS } from './state.js';
import * as dom from './dom.js';
import { getEstadoControl, esFalso } from './table.js';
import { fetchAndRenderData } from './api.js';
import { calcularMaxLineas, construirPaginasPresentacion, renderPresentacion, salirModoPresentation } from './presentation.js';

// ---- Skeleton ----

/**
 * @description Función mostrarSkeleton.
 * @returns {void|any}
 */
export function mostrarSkeleton() {
    dom.estadoTabla.innerHTML = `<div class="skeleton skeleton-text" style="width:200px;height:1em"></div>`;
    dom.kpiSection.innerHTML = Array(4).fill(0).map(() =>
      `<div class="kpi-card"><div class="skeleton skeleton-text" style="width:50px;height:2.4em;margin-bottom:10px"></div><div class="skeleton skeleton-text" style="width:100px"></div></div>`
    ).join("");
    dom.kpiSection.hidden = false;
  }

  
// ---- KPIs ----

  // [CAMBIO] log cuenta TODOS los errores de log de TODAS las máquinas (no solo monitorizadas)
  
/**
 * @description Función renderKPIs.
 * @param {any} data
 * @returns {void|any}
 */
export function renderKPIs(data) {
    const monitorizadas = data.filter(m => !esFalso(m.MonitorizarEstado));
    const total  = monitorizadas.length;
    const ok     = monitorizadas.filter(m => getEstadoControl(m).clase === "estado-verde").length;
    const alerta = monitorizadas.filter(m => getEstadoControl(m).clase === "estado-rojo").length;

    // Contar entradas de log fallidas de TODAS las máquinas del dataset completo
    const log = data
      .filter(m => esFalso(m.MonitorizarAlertas))
      .reduce((acc, m) => {
        const logsFallo = (m.Logs || []).filter(l => esFalso(l.ResultadoCorrecto));
        return acc + (logsFallo.length > 0 ? logsFallo.length : 1);
      }, 0);

    dom.kpiSection.innerHTML = `
      <div class="kpi-card" aria-label="${total} máquinas en total">
        <div class="kpi-value">${total}</div>
        <div class="kpi-label">Máquinas listadas</div>
      </div>
      <div class="kpi-card kpi-ok" aria-label="${ok} máquinas OK">
        <div class="kpi-value">${ok}</div>
        <div class="kpi-label">✓ OK</div>
      </div>
      <div class="kpi-card kpi-alerta" aria-label="${alerta} máquinas sin respuesta">
        <div class="kpi-value">${alerta}</div>
        <div class="kpi-label">! Sin respuesta</div>
      </div>
      <div class="kpi-card kpi-log" aria-label="${log} errores activos">
        <div class="kpi-value">${log}</div>
        <div class="kpi-label">Errores activos</div>
      </div>
    `;
    dom.kpiSection.hidden = false;
  }

  
// ---- Helpers de errores ----

  
/**
 * @description Función obtenerErroresActivos.
 * @param {any} data
 * @returns {void|any}
 */
export function obtenerErroresActivos(data) {
    const maquinasConErrores = data.filter(m => esFalso(m.MonitorizarAlertas));
    const errores = [];
    maquinasConErrores.forEach(m => {
      const logsFallo = (m.Logs || []).filter(log => esFalso(log.ResultadoCorrecto));
      if (logsFallo.length === 0) {
        errores.push({ maquina: m, log: { Mensaje: "Error desconocido", ID: null, ResultadoCorrecto: 0 } });
      } else {
        logsFallo.forEach(log => errores.push({ maquina: m, log: log }));
      }
    });
    return errores;
  }

  
/**
 * @description Función abrirModalError.
 * @param {any} errorObj
 * @returns {void|any}
 */
export function abrirModalError(errorObj) {
    document.getElementById("modalMaquinaDesc").textContent = errorObj.maquina.Descripcion;
    document.getElementById("modalMaquinaSN").textContent = errorObj.maquina.NumeroSerie;
    document.getElementById("modalOrganismo").textContent = errorObj.maquina.Organismo;
    document.getElementById("modalProvincia").textContent = errorObj.maquina.Provincia;
    document.getElementById("modalCliente").textContent = errorObj.maquina.Cliente;
    document.getElementById("modalErrorMsg").textContent = errorObj.log.Mensaje;
    document.getElementById("modalLogId").value = errorObj.log.ID || "";
    document.getElementById("modalEstadoError").value = errorObj.log.ResultadoCorrecto ?? 0;
    document.getElementById("modalObservaciones").value = errorObj.log.Observaciones || "";
    dom.modalLog.style.display = "";
  }

  
/**
 * @description Función renderLogsNormal.
 * @param {any} data
 * @returns {void|any}
 */
export function renderLogsNormal(data) {
    const errores = obtenerErroresActivos(data);
    if (errores.length === 0) {
      dom.logsNormalSection.hidden = true;
      return;
    }

    dom.logsNormalSection.innerHTML = `
      <div class="logs-normal-titulo">ERRORES ACTIVOS (${errores.length})</div>
      <div class="logs-normal-grid" id="logsGrid">
        ${errores.map((e, idx) => `
          <div class="log-item-clickable" data-idx="${idx}" title="Click para ver detalles y gestionar">
            <strong style="color:#f58a07">${escapeHtml(e.maquina.Descripcion)}:</strong> 
            ${escapeHtml(e.log.Mensaje)}
          </div>
        `).join("")}
      </div>
    `;
    dom.logsNormalSection.hidden = false;

    dom.logsNormalSection.querySelectorAll(".log-item-clickable").forEach(item => {
      item.addEventListener("click", () => {
        const idx = item.dataset.idx;
        const errorObj = errores[idx];
        document.getElementById("modalMaquinaDesc").textContent = errorObj.maquina.Descripcion;
        document.getElementById("modalMaquinaSN").textContent = errorObj.maquina.NumeroSerie;
        document.getElementById("modalOrganismo").textContent = errorObj.maquina.Organismo;
        document.getElementById("modalProvincia").textContent = errorObj.maquina.Provincia;
        document.getElementById("modalCliente").textContent = errorObj.maquina.Cliente;
        document.getElementById("modalErrorMsg").textContent = errorObj.log.Mensaje;
        document.getElementById("modalLogId").value = errorObj.log.ID || "";
        document.getElementById("modalEstadoError").value = errorObj.log.ResultadoCorrecto ?? 0;
        document.getElementById("modalObservaciones").value = errorObj.log.Observaciones || "";
        dom.modalLog.style.display = "";

      });
    });
  }

  
// ---- Barra de progreso ----

  
/**
 * @description Función iniciarProgressBar.
 * @returns {void|any}
 */
export function iniciarProgressBar() {
    if (!dom.progressBar) return;
    dom.progressBar.style.transition = "none";
    dom.progressBar.style.width = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      dom.progressBar.style.transition = `width ${INTERVALO_MS}ms linear`;
      dom.progressBar.style.width = "100%";
    }));
  }

  
/**
 * @description Función detenerProgressBar.
 * @returns {void|any}
 */
export function detenerProgressBar() {
    if (!dom.progressBar) return;
    dom.progressBar.style.transition = "none";
    dom.progressBar.style.width = "0%";
  }

  
// ---- Modal Logic ----

  dom.cerrarModalBtn.addEventListener("click", () => { dom.modalLog.style.display = "none"; });
  dom.cancelarEdicionBtn.addEventListener("click", () => { dom.modalLog.style.display = "none"; });
  window.addEventListener("click", e => { if (e.target === dom.modalLog) dom.modalLog.style.display = "none"; });

  
// ---- Lógica Volver Arriba ----

  window.addEventListener("scroll", () => {
    // Solo mostrar si no estamos en modo presentación y hemos bajado suficiente
    if (!appState.modoPresentacion && window.scrollY > 400) {
      dom.backToTopBtn.classList.add("visible");
    } else {
      dom.backToTopBtn.classList.remove("visible");
    }
  });

  dom.backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  dom.formEdicionLog.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(dom.formEdicionLog);
    const btnSubmit = dom.formEdicionLog.querySelector('button[type="submit"]');
    
    try {
      btnSubmit.disabled = true;
      const res = await fetch("datos.php?modo=actualizar_log", {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      if (result.success) {
        dom.modalLog.style.display = "";
        await fetchAndRenderData();
        alert("Estado de error actualizado correctamente.");
      } else {
        throw new Error(result.error || "Error desconocido al actualizar");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("No se pudo actualizar el log: " + error.message);
    } finally {
      btnSubmit.disabled = false;
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && appState.modoPresentacion) {
      salirModoPresentation();
    } else if (document.fullscreenElement && appState.modoPresentacion) {
      calcularMaxLineas();
      appState.paginasPresentacion = construirPaginasPresentacion(appState.datosTabla);
      renderPresentacion();
    }
  });

  
// ---- Escape HTML ----

  
/**
 * @description Función escapeHtml.
 * @param {any} texto
 * @returns {void|any}
 */
export function escapeHtml(texto) {
    return String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
