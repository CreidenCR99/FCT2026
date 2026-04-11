document.addEventListener("DOMContentLoaded", () => {
  // --- Elementos del DOM ---
  const form                 = document.getElementById("form");
  const selectOrganismo      = document.getElementById("organismo");
  const selectProvincia      = document.getElementById("provincia");
  const tablaSection         = document.getElementById("tablaSection");
  const tabla                = document.getElementById("tablaDatos");
  const tablaWrapper         = document.getElementById("tablaWrapper");
  const thead                = tabla.querySelector("thead");
  const tbody                = tabla.querySelector("tbody");
  const estadoTabla          = document.getElementById("estadoTabla");
  const paginacionInfo       = document.getElementById("paginacionInfo");
  const modoPresentacionBtn  = document.getElementById("modoPresentacionBtn");
  const limpiarFiltrosBtn    = document.getElementById("limpiarFiltrosBtn");
  const salirPresentacionBtn = document.getElementById("salirPresentacionBtn");
  const presentacionLista    = document.getElementById("presentacionLista");
  const indicadorReproduccion= document.getElementById("indicadorReproduccion");
  const searchInput          = document.getElementById("searchInput");
  const exportCsvBtn         = document.getElementById("exportCsvBtn");
  const kpiSection           = document.getElementById("kpiSection");
  const progressBar          = document.getElementById("progressBar");
  const themeToggle          = document.getElementById("themeToggle");
  const logsNormalSection    = document.getElementById("logsNormalSection");
  const modalLog             = document.getElementById("modalLog");
  const formEdicionLog       = document.getElementById("formEdicionLog");
  const cancelarEdicionBtn   = document.getElementById("cancelarEdicionBtn");
  const cerrarModalBtn       = document.getElementById("cerrarModalBtn");
  const backToTopBtn         = document.getElementById("backToTop");

  // --- Constantes ---
  const INTERVALO_MS = 7500;
  let maxLineasPresentacion = 20;

  // --- Estado Global ---
  let datosTabla             = [];
  let columnasTabla          = [];
  let estadoInterval         = null;
  let modoPresentacion       = false;
  let paginasPresentacion    = [];
  let paginaPresentacionActual = 0;
  let estaPausado            = false;
  let filtroOrganismo        = "";
  let filtroProvincia        = "";
  let filtroTexto            = "";
  let currentController      = null;
  let prevEstados            = {};
  let sortCol                = null;
  let sortDir                = 1;

  // --- Modo oscuro ---
  const htmlEl = document.documentElement;
  let currentTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "dark" : "light";
  htmlEl.setAttribute("data-theme", currentTheme);
  updateThemeIcon();

  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", currentTheme);
    updateThemeIcon();
  });

  function updateThemeIcon() {
    themeToggle.innerHTML = currentTheme === "light"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    themeToggle.setAttribute("aria-label", `Cambiar a modo ${currentTheme === "light" ? "claro" : "oscuro"}`);
  }

  // --- visibilitychange ---
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      detenerActualizacionEstado();
    } else if (filtroOrganismo !== "" || filtroProvincia !== "") {
      iniciarActualizacionEstado();
    }
  });

  // --- Inicialización ---
  cargarOrganismos();
  cargarProvincias();

  async function cargarOrganismos() {
    try {
      const res = await fetch("datos.php?modo=organismos");
      const data = await res.json();
      selectOrganismo.innerHTML = `<option value="">Todos los organismos</option>`;
      data.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.Organismo;
        opt.textContent = item.Organismo;
        selectOrganismo.appendChild(opt);
      });
    } catch (e) {
      selectOrganismo.innerHTML = `<option value="">Error al cargar</option>`;
      console.error(e);
    }
  }

  async function cargarProvincias(organismo = "") {
    try {
      const res = await fetch(`datos.php?modo=provincias&organismo=${encodeURIComponent(organismo)}`);
      const data = await res.json();
      const valorActual = selectProvincia.value;
      selectProvincia.innerHTML = `<option value="">Todas las provincias</option>`;
      data.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.Provincia;
        opt.textContent = item.Provincia;
        selectProvincia.appendChild(opt);
      });
      if (data.some(item => item.Provincia === valorActual)) {
        selectProvincia.value = valorActual;
      }
    } catch (e) {
      selectProvincia.innerHTML = `<option value="">Error al cargar</option>`;
      console.error(e);
    }
  }

  selectOrganismo.addEventListener("change", () => { cargarProvincias(selectOrganismo.value); });

  limpiarFiltrosBtn.addEventListener("click", () => {
    selectOrganismo.value = "";
    selectProvincia.value = "";
    cargarProvincias("");
  });

  // --- Búsqueda en tabla ---
  searchInput.addEventListener("input", () => {
    filtroTexto = searchInput.value.trim().toLowerCase();
    if (datosTabla.length > 0) renderTabla();
  });

  // --- Exportar CSV ---
  exportCsvBtn.addEventListener("click", exportarCSV);

  // --- Submit ---
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    filtroOrganismo = selectOrganismo.value;
    filtroProvincia = selectProvincia.value;
    sortCol = null; sortDir = 1;
    filtroTexto = ""; searchInput.value = "";
    mostrarSkeleton();
    thead.innerHTML = ""; tbody.innerHTML = "";
    tabla.style.display = "none";
    logsNormalSection.hidden = true;
    presentacionLista.hidden = true;
    presentacionLista.innerHTML = "";
    columnasTabla = []; prevEstados = {};
    detenerActualizacionEstado();
    await fetchAndRenderData();
    iniciarActualizacionEstado();
  });

  // ---- Skeleton ----
  function mostrarSkeleton() {
    estadoTabla.innerHTML = `<div class="skeleton skeleton-text" style="width:200px;height:1em"></div>`;
    kpiSection.innerHTML = Array(4).fill(0).map(() =>
      `<div class="kpi-card"><div class="skeleton skeleton-text" style="width:50px;height:2.4em;margin-bottom:10px"></div><div class="skeleton skeleton-text" style="width:100px"></div></div>`
    ).join("");
    kpiSection.hidden = false;
  }

  // ---- KPIs ----
  // [CAMBIO] log cuenta TODOS los errores de log de TODAS las máquinas (no solo monitorizadas)
  function renderKPIs(data) {
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

    kpiSection.innerHTML = `
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
    kpiSection.hidden = false;
  }

  // ---- Calcular max líneas presentación ----
  function calcularMaxLineas() {
    const calculo = Math.floor(window.innerHeight / 54);
    maxLineasPresentacion = Math.min(36, Math.max(20, calculo));
  }

  // ---- Resize con debounce ----
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (modoPresentacion) {
        calcularMaxLineas();
        paginasPresentacion = construirPaginasPresentacion(datosTabla);
        if (paginaPresentacionActual >= paginasPresentacion.length) paginaPresentacionActual = 0;
        renderPresentacion();
      }
    }, 200);
  });

  // ---- Fetch + render ----
  async function fetchAndRenderData() {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    try {
      const res = await fetch(
        `datos.php?modo=maquinas&organismo=${encodeURIComponent(filtroOrganismo)}&provincia=${encodeURIComponent(filtroProvincia)}`,
        { signal: currentController.signal }
      );
      const data = await res.json();

      const nuevosEstados = {};
      data.forEach(m => { nuevosEstados[m.NumeroSerie] = getEstadoControl(m).clase; });
      const maquinasCambiadas = new Set();
      if (Object.keys(prevEstados).length > 0) {
        data.forEach(m => {
          if (prevEstados[m.NumeroSerie] && prevEstados[m.NumeroSerie] !== nuevosEstados[m.NumeroSerie]) {
            maquinasCambiadas.add(m.NumeroSerie);
          }
        });
      }
      prevEstados = nuevosEstados;
      datosTabla = data;

      if (data.length > 0 && columnasTabla.length === 0) {
        columnasTabla = Object.keys(data[0]).filter(col =>
          col !== "UltimoControl" && col !== "MonitorizarEstado" &&
          col !== "NumeroSerie" && col !== "MonitorizarAlertas" && col !== "Logs"
        );
      } else if (data.length === 0) {
        columnasTabla = [];
      }

      renderKPIs(data);
      
      if (!modoPresentacion) {
        renderLogsNormal(data);
      }

      if (modoPresentacion) {
        calcularMaxLineas();
        paginasPresentacion = construirPaginasPresentacion(data);
        if (paginaPresentacionActual >= paginasPresentacion.length) paginaPresentacionActual = 0;
        renderPresentacion();
      } else {
        renderTabla(maquinasCambiadas);
        tabla.style.display = "table";
      }

      let msg = `${data.length} máquina${data.length !== 1 ? "s" : ""} total${data.length !== 1 ? "es" : ""}`;
      if (filtroOrganismo && filtroProvincia) msg += ` — "${filtroOrganismo}" en "${filtroProvincia}"`;
      else if (filtroOrganismo) msg += ` — "${filtroOrganismo}"`;
      else if (filtroProvincia) msg += ` — "${filtroProvincia}"`;
      estadoTabla.textContent = msg;

    } catch (error) {
      if (error.name === "AbortError") return;
      estadoTabla.textContent = "Error al cargar los datos.";
      console.error("Error al actualizar datos:", error);
    }
  }

  // ---- Helpers de errores ----
  function obtenerErroresActivos(data) {
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

  function abrirModalError(errorObj) {
    document.getElementById("modalMaquinaDesc").textContent = errorObj.maquina.Descripcion;
    document.getElementById("modalMaquinaSN").textContent = errorObj.maquina.NumeroSerie;
    document.getElementById("modalOrganismo").textContent = errorObj.maquina.Organismo;
    document.getElementById("modalProvincia").textContent = errorObj.maquina.Provincia;
    document.getElementById("modalCliente").textContent = errorObj.maquina.Cliente;
    document.getElementById("modalErrorMsg").textContent = errorObj.log.Mensaje;
    document.getElementById("modalLogId").value = errorObj.log.ID || "";
    document.getElementById("modalEstadoError").value = errorObj.log.ResultadoCorrecto ?? 0;
    document.getElementById("modalObservaciones").value = errorObj.log.Observaciones || "";
    modalLog.style.display = "";
  }

  function renderLogsNormal(data) {
    const errores = obtenerErroresActivos(data);
    if (errores.length === 0) {
      logsNormalSection.hidden = true;
      return;
    }

    logsNormalSection.innerHTML = `
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
    logsNormalSection.hidden = false;

    logsNormalSection.querySelectorAll(".log-item-clickable").forEach(item => {
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
        modalLog.style.display = "";

      });
    });
  }

  // ---- Parseo fecha ----
  function parseUltimoControl(valor) {
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

  function getEstadoControl(fila) {
    if (esFalso(fila.MonitorizarAlertas)) return { texto: "LOG", clase: "estado-naranja" };
    const fechaControl = parseUltimoControl(fila.UltimoControl);
    if (!fechaControl || Number.isNaN(fechaControl.getTime())) return { texto: "?", clase: "estado-gris" };
    if ((new Date() - fechaControl) / 60000 < 10) return { texto: "OK", clase: "estado-verde" };
    return { texto: "!", clase: "estado-rojo" };
  }

  function esFalso(valor) {
    if (valor === null || typeof valor === "undefined") return true;
    if (typeof valor === "boolean") return !valor;
    const v = String(valor).trim().toLowerCase();
    return v === "0" || v === "false" || v === "null" || v === "undefined" || v === "";
  }

  function getTooltipEstado(fila) {
    const fecha = parseUltimoControl(fila.UltimoControl);
    if (!fecha) return "Sin fecha de control";
    const pad = n => String(n).padStart(2, "0");
    return `Último control: ${pad(fecha.getDate())}/${pad(fecha.getMonth()+1)}/${fecha.getFullYear()} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
  }

  // ---- Renderizar tabla ----
  // [CAMBIO] Sin orden de prioridad por estado — se mantiene el orden original del servidor
  function renderTabla(maquinasCambiadas = new Set()) {
    let datosFiltrados = datosTabla.filter(f => !esFalso(f.MonitorizarEstado));

    if (filtroTexto) {
      datosFiltrados = datosFiltrados.filter(f =>
        columnasTabla.some(col => String(f[col] ?? "").toLowerCase().includes(filtroTexto))
      );
    }

    // Orden por columna activa (sin prioridad automática por estado)
    if (sortCol !== null) {
      datosFiltrados = [...datosFiltrados].sort((a, b) => {
        const va = String(a[sortCol] ?? "").toLowerCase();
        const vb = String(b[sortCol] ?? "").toLowerCase();
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      });
    }

    if (!datosFiltrados.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:1rem">${
        filtroTexto ? `Sin resultados para <strong>${filtroTexto}</strong>` : "Sin datos para mostrar"
      }</td></tr>`;
      return;
    }

    thead.innerHTML = `
      <tr role="row">
        ${columnasTabla.map(col => {
          const isActive = sortCol === col;
          const arrow = isActive ? (sortDir === 1 ? " ↑" : " ↓") : "";
          return `<th scope="col" data-col="${col}" class="th-sortable${isActive ? " th-active" : ""}" tabindex="0"
            aria-sort="${isActive ? (sortDir === 1 ? "ascending" : "descending") : "none"}"
            title="Ordenar por ${col}">${col}${arrow}</th>`;
        }).join("")}
        <th scope="col">Estado</th>
      </tr>
    `;

    thead.querySelectorAll(".th-sortable").forEach(th => {
      th.addEventListener("click", () => onSortClick(th.dataset.col));
      th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSortClick(th.dataset.col); } });
    });

    tbody.innerHTML = "";
    datosFiltrados.forEach(fila => {
      const estado  = getEstadoControl(fila);
      const tooltip = getTooltipEstado(fila);
      const tr = document.createElement("tr");
      if (maquinasCambiadas.has(fila.NumeroSerie)) tr.classList.add("fila-cambiada");
      tr.innerHTML = `
        ${columnasTabla.map(col => `<td>${fila[col] ?? ""}</td>`).join("")}
        <td><span class="estado-pill ${estado.clase}" title="${tooltip}" aria-label="Estado: ${estado.texto}">${estado.texto}</span></td>
      `;
      tbody.appendChild(tr);
    });

  }

  function onSortClick(col) {
    if (sortCol === col) sortDir = -sortDir;
    else { sortCol = col; sortDir = 1; }
    renderTabla();
  }

  // ---- Barra de progreso ----
  function iniciarProgressBar() {
    if (!progressBar) return;
    progressBar.style.transition = "none";
    progressBar.style.width = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      progressBar.style.transition = `width ${INTERVALO_MS}ms linear`;
      progressBar.style.width = "100%";
    }));
  }

  function detenerProgressBar() {
    if (!progressBar) return;
    progressBar.style.transition = "none";
    progressBar.style.width = "0%";
  }

  // ---- Intervalo de actualización ----
  function iniciarActualizacionEstado() {
    detenerActualizacionEstado();
    iniciarProgressBar();
    estadoInterval = setInterval(async () => {
      await fetchAndRenderData();
      
      // Sincronización: Si estamos en presentación y no está pausado, cambiamos de página
      if (modoPresentacion && !estaPausado) {
        paginaPresentacionActual = (paginaPresentacionActual + 1) % paginasPresentacion.length;
        renderPresentacion();
      }

      // El progress bar se reinicia siempre para marcar el siguiente ciclo
      iniciarProgressBar();
    }, INTERVALO_MS);
  }

  function detenerActualizacionEstado() {
    if (estadoInterval) { clearInterval(estadoInterval); estadoInterval = null; }
    detenerProgressBar();
  }

  // ---- Exportar CSV ----
  function exportarCSV() {
    const datos = datosTabla.filter(f => !esFalso(f.MonitorizarEstado));
    if (!datos.length) return;
    const headers = [...columnasTabla, "Estado"];
    const rows = datos.map(fila => {
      const cols = columnasTabla.map(col => `"${String(fila[col] ?? "").replace(/"/g, '""')}"`);
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

  // ---- Construir páginas de presentación ----
  // Agrupa por organismo→provincia→cliente para que nunca se corte un bloque de cliente
  function construirPaginasPresentacion(datos) {
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

          if (lineasActuales > 0 && lineasActuales + lineasNecesarias > maxLineasPresentacion) {
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
  function renderPresentacion() {
    if (!paginasPresentacion.length || !paginasPresentacion[0].length) {
      presentacionLista.innerHTML = `<div style="grid-column:span 2;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:3vh;font-weight:600">No hay datos para presentar.</div>`;
      paginacionInfo.textContent = "Sin datos";
      return;
    }

    const todosErrores = obtenerErroresActivos(datosTabla);

    const ERR_POR_PAGINA = 8;
    const paginasErr = Math.ceil(todosErrores.length / ERR_POR_PAGINA) || 1;
    const errIdx     = paginaPresentacionActual % paginasErr;
    const errPagina  = todosErrores.slice(errIdx * ERR_POR_PAGINA, (errIdx + 1) * ERR_POR_PAGINA);

    const pagina   = paginasPresentacion[paginaPresentacionActual];
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

    presentacionLista.style.display = "grid";
    presentacionLista.hidden = false;
    presentacionLista.innerHTML = `
      <div class="presentacion-columna">${col1.map(renderItem).join("")}</div>
      <div class="presentacion-columna">${col2.map(renderItem).join("")}</div>
      ${erroresHTML}
    `;

    paginacionInfo.textContent = `Página ${paginaPresentacionActual + 1} de ${paginasPresentacion.length}`;

    // Attach listeners to footer errors
    presentacionLista.querySelectorAll(".clickable-error").forEach(item => {
      item.addEventListener("click", (e) => {
        abrirModalError(errPagina[e.currentTarget.dataset.erridx % ERR_POR_PAGINA]);
      });
    });
  }

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
  modoPresentacionBtn.addEventListener("click", async () => {
    if (datosTabla.length === 0) {
      await fetchAndRenderData();
      if (datosTabla.length === 0) return;
      iniciarActualizacionEstado();
    }
    try {
      modoPresentacion = true;
      calcularMaxLineas();
      paginasPresentacion = construirPaginasPresentacion(datosTabla);
      paginaPresentacionActual = 0;
      estaPausado = false;
      tabla.style.display = "none";
      logsNormalSection.hidden = true;
      tablaWrapper.style.display = "none";
      presentacionLista.hidden = false;
      modoPresentacionBtn.style.display = "none";
      salirPresentacionBtn.style.display = "";
      renderPresentacion();
      await (tablaSection.requestFullscreen?.() ?? tablaSection.webkitRequestFullscreen?.call(tablaSection));
    } catch (error) {
      console.error("No se pudo activar pantalla completa", error);
    }
  });

  salirPresentacionBtn.addEventListener("click", () => salirModoPresentation());

  function salirModoPresentation() {
    modoPresentacion = false;
    estaPausado = false;
    if (document.fullscreenElement) document.exitFullscreen();
    presentacionLista.hidden = true;
    tabla.style.display = "table";
    tablaWrapper.style.display = "";
    modoPresentacionBtn.style.display = "";
    salirPresentacionBtn.style.display = "none";
    presentacionLista.style.display = "none";
    paginacionInfo.textContent = "";
    indicadorReproduccion.style.display = "none";
    renderTabla();
    renderLogsNormal(datosTabla);
  }

  // ---- Modal Logic ----
  cerrarModalBtn.addEventListener("click", () => { modalLog.style.display = "none"; });
  cancelarEdicionBtn.addEventListener("click", () => { modalLog.style.display = "none"; });
  window.addEventListener("click", e => { if (e.target === modalLog) modalLog.style.display = "none"; });

  // ---- Lógica Volver Arriba ----
  window.addEventListener("scroll", () => {
    // Solo mostrar si no estamos en modo presentación y hemos bajado suficiente
    if (!modoPresentacion && window.scrollY > 400) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  formEdicionLog.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(formEdicionLog);
    const btnSubmit = formEdicionLog.querySelector('button[type="submit"]');
    
    try {
      btnSubmit.disabled = true;
      const res = await fetch("datos.php?modo=actualizar_log", {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      if (result.success) {
        modalLog.style.display = "";
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
    if (!document.fullscreenElement && modoPresentacion) {
      salirModoPresentation();
    } else if (document.fullscreenElement && modoPresentacion) {
      calcularMaxLineas();
      paginasPresentacion = construirPaginasPresentacion(datosTabla);
      renderPresentacion();
    }
  });

  // ---- Teclado ----
  document.addEventListener("keydown", e => {
    // Prioridad: Cerrar modal si está abierto
    if (modalLog.style.display !== "none") {
      if (e.key === "Escape") {
        modalLog.style.display = "none";
        e.preventDefault();
      }
      return; // Bloqueamos otras teclas mientras el modal está abierto
    }

    if (!modoPresentacion) return;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      estaPausado = !estaPausado;
      indicadorReproduccion.textContent = estaPausado ? "⏸" : "▶";
      indicadorReproduccion.style.display = "block";
      setTimeout(() => { indicadorReproduccion.style.display = "none"; }, 1500);
    } else if (e.key === "ArrowRight") {
      paginaPresentacionActual = (paginaPresentacionActual + 1) % paginasPresentacion.length;
      renderPresentacion();
    } else if (e.key === "ArrowLeft") {
      paginaPresentacionActual = (paginaPresentacionActual - 1 + paginasPresentacion.length) % paginasPresentacion.length;
      renderPresentacion();
    } else if (e.key === "Escape") {
      salirModoPresentation();
    }
  });

  // ---- Escape HTML ----
  function escapeHtml(texto) {
    return String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
