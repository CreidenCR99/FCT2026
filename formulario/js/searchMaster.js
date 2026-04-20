/**
 * Módulo: searchMaster.js
 * Gestiona el modal de búsqueda maestra (F2).
 */
import * as dom from './dom.js';
import { appState } from './state.js';

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
 */
export function openSearchMasterExternally(entity, callback) {
	externalCallback = callback;
	const entidadSelect = document.getElementById("smEntidad");
	entidadSelect.value = entity;
	entidadSelect.disabled = true; // Bloquear cambio de entidad si se abre para un campo específico
	openSearchMaster();
}

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
	document.addEventListener("keydown", (e) => {
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
				else selectCurrent();
			}
		}
	});

	// Eventos de UI
	document.getElementById("cerrarBusquedaBtn").onclick = closeSearchMaster;

	if (dom.buscadorMaestroBtn) {
		dom.buscadorMaestroBtn.onclick = openSearchMaster;
	}

	entidad.onchange = () => {
		const isMaquina = entidad.value === 'maquinas';
		const crit = document.getElementById("smCriterio");
		// Ajustamos los índices tras el cambio de orden en el HTML
		crit.options[0].textContent = isMaquina ? "Número Serie" : "Código";
		crit.options[1].textContent = isMaquina ? "Descripción" : "Nombre";
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
		}, 250);
	};

	// Botones navegación
	document.getElementById("smBtnFirst").onclick = () => navigate('first');
	document.getElementById("smBtnPrev").onclick = () => navigate(-1);
	document.getElementById("smBtnNext").onclick = () => navigate(1);
	document.getElementById("smBtnLast").onclick = () => navigate('last');
	document.getElementById("smBtnSeleccionar").onclick = selectCurrent;
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
 */
async function loadCategoryData(type) {
	if (state.cache[type]) {
		state.data = state.cache[type];
	} else {
		const res = await fetch(`datos.php?modo=maestro&tipo=${type}`);
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
			// Auto-relleno de ceros según entidad (Excepto máquinas)
			let padded = val;
			if (type === 'maquinas') padded = val;
			else if (type === 'organismos') padded = val.padStart(4, '0');
			else if (type === 'provincias') padded = val.padStart(2, '0');
			else if (type === 'clientes') padded = val.padStart(5, '0');

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
 */
function selectCurrent() {
	const res = state.filtered[state.index];
	if (!res) return;

	const entidad = document.getElementById("smEntidad").value;

	if (externalCallback) {
		externalCallback(res);
		externalCallback = null;
		closeSearchMaster();
		return;
	}

	// Mapear selección al formulario principal
	if (entidad === 'organismos') {
		dom.selectOrganismo.value = res.Nombre;
		dom.selectOrganismo.dispatchEvent(new Event('change'));
	} else if (entidad === 'provincias') {
		// Para provincias, si el organismo no está seleccionado, podríamos tener problemas
		// pero el buscador maestro permite búsqueda global.
		dom.selectProvincia.value = res.Nombre;
	}

	// Disparamos la búsqueda principal automáticamente
	dom.form.dispatchEvent(new Event('submit'));
	closeSearchMaster();
}