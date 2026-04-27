/**
 * Módulo: searchMaster.js
 * Gestiona el modal de búsqueda maestra (F2).
 */
import { CONFIG } from '../config.js';
import * as dom from './dom.js';
import { appState } from './state.js';
import { cargarOrganismos, cargarProvincias } from './api.js';

/**
 * Estado local para resultados de búsqueda y caché de catálogos.
 */
const state = {
	data: [],
	filtered: [],
	index: -1,
	cache: {}
};

let externalCallback = null;
let searchTimeout = null;

/**
 * Abre el buscador desde otro módulo (ej. MachineMaster) 
 * y define qué hacer con el resultado seleccionado.
 * @param {string} entity - Tipo de entidad a buscar.
 * @param {Function} callback - Función a ejecutar con el registro seleccionado.
 */
export function openSearchMasterExternally(entity, callback) {
	externalCallback = callback;
	const entidadSelect = document.getElementById("smEntidad");
	entidadSelect.value = entity;
	entidadSelect.disabled = true; // Bloquear cambio de entidad si se abre para un campo específico
	openSearchMaster();
}

/**
 * Inicializa los eventos del buscador maestro, incluyendo atajos de teclado y listeners de UI.
 */
export function initSearchMaster() {
	const modal = document.getElementById("modalBusqueda");
	const input = document.getElementById("smInput");
	const entidad = document.getElementById("smEntidad");
	const criterio = document.getElementById("smCriterio");
	const matchMode = document.getElementById("smMatchMode");

	// Configuración inicial predefinida (Código / Número Serie)
	criterio.value = 'codigo';
	document.getElementById("smMatchContainer").style.visibility = 'hidden';

	/**
	 * Gestor de teclado global para el buscador.
	 * e.stopImmediatePropagation() evita que el Escape cierre otros modales abiertos.
	 */
	document.addEventListener("keydown", async (e) => {
		if (e.key === "F2" && !appState.modoPresentacion) {
			e.preventDefault();
			openSearchMaster();
		}
		if (modal.style.display === "flex") {
			if (e.key === "ArrowLeft" || e.key === "PageUp") navigate(-1);
			if (e.key === "ArrowRight" || e.key === "PageDown") navigate(1);
			if (e.key === "ArrowUp" || e.key === "Home") navigate('first');
			if (e.key === "ArrowDown" || e.key === "End") navigate('last');
			if (e.key === "Escape") {
				e.stopImmediatePropagation();
				closeSearchMaster();
			}
			if (e.key === "Enter") {
				if (e.target === input) performSearch();
				else await selectCurrent();
			}
		}
	});

	// Eventos de UI
	document.getElementById("cerrarBusquedaBtn").onclick = closeSearchMaster;

	if (dom.buscadorMaestroBtn) {
		dom.buscadorMaestroBtn.onclick = openSearchMaster;
	}

	entidad.onchange = () => {
		const val = entidad.value;
		const isMaquina = val === 'maquinas';
		const isError = val === 'errores'; // New
		const isPais = val === 'paises'; // New
		const crit = document.getElementById("smCriterio");
		
		crit.options[0].textContent = isMaquina ? "Número Serie" : "Código";
		// If it's a machine or error, the 'name' field is 'Descripción', otherwise it's 'Nombre'
		crit.options[1].textContent = (isMaquina || isError) ? "Descripción" : "Nombre"; 
		input.value = ""; // Limpiar búsqueda al cambiar de entidad manualmente
		loadCategoryData(entidad.value);
	};
	criterio.onchange = () => {
		document.getElementById("smMatchContainer").style.visibility = (criterio.value === 'codigo') ? 'hidden' : 'visible';
		input.value = "";
		performSearch();
	};
	input.oninput = () => {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			performSearch();
		}, CONFIG.DEBOUNCE_MS);
	};

	// Botones navegación
	document.getElementById("smBtnFirst").onclick = () => navigate('first');
	document.getElementById("smBtnPrev").onclick = () => navigate(-1);
	document.getElementById("smBtnNext").onclick = () => navigate(1);
	document.getElementById("smBtnLast").onclick = () => navigate('last');
	document.getElementById("smBtnSeleccionar").onclick = async () => await selectCurrent();
}

/**
 * Abre el modal de búsqueda y enfoca el campo de entrada.
 */
async function openSearchMaster() {
	const modal = document.getElementById("modalBusqueda");
	const entidadSelect = document.getElementById("smEntidad");
	const input = document.getElementById("smInput");

	// Si se abre de forma normal (F2 o botón principal), permitimos cambiar entidad
	if (!externalCallback) {
		entidadSelect.disabled = false;
	}

	input.value = ""; // Limpiar búsqueda al abrir el buscador para evitar residuos
	modal.style.display = "flex";
	document.body.style.overflow = "hidden";
	await loadCategoryData(entidadSelect.value);
	input.focus();
}

/**
 * Cierra el modal y restaura el scroll.
 */
function closeSearchMaster() {
	clearTimeout(searchTimeout); // Cancelar búsqueda pendiente si existe
	document.getElementById("modalBusqueda").style.display = "none";
	document.body.style.overflow = "";
	externalCallback = null; // Limpiar callback al cerrar para resetear estado
}

/**
 * Recupera los datos de la entidad seleccionada, usando caché si está disponible.
 * @async
 * @param {string} type - El tipo de entidad a cargar.
 */
async function loadCategoryData(type) {
	if (state.cache[type]) {
		state.data = state.cache[type];
	} else {
		const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=maestro&tipo=${type}`);
		state.data = await res.json();
		state.cache[type] = state.data;
	}
	performSearch();
}

/**
 * Filtra los datos cargados según el texto, criterio y modo de coincidencia.
 */
function performSearch() {
	const val = document.getElementById("smInput").value.trim().toLowerCase();
	const crit = document.getElementById("smCriterio").value;
	const mode = document.getElementById("smMatchMode").value;
	const type = document.getElementById("smEntidad").value;

	if (!val) {
		state.filtered = state.data;
	} else {
		if (crit === 'codigo') {
			state.filtered = state.data.filter(item => String(item.Codigo).includes(val));
		} else {
			state.filtered = state.data.filter(item => {
				const nombre = item.Nombre.toLowerCase();
				return mode === 'start' ? nombre.startsWith(val) : nombre.includes(val);
			});
		}
	}

	state.index = state.filtered.length > 0 ? 0 : -1;
	updateDisplay();
}

/**
 * Navega por los resultados filtrados.
 * @param {number|'first'|'last'} dir - Dirección de navegación.
 */
function navigate(dir) {
	if (state.filtered.length === 0) return;
	if (dir === 'first') state.index = 0;
	else if (dir === 'last') state.index = state.filtered.length - 1;
	else {
		state.index += dir;
		if (state.index < 0) state.index = state.filtered.length - 1;
		if (state.index >= state.filtered.length) state.index = 0;
	}
	updateDisplay();
}

/**
 * Actualiza la información visual (Código, Nombre y Contador) en el modal.
 */
function updateDisplay() {
	const res = state.filtered[state.index];
	const codeEl = document.getElementById("smResCodigo");
	const nameEl = document.getElementById("smResNombre");
	const countEl = document.getElementById("smCount");

	if (res) {
		codeEl.textContent = res.Codigo;
		nameEl.textContent = res.Nombre;
		countEl.textContent = `${state.index + 1} / ${state.filtered.length}`;
	} else {
		codeEl.textContent = "-";
		nameEl.textContent = "No hay coincidencias";
		countEl.textContent = "0 / 0";
	}
}

/**
 * Finaliza la búsqueda enviando el resultado al callback externo 
 * o aplicando los filtros a la pantalla principal.
 * @async
 */
async function selectCurrent() {
	const res = state.filtered[state.index];
	if (!res) return;

	const entidad = document.getElementById("smEntidad").value;

	if (externalCallback) {
		externalCallback(res);
		externalCallback = null;
		closeSearchMaster();
		return;
	}

	// Mapear selección al formulario principal respetando la jerarquía
	if (entidad === 'paises') {
		dom.selectPais.value = res.Nombre;
		// Al seleccionar un país, cargamos sus organismos y provincias y reseteamos selecciones hijas
		await cargarOrganismos(res.Nombre);
		await cargarProvincias("", res.Nombre);
		dom.selectOrganismo.value = "";
		dom.selectProvincia.value = "";
	} else if (entidad === 'organismos') {
		// Ponemos país en "Todos" para asegurar que el organismo sea visible en el combo
		dom.selectPais.value = "";
		await cargarOrganismos("");
		dom.selectOrganismo.value = res.Nombre;
		// Cargamos las provincias de este organismo
		await cargarProvincias(res.Nombre, "");
		dom.selectProvincia.value = "";
	} else if (entidad === 'provincias') {
		// Las provincias del maestro incluyen el campo 'Pais'
		if (res.Pais) {
			dom.selectPais.value = res.Pais;
			await cargarOrganismos(res.Pais);
		} else {
			dom.selectPais.value = "";
			await cargarOrganismos("");
		}
		// Reseteamos organismo para ver la provincia de forma global en ese país
		dom.selectOrganismo.value = "";
		await cargarProvincias("", dom.selectPais.value);
		dom.selectProvincia.value = res.Nombre;
	} else if (entidad === 'maquinas') {
		// Para máquinas, usamos el buscador de texto libre
		if (dom.searchInput) {
			dom.searchInput.value = res.Codigo; // Usamos el SN para búsqueda exacta
			dom.searchInput.dispatchEvent(new Event('input'));
		}
	} else {
		// Fallback genérico (Clientes, Errores...) al buscador de texto
		if (dom.searchInput) {
			dom.searchInput.value = res.Nombre;
			dom.searchInput.dispatchEvent(new Event('input'));
		}
	}

	// Disparamos la búsqueda principal automáticamente
	dom.form.dispatchEvent(new Event('submit'));
	closeSearchMaster();
}