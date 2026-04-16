/**
 * Módulo: ui.js
 */
import { appState, INTERVALO_MS } from './state.js';
import * as dom from './dom.js';
import { getEstadoControl, esFalso, getClaseConexion, parseUltimoControl } from './table.js';
import { fetchAndRenderData, cargarErrores } from './api.js';
import { calcularMaxLineas, construirPaginasPresentacion, renderPresentacion, salirModoPresentation } from './presentation.js';

// ---- Skeleton ----

/**
 * Muestra marcadores de posición (skeletons) en la interfaz mientras se cargan los datos.
 * Esto mejora la percepción de carga del usuario al mostrar una estructura visual previa.
 * @returns {void}
 */
export function mostrarSkeleton() {
    dom.estadoTabla.innerHTML = `<div class="skeleton skeleton-text" style="width:10vw;height:1.6vh"></div>`;
    dom.kpiSection.innerHTML = Array(4).fill(0).map(() =>
      `<div class="kpi-card"><div class="skeleton skeleton-text" style="width:5vw;height:4vh;margin-bottom:1vh"></div><div class="skeleton skeleton-text" style="width:10vw"></div></div>`
    ).join("");
    dom.kpiSection.hidden = false;
  }

  
// ---- KPIs ----

/**
 * Elimina visualmente los indicadores de tendencia (flechas) de los KPIs.
 * Se invoca cuando los datos no han cambiado en el último ciclo de actualización.
 * @returns {void}
 */
export function limpiarTrends() {
    const trends = dom.kpiSection.querySelectorAll('.kpi-trend');
    trends.forEach(trend => {
        if (trend.dataset.exiting) return;
        trend.dataset.exiting = "true";
        
        // Aplicamos la animación de salida definida en style.css
        trend.style.animation = "trendExit 0.2s ease-in forwards";
        // Eliminamos físicamente del DOM tras la animación para mantenerlo limpio
        setTimeout(() => trend.remove(), 200);
    });
}
  
/**
 * Calcula y renderiza las tarjetas de indicadores clave (KPIs) basándose en los datos recibidos.
 * Filtra máquinas monitorizadas para contar totales, estados OK (Activos), Sin Respuesta y Errores Activos.
 * @param {Array<Object>} data - Arreglo de objetos de máquinas provenientes del backend.
 * @returns {void}
 */
export function renderKPIs(data) {
    let total = 0, ok = 0, alerta = 0, log = 0;

    for (let i = 0; i < data.length; i++) {
        const m = data[i];
        if (!esFalso(m.MonitorizarEstado)) {
            total++;
            const claseCon = getClaseConexion(m);
            if (claseCon === "estado-verde") ok++;
            else if (claseCon === "estado-rojo") alerta++;
        }
        
        if (!esFalso(m.MonitorizarAlertas)) {
            const logsActivos = (m.Logs || []).filter(l => !esFalso(l.Activo)).length;
            log += logsActivos;
        }
    }

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

    const newHTML = `
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

    // Usamos morphdom para que los elementos que no cambian (como las flechas de tendencia
    // que están en medio de una animación) no sean destruidos.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHTML;
    morphdom(dom.kpiSection, tempDiv, { childrenOnly: true });

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
    const maquinasConMonitorActivo = data.filter(m => !esFalso(m.MonitorizarAlertas));
    const errores = [];
    maquinasConMonitorActivo.forEach(m => {
      const logsFallo = (m.Logs || []).filter(log => !esFalso(log.Activo));
      if (logsFallo.length === 0) {
        // Si tiene el monitor activo pero no hay logs, no mostramos error por defecto
        // (Opcional: podrías añadir un mensaje de "Sin logs" si prefieres)
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
    appState.currentModalData = null;
    document.body.style.overflow = "";
    // Limpiar validaciones visuales
    dom.formEdicionLog.querySelectorAll('.touched').forEach(el => el.classList.remove('touched'));
    // Si estamos en fullscreen, asegurar que el contenedor de la tabla tampoco bloquee
    if (document.fullscreenElement) dom.tablaSection.style.overflow = "";
}

/**
 * Actualiza el contenido del modal basándose en el log seleccionado en appState.currentModalLogIndex
 */
function renderContenidoModal() {
    const log = appState.currentModalLogs[appState.currentModalLogIndex];
    const machine = appState.datosTabla.find(m => m.NumeroSerie === appState.currentModalData.numeroSerie);
    
    if (!log || !machine) return;

    const isNew = !log.ID;
    document.getElementById("modalTitle").textContent = isNew ? "Registrar Nuevo Error" : "Detalles del Error";
    
    // Visibilidad y lógica de navegación unificada
    const navCont = document.getElementById("modalLogNav");
    const countEl = document.getElementById("modalLogCount");
    if (navCont && countEl) {
        const numErrores = appState.currentModalLogs.length;
        navCont.style.display = numErrores > 1 ? "flex" : "none";
        countEl.textContent = `${appState.currentModalLogIndex + 1} / ${numErrores}`;
    }

    document.getElementById("modalMaquinaDesc").textContent = machine.Descripcion;
    document.getElementById("modalMaquinaSN").textContent = machine.NumeroSerie;
    document.getElementById("modalMaquinaNS_hidden").value = machine.NumeroSerie;
    document.getElementById("modalOrganismo").textContent = machine.Organismo;
    document.getElementById("modalProvincia").textContent = machine.Provincia;
    document.getElementById("modalCliente").textContent = machine.Cliente;
    
    actualizarDatosModal(); // Cargar datos dinámicos (Última conexión)

    const msgSelect = document.getElementById("modalCodigoErrorSelect");
    const msgStatic = document.getElementById("modalErrorMsg");
    const fechaHoraCont = document.getElementById("containerFechaHora");
    const msgCont = document.getElementById("containerMensaje");

    if (isNew) {
        msgStatic.parentElement.style.display = "none";
        msgCont.style.display = "";
        fechaHoraCont.style.display = "";
        msgSelect.style.display = "";
        msgSelect.required = true;
        document.getElementById("modalFecha").required = true;
        document.getElementById("modalHora").required = true;
        
        const now = new Date();
        document.getElementById("modalFecha").value = now.toLocaleDateString('en-CA');
        document.getElementById("modalHora").value = now.toTimeString().slice(0,5);
        msgSelect.value = "";
    } else {
        msgStatic.parentElement.style.display = "";
        msgCont.style.display = "none";
        fechaHoraCont.style.display = "none";
        msgSelect.style.display = "none";
        
        // Desactivamos la validación obligatoria cuando los campos están ocultos 
        // para evitar el error de "form control is not focusable" del navegador.
        msgSelect.required = false;
        document.getElementById("modalFecha").required = false;
        document.getElementById("modalHora").required = false;
        
        msgStatic.textContent = log.Mensaje;

        if (log.TimeStamp && String(log.TimeStamp).length >= 12) {
            const ts = String(log.TimeStamp);
            document.getElementById("modalFecha").value = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
            document.getElementById("modalHora").value = `${ts.slice(8, 10)}:${ts.slice(10, 12)}`;
        }
    }

    // Mostrar información adicional del error en el modal
    const elCodigo = document.getElementById("modalCodigoError");
    if (elCodigo) elCodigo.textContent = isNew ? "-" : (log.CodigoError || "-");
    const elTipo = document.getElementById("modalTipoMaquina");
    if (elTipo) elTipo.textContent = machine.TipoMaquina || log.TipoMaquina || "-";
    const elTS = document.getElementById("modalFechaHora");
    if (elTS) elTS.textContent = isNew ? "-" : formatTimeStamp(log.TimeStamp);

    document.getElementById("modalLogId").value = log.ID || "";
    document.getElementById("modalTipoMaquina_hidden").value = machine.TipoMaquina || "";
    document.getElementById("modalEstadoError").checked = !esFalso(log.Activo);
    document.getElementById("modalObservaciones").value = log.Observaciones || "";

    // Actualizar estado del botón enviar
    updateErrorSubmitBtnState();
}

export function abrirModalError(errorObj) {
    // Asegurar ubicación del modal para correcto centrado y visibilidad
    if (document.fullscreenElement) {
        if (dom.modalLog.parentElement !== dom.tablaSection) dom.tablaSection.appendChild(dom.modalLog);
    } else {
        if (dom.modalLog.parentElement !== document.body) document.body.appendChild(dom.modalLog);
    }

    // Guardamos referencia para actualizaciones en tiempo real
    appState.currentModalData = { numeroSerie: errorObj.maquina.NumeroSerie, logId: errorObj.log.ID };

    // Preparar lista de errores para navegación (solo errores activos de esta máquina)
    const activeLogs = (errorObj.maquina.Logs || []).filter(l => !esFalso(l.Activo));
    // Si el log que abrimos es histórico (no activo) o nuevo, lo incluimos en la lista temporal
    if (errorObj.log.ID && !activeLogs.some(l => l.ID === errorObj.log.ID)) {
        activeLogs.unshift(errorObj.log);
    }
    appState.currentModalLogs = activeLogs.length > 0 ? activeLogs : [errorObj.log];
    appState.currentModalLogIndex = appState.currentModalLogs.findIndex(l => l.ID === errorObj.log.ID);
    if (appState.currentModalLogIndex === -1) appState.currentModalLogIndex = 0;

    // Cargar catálogo de errores si el selector está vacío (primer uso)
    const msgSelect = document.getElementById("modalCodigoErrorSelect");
    if (msgSelect && msgSelect.options.length <= 1) {
        cargarErrores();
    }

    // Bloquear scroll del body
    document.body.style.overflow = "hidden";
    if (document.fullscreenElement) dom.tablaSection.style.overflow = "hidden";

    renderContenidoModal();
    dom.modalLog.style.display = "flex";
  }

/**
 * Actualiza los campos dinámicos del modal (como la última conexión)
 * buscando los datos más recientes en el estado global.
 */
export function actualizarDatosModal() {
    if (!appState.currentModalData) return;
    
    const machine = appState.datosTabla.find(m => m.NumeroSerie === appState.currentModalData.numeroSerie);
    if (!machine) return;

    const elUC = document.getElementById("modalUltimaConexion");
    if (elUC) {
        const ts = machine.UltimoControl;
        if (!ts || String(ts).length < 12) elUC.textContent = ts || "-";
        else {
            const s = String(ts);
            elUC.textContent = `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
        }
    }
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

    const isMinimized = appState.erroresMinimizados;

    const logsHTML = `
      <div class="logs-normal-titulo" id="toggleErroresHeader" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;">
        <span>ERRORES ACTIVOS</span>
        <span class="toggle-arrow ${isMinimized ? 'is-collapsed' : ''}">▼</span>
      </div>
      <div class="logs-expand-wrapper ${isMinimized ? 'is-minimized' : ''}">
        <div class="logs-normal-grid" id="logsGrid">
          ${errores.map((e, idx) => `
            <div class="log-item-clickable" data-idx="${idx}" title="Click para ver detalles y gestionar">
              <strong style="color:#f58a07">${escapeHtml(e.maquina.Descripcion)}:</strong> 
              ${escapeHtml(e.log.Mensaje)}
            </div>
          `).join("")}
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = logsHTML;
    morphdom(dom.logsNormalSection, tempDiv, { childrenOnly: true });

    dom.logsNormalSection.hidden = false;

    // Listener para minimizar/extender la sección
    const toggleHeader = dom.logsNormalSection.querySelector("#toggleErroresHeader");
    if (toggleHeader) {
      toggleHeader.onclick = () => {
        appState.erroresMinimizados = !appState.erroresMinimizados;
        renderLogsNormal(data);
      };
    }

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

  dom.cerrarModalBtn.addEventListener("click", () => { cerrarModal(); });
  dom.cancelarEdicionBtn.addEventListener("click", () => { cerrarModal(); });
  window.addEventListener("click", e => { if (e.target === dom.modalLog) cerrarModal(); });

  /**
   * Actualiza el estado del botón Enviar según la validez del formulario de logs.
   */
  function updateErrorSubmitBtnState() {
    const submitBtn = dom.formEdicionLog.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    const isInvalid = !dom.formEdicionLog.checkValidity();
    submitBtn.disabled = isInvalid;

    if (isInvalid) {
        const missing = [];
        dom.formEdicionLog.querySelectorAll('[required]').forEach(el => {
            if (!el.checkValidity()) {
                const labelText = el.closest('.form-control')?.querySelector('label')?.innerText.replace('*', '').trim();
                if (labelText) missing.push(labelText);
            }
        });
        submitBtn.title = "Faltan campos obligatorios: " + missing.join(", ");
    } else {
        submitBtn.title = "Enviar reporte de error";
    }
  }

  dom.formEdicionLog.addEventListener("input", (e) => {
    e.target.classList.add('touched');
    updateErrorSubmitBtnState();
  });

  
  // Navegación de errores unificada (estilo Maestro)
  document.getElementById("modalLogBtnFirst")?.addEventListener("click", () => {
    appState.currentModalLogIndex = 0;
    appState.currentModalData.logId = appState.currentModalLogs[0].ID;
    renderContenidoModal();
  });
  document.getElementById("modalLogBtnPrev")?.addEventListener("click", () => {
    if (appState.currentModalLogIndex > 0) {
        appState.currentModalLogIndex--;
        appState.currentModalData.logId = appState.currentModalLogs[appState.currentModalLogIndex].ID;
        renderContenidoModal();
    }
  });
  document.getElementById("modalLogBtnNext")?.addEventListener("click", () => {
    if (appState.currentModalLogIndex < appState.currentModalLogs.length - 1) {
        appState.currentModalLogIndex++;
        appState.currentModalData.logId = appState.currentModalLogs[appState.currentModalLogIndex].ID;
        renderContenidoModal();
    }
  });
  document.getElementById("modalLogBtnLast")?.addEventListener("click", () => {
    appState.currentModalLogIndex = appState.currentModalLogs.length - 1;
    appState.currentModalData.logId = appState.currentModalLogs[appState.currentModalLogIndex].ID;
    renderContenidoModal();
  });

  // Atajos de teclado para navegación en el modal de logs
  document.addEventListener("keydown", (e) => {
    if (dom.modalLog.style.display === "flex") {
        if (e.key === "ArrowLeft" || e.key === "PageUp") {
            document.getElementById("modalLogBtnPrev")?.click();
        } else if (e.key === "ArrowRight" || e.key === "PageDown") {
            document.getElementById("modalLogBtnNext")?.click();
        } else if (e.key === "ArrowUp" || e.key === "Home") {
            document.getElementById("modalLogBtnFirst")?.click();
        } else if (e.key === "ArrowDown" || e.key === "End") {
            document.getElementById("modalLogBtnLast")?.click();
        }
    }
  });

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

    dom.formEdicionLog.classList.add('form-invalid');
    if (!dom.formEdicionLog.checkValidity()) {
        Swal.fire("Atención", "Por favor, rellene todos los campos obligatorios marcados con *", "warning");
        return;
    }

    const formData = new FormData(dom.formEdicionLog);
    const idLog = formData.get("id_log");
    const modo = idLog ? "actualizar_log" : "crear_log";
    
    const fechaRaw = document.getElementById("modalFecha").value;
    const horaRaw = document.getElementById("modalHora").value;
    
    const fechaSeleccionada = new Date(`${fechaRaw}T${horaRaw}`);
    if (fechaSeleccionada > new Date()) {
      Swal.fire('Error', "No es posible registrar un cambio con una fecha u hora futura.", 'error');
      return;
    }

    formData.set("fecha", fechaRaw.replace(/-/g, ""));
    formData.set("hora", horaRaw);

    const isActivo = document.getElementById("modalEstadoError").checked;
    formData.set("resultado", isActivo ? "0" : "1");

    // Procesamiento automático de observaciones con timestamp [DD/MM/YYYY, HH:MM]
    const log = appState.currentModalLogs[appState.currentModalLogIndex];
    const originalObs = (log.Observaciones || "").trim();
    let finalObs = document.getElementById("modalObservaciones").value.trim();

    if (finalObs !== originalObs && finalObs !== "") {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const h = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const prefix = `[${d}/${mo}/${y}, ${h}:${mi}] `;

        if (originalObs === "") {
            finalObs = prefix + finalObs;
        } else if (finalObs.startsWith(originalObs)) {
            const newPart = finalObs.substring(originalObs.length).trim();
            if (newPart) finalObs = originalObs + "\n" + prefix + newPart;
        } else {
            finalObs = prefix + finalObs;
        }
        formData.set("observaciones", finalObs);
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
        appState.lastDataHash = "";
        await fetchAndRenderData();
        Swal.fire({
          title: '¡Actualizado!',
          text: 'El estado del error se ha guardado correctamente.',
          icon: 'success',
          confirmButtonColor: 'var(--primary)',
          timer: 2000
        });
        cerrarModal();
      } else {
        throw new Error(result.error || "Error desconocido al actualizar");
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.fire('Error', error.message, 'error');
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
 * Formatea un TimeStamp YYYYMMDDHHMMSS para mostrar en la UI.
 * @param {string|number} ts - Timestamp de 14 dígitos.
 * @returns {string} Fecha formateada DD/MM/YYYY HH:MM:SS.
 */
function formatTimeStamp(ts) {
    if (!ts || String(ts).length < 14) return ts || "-";
    const s = String(ts);
    return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}
  
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
