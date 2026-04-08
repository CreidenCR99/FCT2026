document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form");
  const selectOrganismo = document.getElementById("organismo");
  const tablaSection = document.getElementById("tablaSection");
  const tabla = document.getElementById("tablaDatos");
  const thead = tabla.querySelector("thead");
  const tbody = tabla.querySelector("tbody");
  const estadoTabla = document.getElementById("estadoTabla");
  const paginacionInfo = document.getElementById("paginacionInfo");
  const modoPresentacionBtn = document.getElementById("modoPresentacionBtn");
  const salirPresentacionBtn = document.getElementById("salirPresentacionBtn");

  const FILAS_POR_PAGINA = 10;
  const INTERVALO_MS = 5000;

  let datosTabla = [];
  let columnasTabla = [];
  let paginaActual = 0;
  let autoplayInterval = null;
  let modoPresentacion = false;
  let estadoInterval = null;

  cargarOrganismos();

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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const organismo = selectOrganismo.value;
    estadoTabla.textContent = "Cargando resultados...";
    tabla.style.display = "none";
    thead.innerHTML = "";
    tbody.innerHTML = "";
    detenerAutoplay();

    try {
      const res = await fetch(
        `datos.php?modo=maquinas&organismo=${encodeURIComponent(organismo)}`,
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        datosTabla = [];
        columnasTabla = [];
        estadoTabla.textContent = "No hay resultados para mostrar.";
        paginacionInfo.textContent = "Sin datos";
        return;
      }

      datosTabla = data;
      columnasTabla = Object.keys(data[0]).filter(
        (col) => col !== "UltimoControl",
      );
      paginaActual = 0;

      renderTabla();
      estadoInterval = setInterval(() => {
        if (!datosTabla.length) return;
        renderTabla();
      }, 5000);
      tabla.style.display = "table";

      estadoTabla.textContent = organismo
        ? `Mostrando ${data.length} resultados para "${organismo}".`
        : `Mostrando ${data.length} resultados.`;
    } catch (error) {
      estadoTabla.textContent = "Error al cargar los datos.";
      console.error(error);
    }
  });

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

  function getEstadoControl(ultimoControl) {
    const fechaControl = parseUltimoControl(ultimoControl);

    if (!fechaControl || Number.isNaN(fechaControl.getTime())) {
      return {
        texto: "?",
        clase: "estado-gris",
      };
    }

    const ahora = new Date();
    const diferenciaMinutos = (ahora - fechaControl) / 60000;

    if (diferenciaMinutos < 10) {
      return {
        texto: "OK",
        clase: "estado-verde",
      };
    }

    return {
      texto: "!",
      clase: "estado-rojo",
    };
  }

  function renderTabla() {
    if (!datosTabla.length) return;

    thead.innerHTML = `
    <tr>
      ${columnasTabla.map((col) => `<th>${col}</th>`).join("")}
      <th>Estado</th>
    </tr>
  `;

    let filasVisibles = datosTabla;

    if (modoPresentacion) {
      const totalPaginas = Math.ceil(datosTabla.length / FILAS_POR_PAGINA);
      const inicio = paginaActual * FILAS_POR_PAGINA;
      const fin = inicio + FILAS_POR_PAGINA;
      filasVisibles = datosTabla.slice(inicio, fin);

      paginacionInfo.textContent = `Página ${paginaActual + 1} de ${totalPaginas} · Registros ${inicio + 1}-${Math.min(fin, datosTabla.length)} de ${datosTabla.length}`;
    } else {
      paginacionInfo.textContent = `Mostrando ${datosTabla.length} registros`;
    }

    tbody.innerHTML = filasVisibles
      .map((fila) => {
        const estado = getEstadoControl(fila.UltimoControl);

        return `
        <tr>
          ${columnasTabla.map((col) => `<td>${fila[col] ?? ""}</td>`).join("")}
          <td>
            <span class="estado-pill ${estado.clase}">${estado.texto}</span>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function siguientePagina() {
    if (!datosTabla.length) return;
    const totalPaginas = Math.ceil(datosTabla.length / FILAS_POR_PAGINA);
    paginaActual = (paginaActual + 1) % totalPaginas;
    renderTabla();
  }

  function iniciarAutoplay() {
    detenerAutoplay();
    autoplayInterval = setInterval(siguientePagina, INTERVALO_MS);
  }

  function detenerAutoplay() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  }

  modoPresentacionBtn.addEventListener("click", async () => {
    if (!datosTabla.length) return;

    try {
      modoPresentacion = true;
      paginaActual = 0;
      renderTabla();

      if (!document.fullscreenElement) {
        await tablaSection.requestFullscreen();
      }

      document.body.classList.add("modo-presentacion");
      modoPresentacionBtn.style.display = "none";
      salirPresentacionBtn.style.display = "inline-flex";
      iniciarAutoplay();
    } catch (error) {
      console.error("No se pudo activar pantalla completa", error);
    }
  });

  salirPresentacionBtn.addEventListener("click", async () => {
    salirModoPresentacion();

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  });

  function salirModoPresentacion() {
    modoPresentacion = false;
    detenerAutoplay();
    document.body.classList.remove("modo-presentacion");
    modoPresentacionBtn.style.display = "inline-flex";
    salirPresentacionBtn.style.display = "none";
    renderTabla();
  }

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      salirModoPresentacion();
    }
  });
});
