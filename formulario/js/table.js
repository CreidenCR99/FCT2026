/**
 * Módulo: table.js
 */
import { appState } from './state.js';
import * as dom from './dom.js';
import { esFalso, getEstadoControl } from './utils.js';
import { cerrarModal, abrirModalError } from './ui.js';
import { salirModoPresentation, renderPresentacion } from './presentation.js';

// --- Búsqueda en tabla ---

let searchTimeout;
dom.searchInput.addEventListener("input", () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(() => {
		appState.filtroTexto = dom.searchInput.value.trim().toLowerCase();
		appState.animarTabla = true; 
		if (appState.datosTabla.length > 0) renderTabla();
		appState.animarTabla = false;
	}, 250); // 250ms de pausa antes de filtrar
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
	const blob = new Blob([csv], {
		type: "text/csv;charset=utf-8;"
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `maquinas_${new Date().toISOString().slice(0, 10)}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
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
		dom.tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:4vh 1.6vw;color:var(--text-muted);font-size:1.6vh">${
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
		th.addEventListener("keydown", e => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onSortClick(th.dataset.col);
			}
		});
	});

	// Usar un string builder y una sola inserción al final
	let htmlBuffer = "";
	datosFiltrados.forEach((fila, idx) => {
		const estado = fila._estado;
		const colorSuffix = estado.clase.split('-')[1]; // verde, rojo, naranja, gris
		const esCambio = maquinasCambiadas.has(fila.NumeroSerie) ? " fila-cambiada" : "";
		const rowTitle = estado.clase === "estado-naranja" ? 'Click para gestionar error' : 'Click para registrar nuevo error';

		// Animamos solo si es una búsqueda activa y estamos en el rango inicial
		const isAnimated = appState.animarTabla && idx < 50;
		const cascadeClass = isAnimated ? " row-cascade" : (appState.animarTabla ? " row-delayed" : "");
		const cascadeStyle = isAnimated ? ` animation-delay: ${(idx * 0.03).toFixed(2)}s;` : "";

		htmlBuffer += `
        <tr class="row-${colorSuffix}${esCambio}${cascadeClass}" title="${rowTitle}" style="cursor:pointer;${cascadeStyle}" data-ns="${fila.NumeroSerie}">
          ${appState.columnasTabla.map(col => `<td>${fila[col] ?? ""}</td>`).join("")}
          <td>
            <span class="estado-pill ${estado.clase}" title="${fila._tooltip}" aria-label="Estado: ${estado.texto}">
              ${estado.texto}
            </span>
          </td>
        </tr>`;
	});

	// En lugar de reemplazar el HTML, "parcheamos" el DOM existente.
	// Esto mantiene el scroll y el foco del usuario incluso durante el refresco de 7.5s.
	const tempTbody = document.createElement('tbody');
	tempTbody.innerHTML = htmlBuffer;
	morphdom(dom.tbody, tempTbody);

	// Delegación de eventos para las filas (más eficiente que un listener por fila)
	dom.tbody.onclick = (e) => {
		const tr = e.target.closest('tr[data-ns]');
		if (tr) {
			const ns = tr.dataset.ns;
			const fila = appState.datosTabla.find(m => m.NumeroSerie === ns);
			if (fila) {
				const activeLog = (fila.Logs || []).find(l => !esFalso(l.Activo));
				// Si tiene errores activos, abrimos el primero. Si no, abrimos modal para registrar nuevo.
				abrirModalError({
					maquina: fila,
					log: activeLog || {
						NumeroSerie: ns
					}
				});
			}
		}
	};

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
	else {
		appState.sortCol = col;
		appState.sortDir = 1;
	}
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
		setTimeout(() => {
			dom.indicadorReproduccion.style.display = "none";
		}, 1500);
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