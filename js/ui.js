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
 * Muestra marcadores de posición (skeletons) en la interfaz mientras se cargan los datos.
 * Esto mejora la percepción de carga del usuario al mostrar una estructura visual previa.
 * @returns {void}
 */
export function mostrarSkeleton() {
    dom.estadoTabla.innerHTML = `<div class="skeleton skeleton-text" style="width:200px;height:1em"></div>`;
    dom.kpiSection.innerHTML = Array(4).fill(0).map(() =>
      `<div class="kpi-card"><div class="skeleton skeleton-text" style="width:50px;height:2.4em;margin-bottom:10px"></div><div class="skeleton skeleton-text" style="width:100px"></div></div>`
    ).join("");
    dom.kpiSection.hidden = false;
  }

  
// ---- KPIs ----
  
/**
 * Calcula y renderiza las tarjetas de indicadores clave (KPIs) basándose en los datos recibidos.
 * Filtra máquinas monitorizadas para contar totales, estados OK (Activos), Sin Respuesta y Errores Activos.
 * @param {Array<Object>} data - Arreglo de objetos de máquinas provenientes del backend.
 * @returns {void}
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

    const prev = appState.prevKpis;
    const current = { total, ok, alerta, log };

    /**
     * Genera el HTML para el indicador de tendencia (flecha y color).
     */
    const getTrend = (curr, old, type) => {
        if (curr === old) return "";
        const isInc = curr > old;
        let isGood = isInc;
        if (type === "alerta" || type === "log") isGood = !isInc;
        const color = isGood ? "var(--kpi-ok-color)" : "var(--kpi-alerta-color)";
        return `<span class="kpi-trend" style="color:${color}" aria-hidden="true">${isInc ? '▲' : '▼'}</span>`;
    };

    dom.kpiSection.innerHTML = `
      <div class="kpi-card" aria-label="${total} máquinas en total">
        <div class="kpi-row"><div id="kpi-total-val" class="kpi-value">${prev.total}</div>${getTrend(total, prev.total, "total")}</div>
        <div class="kpi-label">≕ Máquinas listadas</div>
      </div>
      <div class="kpi-card kpi-ok" aria-label="${ok} máquinas activas">
        <div class="kpi-row"><div id="kpi-ok-val" class="kpi-value">${prev.ok}</div>${getTrend(ok, prev.ok, "ok")}</div>
        <div class="kpi-label">✓ Activas</div>
      </div>
      <div class="kpi-card kpi-alerta" aria-label="${alerta} máquinas sin respuesta">
        <div class="kpi-row"><div id="kpi-alerta-val" class="kpi-value">${prev.alerta}</div>${getTrend(alerta, prev.alerta, "alerta")}</div>
        <div class="kpi-label">! Sin respuesta</div>
      </div>
      <div class="kpi-card kpi-log" aria-label="${log} errores activos">
        <div class="kpi-row"><div id="kpi-log-val" class="kpi-value">${prev.log}</div>${getTrend(log, prev.log, "log")}</div>
        <div class="kpi-label">⚠ Errores activos</div>
      </div>
    `;

    // Animamos cada número si ha cambiado respecto al valor anterior
    if (current.total !== prev.total) animateNumber("kpi-total-val", prev.total, current.total, "total");
    if (current.ok !== prev.ok) animateNumber("kpi-ok-val", prev.ok, current.ok, "ok");
    if (current.alerta !== prev.alerta) animateNumber("kpi-alerta-val", prev.alerta, current.alerta, "alerta");
    if (current.log !== prev.log) animateNumber("kpi-log-val", prev.log, current.log, "log");

    appState.prevKpis = current;
    dom.kpiSection.hidden = false;
  }

/**
 * Realiza una animación de conteo numérico en un elemento del DOM.
 * @param {string} id - ID del elemento que contiene el número.
 * @param {number} start - Valor inicial.
 * @param {number} end - Valor final.
 * @param {string} type - Tipo de KPI (total, ok, alerta, log) para determinar el color del flash.
 * @param {number} [duration] - Duración en ms. Si no se indica, se calcula dinámicamente según el delta.
 */
function animateNumber(id, start, end, type, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    if (duration === undefined) {
        const delta = Math.abs(end - start);
        // Duración proporcional: 250ms para delta=1 hasta 4000ms para delta >= 150
        duration = delta <= 1 ? 250 : Math.min(4000, Math.round(250 + (delta - 1) * (3900 / 149)));
    }

    const card = obj.closest('.kpi-card');
    
    // Determinamos si el cambio es positivo o negativo para el negocio
    let isGoodChange = end > start;
    if (type === "alerta" || type === "log") isGoodChange = end < start;

    // Aplicamos la animación de fondo y pulso
    if (card) {
        card.classList.remove("kpi-animate-up", "kpi-animate-down");
        void card.offsetWidth; // Trigger reflow
        card.classList.add(isGoodChange ? "kpi-animate-up" : "kpi-animate-down");
    }

    obj.classList.remove("kpi-pulse");
    void obj.offsetWidth;
    obj.classList.add("kpi-pulse");
    
    let startTimestamp = null;
    
    // Función de easing: easeOutCubic
    const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Aplicamos easing al progreso
        const easedProgress = easeOutCubic(progress);
        const currentVal = Math.floor(easedProgress * (end - start) + start);
        
        obj.innerHTML = currentVal;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
            // Quitamos la clase de pulso tras un breve periodo
            setTimeout(() => obj.classList.remove("kpi-pulse"), 500);
        }
    };
    window.requestAnimationFrame(step);
}

  
// ---- Helpers de errores ----

  
/**
 * Extrae la lista de errores que requieren atención técnica.
 * Identifica máquinas con 'MonitorizarAlertas' desactivado y recolecta sus logs fallidos.
 * Si una máquina tiene alerta pero no tiene logs, genera un objeto de error "desconocido".
 * @param {Array<Object>} data - El dataset completo de máquinas.
 * @returns {Array<Object>} Lista de objetos con la estructura { maquina, log }.
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
 * Configura y muestra el modal de gestión de errores.
 * Detecta si es un registro nuevo o la edición de uno existente basándose en la presencia de ID de log.
 * Inicializa los campos de fecha, hora y visibilidad de inputs según el contexto.
 * @param {Object} errorObj - Objeto que contiene los datos de la máquina y el log específico.
 * @returns {void}
 */

export function cerrarModal() {
    dom.modalLog.style.display = "none";
    // Reactivamos el scroll
    document.body.style.overflow = "";
    // Si estamos en fullscreen, asegurar que el contenedor de la tabla tampoco bloquee
    if (document.fullscreenElement) dom.tablaSection.style.overflow = "";
}

export function abrirModalError(errorObj) {
    // Asegurar ubicación del modal para correcto centrado y visibilidad
    if (document.fullscreenElement) {
        if (dom.modalLog.parentElement !== dom.tablaSection) dom.tablaSection.appendChild(dom.modalLog);
    } else {
        if (dom.modalLog.parentElement !== document.body) document.body.appendChild(dom.modalLog);
    }

    // Bloquear scroll del body
    document.body.style.overflow = "hidden";
    if (document.fullscreenElement) dom.tablaSection.style.overflow = "hidden";

    const isNew = !errorObj.log.ID;
    document.getElementById("modalTitle").textContent = isNew ? "Registrar Nuevo Error" : "Detalles del Error";
    
    document.getElementById("modalMaquinaDesc").textContent = errorObj.maquina.Descripcion;
    document.getElementById("modalMaquinaSN").textContent = errorObj.maquina.NumeroSerie;
    document.getElementById("modalMaquinaNS_hidden").value = errorObj.maquina.NumeroSerie;
    document.getElementById("modalOrganismo").textContent = errorObj.maquina.Organismo;
    document.getElementById("modalProvincia").textContent = errorObj.maquina.Provincia;
    document.getElementById("modalCliente").textContent = errorObj.maquina.Cliente;

    const msgInput = document.getElementById("modalMensajeInput");
    const msgStatic = document.getElementById("modalErrorMsg");
    const fechaHoraCont = document.getElementById("containerFechaHora");
    const msgCont = document.getElementById("containerMensaje");

    if (isNew) {
        msgStatic.parentElement.style.display = "none";
        msgCont.style.display = "";
        fechaHoraCont.style.display = "";
        msgInput.required = true;
        document.getElementById("modalFecha").required = true;
        document.getElementById("modalHora").required = true;
        
        const now = new Date();
        document.getElementById("modalFecha").value = now.toLocaleDateString('en-CA');
        document.getElementById("modalHora").value = now.toTimeString().slice(0,5);
        msgInput.value = "";
    } else {
        msgStatic.parentElement.style.display = "";
        msgCont.style.display = "none";
        fechaHoraCont.style.display = "none";
        msgInput.required = false;
        document.getElementById("modalFecha").required = false;
        document.getElementById("modalHora").required = false;
        msgStatic.textContent = errorObj.log.Mensaje;
    }

    document.getElementById("modalLogId").value = errorObj.log.ID || "";
    document.getElementById("modalEstadoError").value = errorObj.log.ResultadoCorrecto ?? 0;
    document.getElementById("modalObservaciones").value = errorObj.log.Observaciones || "";
    dom.modalLog.style.display = "flex";
  }

  
/**
 * Renderiza la sección de "Errores Activos" en la vista normal de la aplicación.
 * Crea una cuadrícula de elementos clicables que permiten abrir el modal de gestión.
 * Si no hay errores, oculta la sección.
 * @param {Array<Object>} data - Dataset de máquinas.
 * @returns {void}
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
        abrirModalError(errorObj);

      });
    });
  }

  
// ---- Barra de progreso ----

  
/**
 * Inicia la animación de la barra de progreso que indica el tiempo restante para el siguiente refresco automático.
 * Utiliza transiciones CSS calculadas dinámicamente según INTERVALO_MS.
 * @returns {void}
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
 * Detiene y resetea la barra de progreso a su estado inicial.
 * @returns {void}
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
    // Mostrar logo y botón volver arriba si no estamos en modo presentación y hemos bajado suficiente
    const show = !appState.modoPresentacion && window.scrollY > 200;
    if (show) {
      dom.backToTopBtn.classList.add("visible");
      dom.floatingLogo.classList.add("visible");
    } else {
      dom.backToTopBtn.classList.remove("visible");
      dom.floatingLogo.classList.remove("visible");
    }
  });

  dom.backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  dom.floatingLogo.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  dom.formEdicionLog.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(dom.formEdicionLog);
    const idLog = formData.get("id_log");
    const modo = idLog ? "actualizar_log" : "crear_log";
    
    if (modo === "crear_log") {
      const fechaRaw = document.getElementById("modalFecha").value;
      const horaRaw = document.getElementById("modalHora").value;
      
      const fechaSeleccionada = new Date(`${fechaRaw}T${horaRaw}`);
      if (fechaSeleccionada > new Date()) {
        alert("No es posible registrar un error con una fecha u hora futura.");
        return;
      }

      formData.set("fecha", fechaRaw.replace(/-/g, ""));
      formData.set("hora", horaRaw);
    }

    const btnSubmit = dom.formEdicionLog.querySelector('button[type="submit"]');
    
    try {
      btnSubmit.disabled = true;
      const res = await fetch(`datos.php?modo=${modo}`, {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      if (result.success) {
        await fetchAndRenderData();
        alert("Estado de error actualizado correctamente.");
        cerrarModal();
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
    // Gestionar la ubicación del modal según el modo para mantener el centrado (body) o visibilidad (fullscreen)
    if (document.fullscreenElement) {
      if (dom.modalLog.parentElement !== dom.tablaSection) dom.tablaSection.appendChild(dom.modalLog);
    } else {
      if (dom.modalLog.parentElement !== document.body) document.body.appendChild(dom.modalLog);
      // Fallback: Si salimos de fullscreen (p.ej. por ESC del navegador), cerramos el modal para limpiar la vista
      cerrarModal();
    }

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
 * Sanitiza una cadena de texto para prevenir ataques de Cross-Site Scripting (XSS).
 * @param {string|number} texto - El texto a sanitizar.
 * @returns {string} Texto con caracteres especiales convertidos a entidades HTML.
 */
export function escapeHtml(texto) {
    return String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
