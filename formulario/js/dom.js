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

// --- Elementos para el Maestro de Máquinas ---
export const modalMaquinas        = document.getElementById("modalMaquinas");
export const formMaquinasMaster   = document.getElementById("formMaquinasMaster");
export const mmNS                 = document.getElementById("mmNS");
export const mmDesc               = document.getElementById("mmDesc");
export const mmTipo               = document.getElementById("mmTipo");
export const mmNotas              = document.getElementById("mmNotas");
export const mmOrg                = document.getElementById("mmOrg");
export const mmCli                = document.getElementById("mmCli");
export const mmProv               = document.getElementById("mmProv");
export const mmMonEstado          = document.getElementById("mmMonEstado");
export const mmMonAlerta          = document.getElementById("mmMonAlerta");
export const mmActualizar         = document.getElementById("mmActualizar");
export const mmActivo             = document.getElementById("mmActivo");
export const mmOrgName            = document.getElementById("mmOrgName");
export const mmCliName            = document.getElementById("mmCliName");
export const mmProvName           = document.getElementById("mmProvName");

// --- Elementos del DOM para el nuevo modal de selección de registro ---
export const modalRegistroMaestro = document.getElementById("modalRegistroMaestro");
export const cerrarRegistroMaestroBtn = document.getElementById("cerrarRegistroMaestroBtn");
export const btnRegistroMaquina   = document.getElementById("btnRegistroMaquina");
export const btnRegistroOrganismo = document.getElementById("btnRegistroOrganismo");
export const btnRegistroProvincia = document.getElementById("btnRegistroProvincia");
export const btnRegistroCliente   = document.getElementById("btnRegistroCliente");
export const btnRegistroError     = document.getElementById("btnRegistroError");
export const btnRegistroPais      = document.getElementById("btnRegistroPais");

// --- Elementos del DOM para el modal de registro de Organismos ---
export const modalRegistroOrganismo = document.getElementById("modalRegistroOrganismo");
export const cerrarRegistroOrganismoBtn = document.getElementById("cerrarRegistroOrganismoBtn");
export const formRegistroOrganismo = document.getElementById("formRegistroOrganismo");
export const inputOrganismoCodigo = document.getElementById("inputOrganismoCodigo");
export const inputOrganismoNombre = document.getElementById("inputOrganismoNombre");
export const cancelarRegistroOrganismoBtn = document.getElementById("cancelarRegistroOrganismoBtn");

// --- Elementos del DOM para el modal de registro de Clientes ---
export const modalRegistroCliente = document.getElementById("modalRegistroCliente");
export const cerrarRegistroClienteBtn = document.getElementById("cerrarRegistroClienteBtn");
export const formRegistroCliente = document.getElementById("formRegistroCliente");
export const inputClienteCodigo = document.getElementById("inputClienteCodigo");
export const inputClienteNombre = document.getElementById("inputClienteNombre");
export const cancelarRegistroClienteBtn = document.getElementById("cancelarRegistroClienteBtn");

// --- Elementos del DOM para el modal de registro de Errores ---
export const modalRegistroError = document.getElementById("modalRegistroError");
export const cerrarRegistroErrorBtn = document.getElementById("cerrarRegistroErrorBtn");
export const formRegistroError = document.getElementById("formRegistroError");
export const inputErrorCodigo = document.getElementById("inputErrorCodigo");
export const inputErrorNombre = document.getElementById("inputErrorNombre");
export const cancelarRegistroErrorBtn = document.getElementById("cancelarRegistroErrorBtn");

// --- Elementos del DOM para el modal de registro de Países ---
export const modalRegistroPais = document.getElementById("modalRegistroPais");
export const cerrarRegistroPaisBtn = document.getElementById("cerrarRegistroPaisBtn");
export const formRegistroPais = document.getElementById("formRegistroPais");
export const inputPaisCodigo = document.getElementById("inputPaisCodigo");
export const inputPaisNombre = document.getElementById("inputPaisNombre");
export const inputPaisLongitud = document.getElementById("inputPaisLongitud");
export const inputPaisLatitud = document.getElementById("inputPaisLatitud");
export const cancelarRegistroPaisBtn = document.getElementById("cancelarRegistroPaisBtn");

// --- Elementos del DOM para el modal de registro de Provincias ---
export const modalRegistroProvincia = document.getElementById("modalRegistroProvincia");
export const cerrarRegistroProvinciaBtn = document.getElementById("cerrarRegistroProvinciaBtn");
export const formRegistroProvincia = document.getElementById("formRegistroProvincia");
export const inputProvinciaCodigo = document.getElementById("inputProvinciaCodigo");
export const inputProvinciaNombre = document.getElementById("inputProvinciaNombre");
export const inputProvinciaPais = document.getElementById("inputProvinciaPais");
export const labelProvinciaPais = document.getElementById("labelProvinciaPais");
export const inputProvinciaLongitud = document.getElementById("inputProvinciaLongitud");
export const inputProvinciaLatitud = document.getElementById("inputProvinciaLatitud");
export const cancelarRegistroProvinciaBtn = document.getElementById("cancelarRegistroProvinciaBtn");

// --- Elementos para el Maestro de Máquinas (Navegación) ---
export const mmBtnFirst    = document.getElementById("mmBtnFirst");
export const mmBtnPrev     = document.getElementById("mmBtnPrev");
export const mmBtnNext     = document.getElementById("mmBtnNext");
export const mmBtnLast     = document.getElementById("mmBtnLast");
export const mmBtnNuevo    = document.getElementById("mmBtnNuevo");
export const mmBtnEliminar = document.getElementById("mmBtnEliminar");
export const mmBtnBack     = document.getElementById("mmBtnBack");
export const mmCount       = document.getElementById("mmCount");
export const mmModalFooter = document.querySelector("#modalMaquinas .modal-footer-nav");
