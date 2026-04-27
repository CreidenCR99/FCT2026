/**
 * @module utils.js
 * @description Conjunto de funciones de utilidad pura y cálculos de estado.
 * Proporciona herramientas para sanitización XSS, formateo de fechas,
 * detección de estados de conexión y normalización de tipos de datos.
 */
import { CONFIG } from '../config.js';

/**
 * Normaliza la comprobación de valores "falsos" o "nulos" que pueden venir de la base de datos como strings.
 * @param {any} valor - El valor a evaluar.
 * @returns {boolean}
 */
export function esFalso(valor) {
	if (valor === null || typeof valor === "undefined") return true;
	if (typeof valor === "boolean") return !valor;
	const v = String(valor).trim().toLowerCase();
	return v === "0" || v === "false" || v === "null" || v === "undefined" || v === "";
}

/**
 * Convierte una cadena de texto con formato YYYYMMDDHHMM en un objeto Date de JS.
 * @param {string|number} valor - El valor temporal en formato compacto.
 * @returns {Date|null}
 */
export function parseUltimoControl(valor) {
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

/**
 * Obtiene únicamente la clase de conexión (verde/rojo/gris) basándose en la última fecha de reporte.
 * @param {Object} fila - Datos de la máquina.
 * @returns {string} Clase CSS del estado de conexión.
 */
export function getClaseConexion(fila) {
	const fechaControl = parseUltimoControl(fila.UltimoControl);
	if (!fechaControl || Number.isNaN(fechaControl.getTime())) return "estado-gris";
	if ((new Date() - fechaControl) / 60000 < CONFIG.OFFLINE_THRESHOLD_MINUTES) return "estado-verde";
	return "estado-rojo";
}

/**
 * Determina el estado de salud de una máquina basándose en su última conexión y alertas.
 * @param {Object} fila - Objeto con los datos de la máquina.
 * @returns {{texto: string, clase: string}}
 */
export function getEstadoControl(fila) {
	const tieneErroresActivos = !esFalso(fila.MonitorizarAlertas) &&
		(fila.Logs || []).some(l => !esFalso(l.Activo));

	if (tieneErroresActivos) return {
		texto: "⚠",
		clase: "estado-naranja"
	};

	const clase = getClaseConexion(fila);
	const texto = clase === "estado-verde" ? "✓" : (clase === "estado-rojo" ? "!" : "?");
	return {
		texto,
		clase
	};
}

/**
 * Construye el texto informativo para el tooltip de la pill de estado.
 * @param {Object} fila - Datos de la máquina.
 * @returns {string}
 */
export function getTooltipEstado(fila) {
	const fecha = parseUltimoControl(fila.UltimoControl);
	if (!fecha) return "Sin fecha de control";
	const pad = n => String(n).padStart(2, "0");
	return `Último control: ${pad(fecha.getDate())}/${pad(fecha.getMonth()+1)}/${fecha.getFullYear()} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
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

/**
 * Formatea un TimeStamp YYYYMMDDHHMMSS para mostrar en la UI.
 * @param {string|number} ts - Timestamp de 14 dígitos.
 * @returns {string} Fecha formateada DD/MM/YYYY HH:MM:SS.
 */
export function formatTimeStamp(ts) {
	if (!ts || String(ts).length < 14) return ts || "-";
	const s = String(ts);
	return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/**
 * Extrae la lista de errores que requieren atención técnica.
 * @param {Array<Object>} data - El dataset completo de máquinas.
 * @returns {Array<Object>} Lista de objetos con la estructura { maquina, log }.
 */
export function obtenerErroresActivos(data) {
	const errores = [];
	data.filter(m => !esFalso(m.MonitorizarAlertas)).forEach(m => {
		(m.Logs || []).filter(log => !esFalso(log.Activo)).forEach(log => {
			errores.push({ maquina: m, log: log });
		});
	});
	return errores;
}