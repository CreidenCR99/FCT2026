/**
 * Módulo: presentation.js
 */
import { appState, INTERVALO_MS } from './state.js';
import * as dom from './dom.js';
import { renderTabla } from './table.js';
import { getEstadoControl, esFalso, escapeHtml, obtenerErroresActivos } from './utils.js';
import { renderLogsNormal, iniciarProgressBar, detenerProgressBar, abrirModalError } from './ui.js';
import { fetchAndRenderData } from './api.js';

// ---- Calcular max líneas presentación ----

/**
 * Calcula dinámicamente el número máximo de líneas que pueden mostrarse en pantalla completa.
 * Mide el espacio disponible en el layout de presentación y el tamaño real de las líneas
 * según el CSS aplicado, optimizando el uso de pantalla en cualquier resolución.
 * @returns {void}
 */
export function calcularMaxLineas() {
	// Si no estamos en modo presentación, no es necesario un cálculo preciso.
	if (!appState.modoPresentacion) {
		appState.maxLineasPresentacion = 20;
		return;
	}

	// 1. Medimos la altura de una línea "tipo" (una máquina) inyectando un elemento invisible.
	// Esto garantiza que capturamos el tamaño real dictado por el CSS (vh, paddings, bordes).
	const dummy = document.createElement("div");
	dummy.className = "linea-maquina";
	dummy.style.visibility = "hidden";
	dummy.style.position = "absolute";
	dummy.innerHTML = '<span class="maquina-badge">✓</span>M';
	document.body.appendChild(dummy);
	const hLinea = dummy.getBoundingClientRect().height || 45; // Fallback por si acaso
	document.body.removeChild(dummy);

	// 2. Calculamos el espacio vertical disponible para las columnas de máquinas.
	// Medimos las secciones que ocupan espacio fijo en la vista de pantalla completa.
	const heightKpi = dom.kpiSection?.offsetHeight || 0;
	const heightHeader = dom.tablaSection.querySelector(".tabla-header")?.offsetHeight || 0;
	const heightProgress = dom.progressBar?.parentElement?.offsetHeight || 0;

	// El footer de errores solo resta espacio si hay errores activos que mostrar.
	const tieneErrores = obtenerErroresActivos(appState.datosTabla).length > 0;
	const heightFooter = tieneErrores ? (window.innerHeight * 0.25) : 0; // El footer ocupa ~25vh (base + padding + margen)

	const marginSafety = 30; // Margen de seguridad para evitar desbordamientos por tipos de línea más altos
	const availableHeight = window.innerHeight - heightKpi - heightHeader - heightProgress - heightFooter - marginSafety;

	// 3. Calculamos cuántas líneas caben físicamente y aplicamos un límite mínimo lógico.
	const calculo = Math.floor(availableHeight / hLinea);
	appState.maxLineasPresentacion = Math.max(24, calculo);
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
 * Inicia el ciclo de actualización automática de datos.
 * Llama a la API periódicamente y, si se está en modo presentación y no está pausado,
 * avanza automáticamente a la siguiente página de máquinas.
 * Reinicia la barra de progreso en cada ciclo.
 * @returns {void}
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
 * Detiene el intervalo de actualización automática y la barra de progreso.
 * @returns {void}
 */
export function detenerActualizacionEstado() {
	if (appState.estadoInterval) {
		clearInterval(appState.estadoInterval);
		appState.estadoInterval = null;
	}
	detenerProgressBar();
}


// ---- Construir páginas de presentación ----

// Agrupa por organismo→provincia→cliente para que nunca se corte un bloque de cliente

/**
 * Organiza los datos de las máquinas en "páginas" optimizadas para el modo presentación.
 * Implementa una lógica de agrupación por jerarquía (Organismo > Provincia > Cliente) para evitar que
 * los bloques de información de un cliente se dividan entre páginas, mejorando la legibilidad.
 * @param {Array<Object>} datos - El dataset completo de máquinas filtradas.
 * @returns {Array<Array<Object>>} Un arreglo de páginas, donde cada página es un arreglo de elementos a renderizar.
 */
export function construirPaginasPresentacion(datos) {
	const monitorizadas = datos.filter(m => !esFalso(m.MonitorizarEstado));

	const agrupado = {};
	monitorizadas.forEach(m => {
		const org = m.Organismo || "Sin organismo";
		const prov = m.Provincia || "Sin provincia";
		const cli = m.Cliente || "Sin cliente";
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
					(orgEnPagina ? 0 : 1) +
					(provEnPagina ? 0 : 1) +
					1 + maquinas.length;

				if (lineasActuales > 0 && lineasActuales + lineasNecesarias > appState.maxLineasPresentacion) {
					paginas.push(paginaActual);
					paginaActual = [];
					lineasActuales = 0;
					orgEnPagina = false;
					provEnPagina = false;
				}

				if (!orgEnPagina) {
					paginaActual.push({
						tipo: "organismo",
						texto: org
					});
					lineasActuales++;
					orgEnPagina = true;
				}
				if (!provEnPagina) {
					paginaActual.push({
						tipo: "provincia",
						texto: prov
					});
					lineasActuales++;
					provEnPagina = true;
				}

				paginaActual.push({
					tipo: "cliente",
					texto: cli
				});
				lineasActuales++;
				maquinas.forEach(m => {
					paginaActual.push(m);
					lineasActuales++;
				});
			});
		});
	});

	if (paginaActual.length) paginas.push(paginaActual);
	return paginas.length ? paginas : [
		[]
	];
}


// ---- Renderizar presentación ----

// El punto de corte entre columnas solo puede ocurrir al final de un bloque de cliente

/**
 * Renderiza la vista de presentación actual en pantalla completa.
 * Divide la página en dos columnas equilibradas respetando los bloques de clientes.
 * Además, gestiona la visualización rotativa de errores activos en el pie de página.
 * @returns {void}
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
	const errIdx = appState.paginaPresentacionActual % paginasErr;
	const errPagina = todosErrores.slice(errIdx * ERR_POR_PAGINA, (errIdx + 1) * ERR_POR_PAGINA);

	const pagina = appState.paginasPresentacion[appState.paginaPresentacionActual];
	const midpoint = Math.ceil(pagina.length / 2);

	// Buscar el punto de corte más cercano al centro que respete los bloques de cliente
	let splitIdx = pagina.length;
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
				splitIdx = j;
			}
		}
	}

	const col1 = pagina.slice(0, splitIdx);
	const col2 = pagina.slice(splitIdx);
	const errCol1 = errPagina.slice(0, 4);
	const errCol2 = errPagina.slice(4);

	const paginationText = paginasErr > 1 ? `Página ${errIdx + 1} de ${paginasErr}` : "";

	const erroresHTML = todosErrores.length > 0 ? `
      <div class="presentacion-errores-footer">
        <div class="presentacion-errores-header">
          <div class="presentacion-errores-titulo">ERRORES ACTIVOS</div>
          <div class="presentacion-errores-pagination">${paginationText}</div>
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

	// Attach listeners to footer errors and machines
	dom.presentacionLista.querySelectorAll(".clickable-error").forEach(item => {
		item.addEventListener("click", (e) => {
			abrirModalError(errPagina[e.currentTarget.dataset.erridx % ERR_POR_PAGINA]);
		});
	});

	dom.presentacionLista.querySelectorAll(".linea-maquina.clickable").forEach(item => {
		item.addEventListener("click", (e) => {
			const ns = e.currentTarget.dataset.ns;
			const machine = appState.datosTabla.find(m => m.NumeroSerie === ns);
			if (machine) {
				// Si tiene errores activos, abrimos el primero. Si no, abrimos modal para registrar nuevo.
				const activeLog = (machine.Logs || []).find(l => !esFalso(l.Activo));
				abrirModalError({
					maquina: machine,
					log: activeLog || {
						NumeroSerie: ns
					}
				});
			}
		});
	});
}


/**
 * Genera el HTML correspondiente a un elemento individual (Organismo, Provincia, Cliente o Máquina) en la presentación.
 * Aplica estilos y badges específicos según el tipo de dato y su estado de control.
 * @param {Object} item - El objeto de datos a transformar en HTML.
 * @returns {string} Fragmento de HTML string.
 */
function renderItem(item) {
	if (item.tipo === "organismo") return `<div class="linea-organismo">${escapeHtml(item.texto)}</div>`;
	if (item.tipo === "provincia") return `<div class="linea-provincia">${escapeHtml(item.texto)}</div>`;
	if (item.tipo === "cliente") return `<div class="linea-cliente">${escapeHtml(item.texto)}</div>`;
	if (item.tipo === "maquina") {
		const colorMap = {
			"estado-verde": "#28a745",
			"estado-rojo": "#a10702",
			"estado-naranja": "#f58a07",
			"estado-gris": "#6e6e73"
		};
		const bg = colorMap[item.estado.clase] || "#6e6e73";
		// Hacemos que la fila de la máquina sea clicable en presentación
		return `<div class="linea-maquina clickable" style="background:${bg}; cursor:pointer" data-ns="${escapeHtml(item.fila.NumeroSerie)}">
        <span class="maquina-badge">${escapeHtml(item.estado.texto)}</span>${escapeHtml(item.texto)}
      </div>`;
	}
	return "";
}


// ---- Botón modo presentación ----

dom.modoPresentacionBtn.addEventListener("click", async () => {
	if (appState.datosTabla.length === 0) {
		await fetchAndRenderData();
		if (appState.datosTabla.length === 0) return;
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
		// Reiniciamos el temporizador y la barra de progreso al entrar
		iniciarActualizacionEstado();
		await (dom.tablaSection.requestFullscreen?.() ?? dom.tablaSection.webkitRequestFullscreen?.call(dom.tablaSection));
	} catch (error) {
		console.error("No se pudo activar pantalla completa", error);
	}
});

dom.salirPresentacionBtn.addEventListener("click", () => salirModoPresentation());


/**
 * Realiza la limpieza necesaria al salir del modo presentación.
 * Restaura la visibilidad de la tabla normal, detiene la pantalla completa y vuelve a renderizar los componentes estándar.
 * @returns {void}
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