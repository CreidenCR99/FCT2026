/**
 * Módulo dom.js: Centraliza las referencias a los elementos del DOM para evitar consultas repetitivas.
 */

// --- Elementos del DOM ---

export const form                 = document.getElementById("form");                 // Formulario principal de búsqueda y filtros
export const selectOrganismo      = document.getElementById("organismo");            // Selector desplegable para filtrar por Organismo
export const selectProvincia      = document.getElementById("provincia");            // Selector desplegable para filtrar por Provincia
export const tablaSection         = document.getElementById("tablaSection");         // Sección contenedora de la tabla y resultados
export const tabla                = document.getElementById("tablaDatos");           // Elemento tabla principal
export const tablaWrapper         = document.getElementById("tablaWrapper");         // Contenedor con scroll para la tabla
export const thead                = tabla.querySelector("thead");                    // Cabecera de la tabla principal
export const tbody                = tabla.querySelector("tbody");                    // Cuerpo de la tabla principal donde se insertan las filas
export const estadoTabla          = document.getElementById("estadoTabla");          // Párrafo descriptivo del estado actual de la tabla (conteo de máquinas)
export const paginacionInfo       = document.getElementById("paginacionInfo");       // Span informativo sobre la página actual en modo presentación
export const modoPresentacionBtn  = document.getElementById("modoPresentacionBtn");  // Botón para activar el modo pantalla completa
export const limpiarFiltrosBtn    = document.getElementById("limpiarFiltrosBtn");    // Botón para resetear los filtros de búsqueda
export const salirPresentacionBtn = document.getElementById("salirPresentacionBtn"); // Botón para cerrar el modo presentación
export const presentacionLista    = document.getElementById("presentacionLista");    // Contenedor principal de la vista de presentación (pantalla completa)
export const indicadorReproduccion= document.getElementById("indicadorReproduccion");// Elemento flotante que indica si la rotación está en pausa o reproducción
export const searchInput          = document.getElementById("searchInput");          // Input de búsqueda de texto libre para filtrar la tabla
export const exportCsvBtn         = document.getElementById("exportCsvBtn");         // Botón para exportar los datos visibles a formato CSV
export const kpiSection           = document.getElementById("kpiSection");           // Contenedor de las tarjetas de indicadores clave (KPIs)
export const progressBar          = document.getElementById("progressBar");          // Barra de progreso visual del intervalo de refresco
export const themeToggle          = document.getElementById("themeToggle");          // Botón para alternar entre modo claro y oscuro
export const logsNormalSection    = document.getElementById("logsNormalSection");    // Sección que muestra los errores activos fuera de la tabla
export const modalLog             = document.getElementById("modalLog");             // Contenedor del modal para gestionar logs y errores
export const formEdicionLog       = document.getElementById("formEdicionLog");       // Formulario interno del modal de edición de errores
export const cancelarEdicionBtn   = document.getElementById("cancelarEdicionBtn");   // Botón de cancelar dentro del modal
export const cerrarModalBtn       = document.getElementById("cerrarModalBtn");       // Botón de cierre (X) del modal
export const backToTopBtn         = document.getElementById("backToTop");            // Botón flotante para subir rápidamente al inicio de la página
export const floatingLogo         = document.getElementById("floatingLogo");         // Logo flotante que aparece al hacer scroll
export const registroMaquinasBtn  = document.getElementById("registroMaquinasBtn");  // Botón Maestro de Máquinas
export const buscadorMaestroBtn   = document.getElementById("buscadorMaestroBtn");   // Botón Buscador Maestro (F2)
