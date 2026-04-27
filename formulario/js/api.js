/**
 * Módulo: api.js
 */
import { CONFIG } from '../config.js';
import { appState } from './state.js';
import * as dom from './dom.js';
import { renderKPIs, renderLogsNormal, mostrarSkeleton, actualizarDatosModal, limpiarTrends } from './ui.js';
import { renderTabla } from './table.js';
import { getEstadoControl, getTooltipEstado, getClaseConexion } from './utils.js';
import { calcularMaxLineas, construirPaginasPresentacion, detenerActualizacionEstado, renderPresentacion } from './presentation.js';
import { showDBErrorToast } from '../../core/toasts.js';

// --- Inicialización ---

/**
 * Actualiza la visibilidad del botón "Limpiar Filtros".
 * Solo se muestra si hay algún filtro activo que no sea el valor por defecto (vacío).
 */
export function actualizarVisibilidadLimpiar() {
	const hayFiltros = dom.selectPais.value !== "" || dom.selectOrganismo.value !== "" || dom.selectProvincia.value !== "";
	if (dom.limpiarFiltrosBtn) {
		const estaOculto = dom.limpiarFiltrosBtn.style.display === "none" || dom.limpiarFiltrosBtn.style.display === "";
		if (hayFiltros && estaOculto) {
			dom.limpiarFiltrosBtn.style.display = "inline-flex";
			dom.limpiarFiltrosBtn.style.animation = "btnPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards";
		} else if (!hayFiltros && !estaOculto) {
			dom.limpiarFiltrosBtn.style.animation = "btnPopOut 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards";
			// Esperamos a que termine la animación antes de ocultar el elemento del flujo del DOM
			dom.limpiarFiltrosBtn.addEventListener('animationend', () => {
				if (dom.selectPais.value === "" && dom.selectOrganismo.value === "" && dom.selectProvincia.value === "") {
					dom.limpiarFiltrosBtn.style.display = "none";
				}
			}, {
				once: true
			});
		}
	}
}

/**
 * Realiza una petición al backend para obtener la lista de países disponibles.
 * @async
 * @returns {Promise<void>}
 */
export async function cargarPaises() {
	try {
		const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=paises`);
		const data = await res.json();
		
		if (data && data.db_connection_error) {
			showDBErrorToast("Fallo al obtener catálogo de países.");
		}
		
		dom.selectPais.innerHTML = `<option value="">Todos los países</option>`;
		data.forEach(item => {
			const opt = document.createElement("option");
			opt.value = item.Pais;
			opt.textContent = item.Pais;
			dom.selectPais.appendChild(opt);
		});
		actualizarVisibilidadLimpiar();
	} catch (e) {
		dom.selectPais.innerHTML = `<option value="">Error al cargar</option>`;
		console.error(e);
	}
}

/**
 * Realiza una petición al backend para obtener la lista de organismos únicos disponibles.
 * Una vez obtenidos, puebla dinámicamente el selector (select) de organismos en el formulario.
 * @async
 * @param {string} [pais=""] - Nombre del país para filtrar los organismos.
 * @returns {Promise<void>}
 */
export async function cargarOrganismos(pais = "") {
	try {
		const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=organismos&pais=${encodeURIComponent(pais)}`);
		const data = await res.json();

		if (data && data.db_connection_error) {
			showDBErrorToast("Fallo al obtener catálogo de organismos.");
		}

		dom.selectOrganismo.innerHTML = `<option value="">Todos los organismos</option>`;
		data.forEach(item => {
			const opt = document.createElement("option");
			opt.value = item.Organismo;
			opt.textContent = item.Organismo;
			dom.selectOrganismo.appendChild(opt);
		});
		actualizarVisibilidadLimpiar();
	} catch (e) {
		dom.selectOrganismo.innerHTML = `<option value="">Error al cargar</option>`;
		console.error(e);
	}
}


/**
 * Obtiene la lista de provincias desde el servidor, opcionalmente filtrada por un organismo específico.
 * Actualiza el selector de provincias y trata de mantener la selección previa si esta sigue existiendo
 * en los nuevos resultados.
 * @async
 * @param {string} [organismo=""] - Nombre del organismo para filtrar las provincias.
 * @param {string} [pais=""] - Nombre del país para filtrar las provincias.
 * @returns {Promise<void>}
 */
export async function cargarProvincias(organismo = "", pais = "") {
	try {
		const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=provincias&organismo=${encodeURIComponent(organismo)}&pais=${encodeURIComponent(pais)}`);
		const data = await res.json();

		if (data && data.db_connection_error) {
			showDBErrorToast("Fallo al obtener catálogo de provincias.");
		}

		const valorActual = dom.selectProvincia.value;
		dom.selectProvincia.innerHTML = `<option value="">Todas las provincias</option>`;
		data.forEach(item => {
			const opt = document.createElement("option");
			opt.value = item.Provincia;
			opt.textContent = item.Provincia;
			dom.selectProvincia.appendChild(opt);
		});
		if (data.some(item => item.Provincia === valorActual)) {
			dom.selectProvincia.value = valorActual;
		}
		actualizarVisibilidadLimpiar();
	} catch (e) {
		dom.selectProvincia.innerHTML = `<option value="">Error al cargar</option>`;
		console.error(e);
	}
}

/**
 * Carga el catálogo de errores desde el servidor para poblar el selector del modal.
 * @async
 * @returns {Promise<void>}
 */
export async function cargarErrores() {
	try {
		const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=errores`);
		const data = await res.json();

		if (data && data.db_connection_error) {
			showDBErrorToast("Fallo al obtener catálogo de tipos de error.");
		}

		const select = document.getElementById("modalCodigoErrorSelect");
		if (!select) return;

		select.innerHTML = `<option value="">Seleccione un error...</option>`;
		data.forEach(item => {
			const opt = document.createElement("option");
			opt.value = item.Codigo;
			opt.textContent = `${item.Codigo} - ${item.Descripcion}`;
			select.appendChild(opt);
		});
	} catch (e) {
		console.error("Error al cargar catálogo de errores:", e);
	}
}

dom.selectPais?.addEventListener("change", () => {
	cargarOrganismos(dom.selectPais.value);
	cargarProvincias(dom.selectOrganismo.value, dom.selectPais.value);
	actualizarVisibilidadLimpiar();
});

dom.selectOrganismo?.addEventListener("change", () => {
	cargarProvincias(dom.selectOrganismo.value, dom.selectPais.value);
	actualizarVisibilidadLimpiar();
});

dom.selectProvincia?.addEventListener("change", () => {
	actualizarVisibilidadLimpiar();
});

dom.limpiarFiltrosBtn?.addEventListener("click", () => {
	dom.selectPais.value = "";
	dom.selectOrganismo.value = "";
	dom.selectProvincia.value = "";
	cargarOrganismos("");
	cargarProvincias("", "");
	actualizarVisibilidadLimpiar();
});


// ---- Fetch + render ----


/**
 * Función principal de sincronización de datos. Realiza lo siguiente:
 * 1. Aborta peticiones anteriores pendientes.
 * 2. Solicita el dataset de máquinas y logs filtrado por los criterios actuales.
 * 3. Compara estados para detectar cambios y disparar animaciones visuales.
 * 4. Orquesta el renderizado de KPIs, errores activos y la vista (Tabla o Presentación).
 * @async
 * @returns {Promise<void>}
 */
export async function fetchAndRenderData() {
	// Cancelamos cualquier petición anterior que todavía esté en vuelo
	if (appState.currentController) appState.currentController.abort();
	appState.currentController = new AbortController();

	try {
		// Realizamos la llamada al backend con los filtros actuales de estado
		const res = await fetch(
			`${CONFIG.API_ENDPOINT}?modo=maquinas&pais=${encodeURIComponent(appState.filtroPais)}&organismo=${encodeURIComponent(appState.filtroOrganismo)}&provincia=${encodeURIComponent(appState.filtroProvincia)}`, {
				signal: appState.currentController.signal
			}
		);
		const response = await res.json();

		const dataString = JSON.stringify(response);
		let hayCambioVisual = dataString !== appState.lastDataHash;

		// Si los datos del servidor son iguales, comprobamos si hay cambios por tiempo (10 min)
		if (!hayCambioVisual && appState.datosTabla.length > 0) {
			for (const m of appState.datosTabla) {
				const claseActual = m._estado.clase;
				const nuevaClase = getClaseConexion(m);
				
				// Si una máquina ha cambiado de estado solo por el paso del tiempo
				if (claseActual !== nuevaClase) {
					hayCambioVisual = true;
					break; 
				}
			}
		}

		// Si no hay cambios en los datos NI cambios por tiempo, salimos.
		if (!hayCambioVisual) {
			limpiarTrends();
			return;
		}

		appState.lastDataHash = dataString;

		// Reconstruimos el array de objetos a partir del formato optimizado (cols/rows)
		let data = response;
		if (response && response.cols && response.rows) {
			const colCount = response.cols.length;
			data = response.rows.map(row => {
				const obj = {};
				// Usamos un bucle for clásico para máxima velocidad en la reconstrucción
				for (let i = 0; i < colCount; i++) {
					const colName = response.cols[i];
					obj[colName] = row[i];
				}
				// Pre-calculamos el estado una sola vez para ahorrar CPU en renderizados
				obj._estado = getEstadoControl(obj);
				obj._tooltip = getTooltipEstado(obj);
				return obj;
			});
		}

		// Validación de seguridad: Si el backend devuelve un objeto de error en lugar de un array
		if (!Array.isArray(data)) {
			if (data && data.db_connection_error) {
				showDBErrorToast("No se pudo conectar con el servidor SQL principal.");
			}
			
			let errorDetail = data.error;
			if (Array.isArray(errorDetail)) {
				// Extraemos los mensajes de error de la estructura de sqlsrv_errors()
				errorDetail = errorDetail.map(e => e.message || JSON.stringify(e)).join(" | ");
			} else if (typeof errorDetail === 'object' && errorDetail !== null) {
				errorDetail = JSON.stringify(errorDetail);
			}
			
			const msg = errorDetail || "La respuesta del servidor no es un listado válido.";
			throw new Error(msg);
		}

		// Identificamos el estado de cada máquina para comparar cambios
		const nuevosEstados = {};
		data.forEach(m => {
			nuevosEstados[m.NumeroSerie] = m._estado.clase;
		});

		const maquinasCambiadas = new Set();
		if (Object.keys(appState.prevEstados).length > 0) {
			data.forEach(m => {
				// Si el estado visual (clase CSS) ha cambiado, la añadimos para animar la fila
				if (appState.prevEstados[m.NumeroSerie] && appState.prevEstados[m.NumeroSerie] !== m._estado.clase) {
					maquinasCambiadas.add(m.NumeroSerie);
				}
			});
		}
		appState.prevEstados = nuevosEstados;
		appState.datosTabla = data;

		// Si es la primera carga con datos, extraemos dinámicamente las columnas de la tabla
		if (data.length > 0 && appState.columnasTabla.length === 0) {
			appState.columnasTabla = Object.keys(data[0]).filter(col =>
				!col.startsWith('_') && col !== "UltimoControl" && col !== "MonitorizarEstado" &&
				col !== "NumeroSerie" && col !== "MonitorizarAlertas" && col !== "Logs" && col !== "TipoMaquina" &&
				col !== "CodOrganismo" && col !== "CodProvincia" && col !== "CodCliente"
			);
		} else if (data.length === 0) {
			appState.columnasTabla = [];
		}

		// Renderizado de componentes globales
		renderKPIs(data);

		if (!appState.modoPresentacion) {
			renderLogsNormal(data);
		}

		// Decidimos qué vista renderizar según el modo actual
		if (appState.modoPresentacion) {
			calcularMaxLineas();
			appState.paginasPresentacion = construirPaginasPresentacion(data);
			if (appState.paginaPresentacionActual >= appState.paginasPresentacion.length) appState.paginaPresentacionActual = 0;
			renderPresentacion();
		} else {
			renderTabla(maquinasCambiadas);
			dom.tabla.style.display = "table";
		}

		// Si el modal de un error está abierto, actualizamos su información en tiempo real
		if (appState.currentModalData) {
			actualizarDatosModal();
		}

		// Actualizamos el mensaje de estado en la parte inferior de los filtros
		let msg = `${data.length} máquina${data.length !== 1 ? "s" : ""} total${data.length !== 1 ? "es" : ""}`;
		if (appState.filtroOrganismo && appState.filtroProvincia) msg += ` — "${appState.filtroOrganismo}" en "${appState.filtroProvincia}"`;
		else if (appState.filtroOrganismo) msg += ` — "${appState.filtroOrganismo}"`;
		else if (appState.filtroProvincia) msg += ` — "${appState.filtroProvincia}"`;
		dom.estadoTabla.textContent = msg;

	} catch (error) {
		if (error.name === "AbortError") return;
		dom.estadoTabla.textContent = "Error al cargar los datos.";
		console.error("Error al actualizar datos:", error);
		detenerActualizacionEstado();
	}
}