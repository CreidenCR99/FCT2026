document.addEventListener("DOMContentLoaded", () => {
  // --- Elementos del DOM ---
  const form = document.getElementById("form");
  const selectOrganismo = document.getElementById("organismo");
  const selectProvincia = document.getElementById("provincia");
  const tablaSection = document.getElementById("tablaSection");
  const tabla = document.getElementById("tablaDatos");
  const tablaWrapper = document.getElementById("tablaWrapper");
  const thead = tabla.querySelector("thead");
  const tbody = tabla.querySelector("tbody");
  const estadoTabla = document.getElementById("estadoTabla");
  const paginacionInfo = document.getElementById("paginacionInfo");
  const modoPresentacionBtn = document.getElementById("modoPresentacionBtn");
  const limpiarFiltrosBtn = document.getElementById("limpiarFiltrosBtn");
  const salirPresentacionBtn = document.getElementById("salirPresentacionBtn");
  const presentacionLista = document.getElementById("presentacionLista");
  const indicadorReproduccion = document.getElementById("indicadorReproduccion");
  const backToTopBtn = document.getElementById("backToTop");

  // --- Constantes de Configuracion ---
  const INTERVALO_MS = 7500;
  let maxLineasPresentacion = 20;

  // --- Estado Global de la Aplicacion ---
  let datosTabla = [];
  let columnasTabla = [];
  let autoplayInterval = null;
  let estadoInterval = null;
  let modoPresentacion = false;
  let paginasPresentacion = [];
  let paginaPresentacionActual = 0;
  let estaPausado = false;

  // Inicializacion
  cargarOrganismos();
  cargarProvincias();

  /**
   * Obtiene la lista de organismos desde el servidor
   */
  async function cargarOrganismos() {
    try {
      const res = await fetch("datos.php?modo=organismos");
      const data = await res.json();

      selectOrganismo.innerHTML =
        '<option value="">Todos los organismos</option>';

      data.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.Organismo;
        option.textContent = item.Organismo;
        selectOrganismo.appendChild(option);
      });
    } catch (error) {
      selectOrganismo.innerHTML = '<option value="">Error al cargar</option>';
      console.error(error);
    }
  }

  /**
   * Obtiene la lista de provincias desde el servidor filtradas por organismo
   * @param {string} organismo
   */
  async function cargarProvincias(organismo = "") {
    try {
      const res = await fetch(
        `datos.php?modo=provincias&organismo=${encodeURIComponent(organismo)}`,
      );
      const data = await res.json();

      const valorActual = selectProvincia.value;
      selectProvincia.innerHTML =
        '<option value="">Todas las provincias</option>';

      data.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.Provincia;
        option.textContent = item.Provincia;
        selectProvincia.appendChild(option);
      });

      // Intentar mantener la seleccion anterior si sigue existiendo en el nuevo filtro
      if (data.some((item) => item.Provincia === valorActual)) {
        selectProvincia.value = valorActual;
      }
    } catch (error) {
      selectProvincia.innerHTML = '<option value="">Error al cargar</option>';
      console.error(error);
    }
  }

  // Escuchar cambios en el organismo para actualizar provincias
  selectOrganismo.addEventListener("change", () => {
    cargarProvincias(selectOrganismo.value);
  });

  // Boton para limpiar filtros
  limpiarFiltrosBtn.addEventListener("click", () => {
    selectOrganismo.value = "";
    selectProvincia.value = "";
    cargarProvincias(""); // Recargar todas las provincias
  });

  // Variable para almacenar los filtros actuales
  let filtroOrganismo = "";
  let filtroProvincia = "";

  /**
   * Maneja el envio del formulario para buscar y mostrar datos
   */
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const organismo = selectOrganismo.value;
    const provincia = selectProvincia.value;

    // Guardar los filtros actuales
    filtroOrganismo = organismo;
    filtroProvincia = provincia;

    estadoTabla.textContent = "Cargando resultados...";
    thead.innerHTML = "";
    tbody.innerHTML = "";
    tabla.style.display = "none";
    presentacionLista.hidden = true;
    presentacionLista.innerHTML = "";
    columnasTabla = []; // Resetear columnas para una nueva carga

    // Detener procesos activos antes de una nueva carga
    detenerAutoplay();
    detenerActualizacionEstado();

    await fetchAndRenderData(); // Realizar la carga inicial
    iniciarActualizacionEstado(); // Iniciar la actualización periódica
  });

  /**
   * Calcula dinámicamente el número de líneas permitidas en la presentación según la altura.
   * Dividimos la altura por un factor (54) para que en 1080p haya 20 líneas.
   * El resultado se limita entre 20 y 36 líneas totales (10-18 por columna).
   */
  function calcularMaxLineas() {
    const calculo = Math.floor(window.innerHeight / 54);
    maxLineasPresentacion = Math.min(36, Math.max(20, calculo));
  }

  /**
   * Obtiene los datos de las máquinas del servidor y los renderiza.
   */
  async function fetchAndRenderData() {

    try {
      const res = await fetch(
        `datos.php?modo=maquinas&organismo=${encodeURIComponent(filtroOrganismo)}&provincia=${encodeURIComponent(filtroProvincia)}`,
      );
      const data = await res.json();

      datosTabla = data;

      // Solo establecer las columnas si hay datos y no se han definido antes
      if (data.length > 0 && columnasTabla.length === 0) {
        columnasTabla = Object.keys(data[0]).filter(
          (col) =>
            col !== "UltimoControl" && col !== "MonitorizarEstado" &&
            col !== "NumeroSerie" && col !== "MonitorizarAlertas" &&
            col !== "Logs",
        );
      } else if (data.length === 0) {
          columnasTabla = []; // Limpiar columnas si no hay datos
      }

      if (modoPresentacion) {
        calcularMaxLineas();
        paginasPresentacion = construirPaginasPresentacion(datosTabla);
        // Asegurarse de que la página actual sea válida después de una actualización de datos
        if (paginaPresentacionActual >= paginasPresentacion.length) {
            paginaPresentacionActual = 0;
        }
        renderPresentacion();
      } else {
        renderTabla();
        tabla.style.display = "table"; // Asegurarse de que la tabla sea visible
      }

      let mensajeEstado = `Hay un total de ${data.length} resultados`;
      if (filtroOrganismo && filtroProvincia) {
        mensajeEstado += ` para "${filtroOrganismo}" en "${filtroProvincia}".`;
      } else if (filtroOrganismo) {
        mensajeEstado += ` para "${filtroOrganismo}".`;
      } else if (filtroProvincia) {
        mensajeEstado += ` en "${filtroProvincia}".`;
      } else {
        mensajeEstado += ".";
      }
      estadoTabla.textContent = mensajeEstado;
    } catch (error) {
      estadoTabla.textContent = "Error al cargar los datos.";
      paginacionInfo.textContent = "Error";
      console.error("Error al actualizar datos:", error);
    }
  }

  /**
   * Parsea un string de fecha con formato: YYYYMMDDHHMM
   * @param {string|number} valor
   * @returns {Date|null}
   */
  function parseUltimoControl(valor) {
    if (!valor) return null;

    const texto = String(valor).trim();
    if (!/^\d{12}$/.test(texto)) return null;

    const year = parseInt(texto.slice(0, 4), 10);
    const month = parseInt(texto.slice(4, 6), 10) - 1;
    const day = parseInt(texto.slice(6, 8), 10);
    const hour = parseInt(texto.slice(8, 10), 10);
    const minute = parseInt(texto.slice(10, 12), 10);

    return new Date(year, month, day, hour, minute);
  }

  /**
   * Determina el estado visual (OK, Alerta, Log, Desconocido) segun el tiempo desde el ultimo control o si tiene logs
   * @param {Object} fila Objeto con los datos de la máquina
   * @returns {Object} Texto (?, LOG, OK, !) y clase
   */
  function getEstadoControl(fila) {
    // Prioridad: MonitorizarAlertas en false (o 0) significa alerta activa
    if (esFalso(fila.MonitorizarAlertas)) {
      return { texto: "LOG", clase: "estado-naranja" };
    }

    const fechaControl = parseUltimoControl(fila.UltimoControl);
    const ahora = new Date();
    const diferenciaMinutos = (ahora - fechaControl) / 60000;

    if (!fechaControl || Number.isNaN(fechaControl.getTime())) {
      return { texto: "?", clase: "estado-gris" };
    } else if (diferenciaMinutos < 10) {
      return { texto: "OK", clase: "estado-verde" };
    } else {
      return { texto: "!", clase: "estado-rojo" };
    }
  }

  /**
   * Helper para comprobar si un valor booleano en string es falso
   */
  function esFalso(valor) {
    if (valor === null || typeof valor === 'undefined') return true;
    if (typeof valor === 'boolean') return !valor;
    const v = String(valor).trim().toLowerCase();
    // Considerar "0", "false", "null", "undefined", y cadenas vacías como falso
    return v === "0" || v === "false" || v === "null" || v === "undefined" || v === "";
  }

  /**
   * Renderiza los datos en la tabla principal de resultados
   */
  function renderTabla() {
    const datosFiltrados = datosTabla.filter(f => !esFalso(f.MonitorizarEstado));
    if (!datosFiltrados.length) return;

    thead.innerHTML = `
      <tr>
        ${columnasTabla.map((col) => `<th>${col}</th>`).join("")}
        <th>Estado</th>
      </tr>
    `;

    tbody.innerHTML = datosFiltrados
      .map((fila) => {
        const estado = getEstadoControl(fila);

        return `
          <tr>
            ${columnasTabla.map((col) => `<td>${fila[col] ?? ""}</td>`).join("")}
            <td><span class="estado-pill ${estado.clase}">${estado.texto}</span></td>
          </tr>
        `;
      })
      .join("");

    paginacionInfo.textContent = `Mostrando ${datosFiltrados.length} registros`;
  }

  /**
   * Inicia el ciclo de actualizacion periodica del estado de las maquinas
   */
  function iniciarActualizacionEstado() {
    detenerActualizacionEstado();
    estadoInterval = setInterval(() => {
      fetchAndRenderData(); // Ahora el intervalo llama a la función que también obtiene los datos
    }, INTERVALO_MS);
  }

  /**
   * Detiene el intervalo de actualizacion de estado
   */
  function detenerActualizacionEstado() {
    if (estadoInterval) {
      clearInterval(estadoInterval);
      estadoInterval = null;
    }
  }

  /**
   * Detiene el cambio automatico de paginas en el modo presentacion
   */
  function detenerAutoplay() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  }

  /**
   * Agrupa los datos planos por Organismo, Provincia y Cliente para la presentacion
   * @param {Array} datos
   * @returns {Object} Mapa anidado de datos
   * @example
   * {
   *  "ILUNION": {
   *    "Barcelona": {
   *      "CIPO": [
   *        { descripcion: "TUNEL CIPO LIMPIO", ultimoControl: "202604071437" },
   *        { descripcion: "TUNEL CIPO SUCIO", ultimoControl: "0" }
   *      ],
   *      "ARTS": [
   *        { descripcion: "TUNEL HOTEL ARTS", ultimoControl: "202604070948" }
   *      ]
   *    },
   *    "Cadiz": {
   *      ...
   *    }
   *  }
   * }
   */
  function agruparDatos(datos) {
    const mapa = {};

    // Solo agrupamos máquinas que deben monitorizar su estado general
    const datosFiltrados = datos.filter(f => !esFalso(f.MonitorizarEstado));

    datosFiltrados.forEach((fila) => {
      const organismo = fila.Organismo || "Sin organismo";
      const provincia = fila.Provincia || "Sin provincia";
      const cliente = fila.Cliente || "Sin cliente";
      const maquina = fila.Descripcion || "Sin descripcion";
      const ultimoControl = fila.UltimoControl ?? null;
      const logs = fila.Logs ?? []; // Obtener el array de logs

      if (!mapa[organismo]) {
        mapa[organismo] = {};
      }

      if (!mapa[organismo][provincia]) {
        mapa[organismo][provincia] = {};
      }

      if (!mapa[organismo][provincia][cliente]) {
        mapa[organismo][provincia][cliente] = [];
      }

      mapa[organismo][provincia][cliente].push({
        descripcion: maquina,
        ultimoControl,
        logs, // Pasar el array de logs
        MonitorizarAlertas: fila.MonitorizarAlertas,
      });
    });

    return mapa;
  }

  /**
   * Divide los datos agrupados en "paginas" o diapositivas segun el limite de lineas
   * @param {Array} datos
   * @returns {Array} Array de paginas para la presentacion
   */
  function construirPaginasPresentacion(datos) {
    const agrupado = agruparDatos(datos);
    const paginas = [];
    let paginaActual = [];
    let lineasActuales = 0;

    Object.keys(agrupado).forEach((organismo) => {
      const provincias = agrupado[organismo];
      let organismoPuesto = false;

      Object.keys(provincias).forEach((provincia) => {
        const clientes = provincias[provincia];
        let provinciaPuesta = false;

        Object.keys(clientes).forEach((cliente) => {
          // Calculo de lineas necesarias para este bloque de cliente
          const maquinas = clientes[cliente];
          const lineasCliente =
            (organismoPuesto ? 0 : 1) +
            (provinciaPuesta ? 0 : 1) +
            1 +
            maquinas.length;

          // Si el bloque actual no cabe en la pagina, crear una nueva
          if (
            lineasActuales > 0 &&
            lineasActuales + lineasCliente > maxLineasPresentacion
          ) {
            paginas.push(paginaActual);
            paginaActual = [];
            lineasActuales = 0;
            organismoPuesto = false;
            provinciaPuesta = false;
          }

          if (!organismoPuesto) {
            paginaActual.push({ tipo: "organismo", texto: organismo });
            lineasActuales += 1;
            organismoPuesto = true;
          }

          if (!provinciaPuesta) {
            paginaActual.push({ tipo: "provincia", texto: provincia });
            lineasActuales += 1;
            provinciaPuesta = true;
          }

          paginaActual.push({ tipo: "cliente", texto: cliente });
          lineasActuales += 1;

          maquinas.forEach((maquina) => {
            paginaActual.push({
              tipo: "maquina",
              texto: maquina.descripcion,
              ultimoControl: maquina.ultimoControl,
              logs: maquina.logs, // Pasar el array de logs
              MonitorizarAlertas: maquina.MonitorizarAlertas,
            });
            lineasActuales += 1;
          });
        });
      });
    });

    if (paginaActual.length) {
      paginas.push(paginaActual);
    }

    return paginas;
  }

  /**
   * Renderiza la pagina actual del modo presentacion en dos columnas
   */
  function renderPresentacion() {
    if (!paginasPresentacion.length) {
      presentacionLista.innerHTML = "<p>No hay datos para presentar.</p>";
      paginacionInfo.textContent = "Sin datos";
      return;
    }

    // Máquinas con alertas activas: MonitorizarAlertas es false (0)
    const maquinasConErroresActivos = datosTabla.filter(m => esFalso(m.MonitorizarAlertas));

    // Aplanar los errores para mostrarlos, asociando cada mensaje de log con su máquina
    const erroresParaMostrar = [];
    maquinasConErroresActivos.forEach(m => {
      const logsFallo = m.Logs.filter(log => esFalso(log.ResultadoCorrecto));
      
      if (logsFallo.length === 0) {
        // Si tiene la alerta activa pero no hay logs de fallo (o no hay logs), mostrar error desconocido
        erroresParaMostrar.push({
          descripcion: m.Descripcion,
          mensaje: "Error desconocido"
        });
      } else {
        logsFallo.forEach(log => {
          erroresParaMostrar.push({
            descripcion: m.Descripcion,
            mensaje: log.Mensaje
          });
        });
      }
    });

    const ERR_POR_PAGINA = 8;
    const paginasErrores = Math.ceil(erroresParaMostrar.length / ERR_POR_PAGINA) || 1;
    const paginaErrorActual = paginaPresentacionActual % paginasErrores;
    const erroresAMostrarEnPagina = erroresParaMostrar.slice(paginaErrorActual * ERR_POR_PAGINA, (paginaErrorActual + 1) * ERR_POR_PAGINA);

    const pagina = paginasPresentacion[paginaPresentacionActual];
    const mitad = Math.ceil(pagina.length / 2);
    const columna1 = pagina.slice(0, mitad);
    const columna2 = pagina.slice(mitad);

    const errCol1 = erroresAMostrarEnPagina.slice(0, 4);
    const errCol2 = erroresAMostrarEnPagina.slice(4);

    presentacionLista.style.display = "grid";
    presentacionLista.innerHTML = `
      <div class="presentacion-columna">
        ${columna1.map(renderLineaPresentacion).join("")}
      </div>
      <div class="presentacion-columna">
        ${columna2.map(renderLineaPresentacion).join("")}
      </div>
      <div class="presentacion-errores-footer">
        ${erroresParaMostrar.length > 0 ? `
          <div class="presentacion-errores-titulo">MÁQUINAS CON ERRORES DE ACTUALIZACIÓN (${erroresParaMostrar.length}) ${paginasErrores > 1 ? `(Pág. ${paginaErrorActual + 1}/${paginasErrores})` : ""}</div>
          <div class="presentacion-errores-columnas">
            <div class="presentacion-columna-errores">
              ${errCol1.map(m => `
                <div class="presentacion-error-item">
                  <strong style="color: #f58a07;">${escapeHtml(m.descripcion)}:</strong> ${escapeHtml(m.mensaje)}
                </div>
              `).join("")}
            </div>
            <div class="presentacion-columna-errores">
              ${errCol2.map(m => `
                <div class="presentacion-error-item">
                  <strong style="color: #f58a07;">${escapeHtml(m.descripcion)}:</strong> ${escapeHtml(m.mensaje)}
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;

    paginacionInfo.textContent = `Pagina ${paginaPresentacionActual + 1} de ${paginasPresentacion.length}`;
  }

  /**
   * Genera el HTML para una linea individual de la presentacion
   * @param {Object} item
   * @returns {string} Fragmento HTML
   */
  function renderLineaPresentacion(item) {
    if (item.tipo === "organismo") {
      return `<div class="linea-organismo">${escapeHtml(item.texto)}</div>`;
    }

    if (item.tipo === "provincia") {
      return `<div class="linea-provincia">${escapeHtml(item.texto)}</div>`;
    }

    if (item.tipo === "cliente") {
      return `<div class="linea-cliente">${escapeHtml(item.texto)}</div>`;
    }

    const estado = getEstadoControl({
      UltimoControl: item.ultimoControl,
      Logs: item.logs, // Pasar el array de logs
      MonitorizarAlertas: item.MonitorizarAlertas
    });
    return `
      <div class="linea-maquina ${estado.clase}">
        ${escapeHtml(item.texto)}
      </div>
    `;
  }

  /**
   * Avanza a la siguiente pagina de la presentacion de forma circular
   */
  function siguientePaginaPresentacion() {
    if (!paginasPresentacion.length) return;
    paginaPresentacionActual =
      (paginaPresentacionActual + 1) % paginasPresentacion.length;
    renderPresentacion();
  }

  /**
   * Retrocede a la pagina anterior de la presentacion de forma circular
   */
  function anteriorPaginaPresentacion() {
    if (!paginasPresentacion.length) return;
    paginaPresentacionActual =
      (paginaPresentacionActual - 1 + paginasPresentacion.length) % paginasPresentacion.length;
    renderPresentacion();
  }

  /**
   * Reinicia el intervalo de la presentacion si no esta pausado
   */
  function reiniciarAutoplay() {
    detenerAutoplay();
    if (!estaPausado && modoPresentacion) {
      autoplayInterval = setInterval(siguientePaginaPresentacion, INTERVALO_MS);
    }
    actualizarIndicadorPausa();
  }

  /**
   * Activa el modo presentacion y solicita pantalla completa
   */
  modoPresentacionBtn.addEventListener("click", async () => {
    if (datosTabla.length === 0) {
      // Si no hay datos cargados, ejecutamos una búsqueda general sin filtros
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

      tablaWrapper.hidden = true;
      tabla.hidden = true;
      presentacionLista.hidden = false;

      renderPresentacion();

      if (!document.fullscreenElement) {
        await tablaSection.requestFullscreen();
      }

      document.body.classList.add("modo-presentacion");
      modoPresentacionBtn.style.display = "none";
      salirPresentacionBtn.style.display = "inline-flex";

      reiniciarAutoplay();
    } catch (error) {
      console.error("No se pudo activar pantalla completa", error);
    }
  });

  /**
   * Sale del modo presentacion y sale de pantalla completa si aplica
   */
  salirPresentacionBtn.addEventListener("click", async () => {
    salirModoPresentacion();

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  });

  /**
   * Restablece la interfaz al estado normal de tabla
   */
  function salirModoPresentacion() {
    modoPresentacion = false;
    detenerAutoplay();
    estaPausado = false;

    presentacionLista.hidden = true;
    tablaWrapper.hidden = false;
    tabla.hidden = false;

    document.body.classList.remove("modo-presentacion");
    modoPresentacionBtn.style.display = "inline-flex";
    salirPresentacionBtn.style.display = "none";
    presentacionLista.style.display = "none";
    indicadorReproduccion.style.display = "none";

    renderTabla();
  }

  /**
   * Actualiza el indicador visual de Play/Pause
   */
  function actualizarIndicadorPausa() {
    if (!modoPresentacion) return;
    indicadorReproduccion.textContent = estaPausado ? "⏸" : "";
    indicadorReproduccion.style.display = "block";
  }

  // Detectar cambios en pantalla completa (como presionar ESC) para sincronizar el estado
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      salirModoPresentacion();
    } else if (modoPresentacion) {
      // Recalcular layout al entrar en pantalla completa o cambiar orientación
      calcularMaxLineas();
      paginasPresentacion = construirPaginasPresentacion(datosTabla);
      renderPresentacion();
    }
  });

  // Atajos de teclado para el modo presentacion
  document.addEventListener("keydown", (e) => {
    if (!modoPresentacion) return;

    if (e.code === "Space") {
      e.preventDefault(); // Evitar que la pagina haga scroll
      estaPausado = !estaPausado;
      reiniciarAutoplay();
    } else if (e.code === "ArrowRight") {
      estaPausado = false; // Al navegar manualmente, reanudamos la reproduccion
      siguientePaginaPresentacion();
      reiniciarAutoplay();
    } else if (e.code === "ArrowLeft") {
      estaPausado = false;
      anteriorPaginaPresentacion();
      reiniciarAutoplay();
    }
  });

  // Recalcular si el usuario cambia el tamaño de la ventana manualmente
  window.addEventListener("resize", () => {
    if (modoPresentacion) {
      calcularMaxLineas();
      paginasPresentacion = construirPaginasPresentacion(datosTabla);
      renderPresentacion();
    }
  });

  // Mostrar/ocultar botón de volver arriba según el scroll
  window.addEventListener("scroll", () => {
    if (!modoPresentacion && window.scrollY > 300) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  });

  // Acción de volver arriba al hacer clic
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /**
   * Reemplaza caracteres especiales en un texto para evitar problemas al renderizar HTML
   * @param {string} texto
   * @returns {string} Texto con caracteres formateados
   */
  function escapeHtml(texto) {
    return String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
