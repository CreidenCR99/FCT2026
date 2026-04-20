/**
 * Módulo: main.js
 * Orquestador principal de la aplicación de monitoreo.
 */
import { appState, CONFIG } from './state.js';
import { cargarPaises, actualizarDatos } from './api.js';
import { mostrarSkeleton, aplicarFiltroHorario, actualizarTimers } from './ui.js';
import { navegarPais, togglePausa, enfocarPais } from './navigation.js';

// --- Inicialización del Sistema ---

/**
 * Inicializa los mapas, carga datos base y arranca los temporizadores de actualización.
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  // Inicialización con bloqueo total de interacción manual para el operador
  appState.map = L.map("map", { 
    zoomControl: false, 
    preferCanvas: true,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false 
  }).setView([40, -3], 2.5);
  
  // Inicializamos el insetMap con una vista por defecto (Canarias) para que empiece a descargar teselas de inmediato
  appState.insetMap = L.map("inset-map", { 
    zoomControl: false, 
    attributionControl: false, 
    dragging: false, 
    scrollWheelZoom: false, 
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
    preferCanvas: true 
  }).setView([28.4, -16.2], 6);

  // Definimos las capas base para ambos mapas
  const baseTiles = L.tileLayer(CONFIG.MAP_TILES, { attribution: CONFIG.ATTRIBUTION, className: "dark-tiles", ext: 'png' });
  const insetTiles = L.tileLayer(CONFIG.MAP_TILES, { className: "dark-tiles", ext: 'png' });

  /**
   * Sincronización de carga: Esperamos a que ambos mapas (principal e inset) hayan descargado sus teselas iniciales.
   */
  const tilesCargadas = Promise.all([
    new Promise(res => baseTiles.once('load', res)),
    new Promise(res => insetTiles.once('load', res))
  ]);

  // Race contra un timeout de seguridad
  const listoParaMostrar = Promise.race([
    tilesCargadas,
    new Promise(res => setTimeout(res, 3000))
  ]);

  baseTiles.addTo(appState.map);
  L.tileLayer(CONFIG.TERRAIN_LINES, { minZoom: 5, maxZoom: 6.75, ext: 'png' }).addTo(appState.map);
  insetTiles.addTo(appState.insetMap);

  mostrarSkeleton();
  await cargarPaises();
  aplicarFiltroHorario();
  await actualizarDatos();

  // --- Registro de Eventos ---

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") navegarPais(1);
    if (e.key === "ArrowLeft") navegarPais(-1);
    if (e.key === "ArrowUp") enfocarPais(appState.paises[appState.paisActualIdx]);
  });

  document.getElementById("btn-prev").onclick = () => navegarPais(-1);
  document.getElementById("btn-next").onclick = () => navegarPais(1);
  document.getElementById("btn-pause").onclick = togglePausa;

  // Lógica para limpiar la cola de alertas
  document.getElementById("clear-queue-btn").onclick = () => {
    appState.alertQueue = [];
    const container = document.getElementById("queue-status-container");
    if (container) container.style.opacity = "0";
  };

  appState.dataInterval = setInterval(actualizarDatos, CONFIG.MS_DATOS);
  appState.rotacionInterval = setInterval(() => navegarPais(1), CONFIG.MS_ROTACION);

  appState.msNextData = CONFIG.MS_DATOS;
  appState.msNextRotation = CONFIG.MS_ROTACION;

  // --- Bucle de Animación de Alto Rendimiento (60 FPS) ---
  let ultimaMarcaTiempo = performance.now();
  
  const buclePrincipal = (marcaTiempoActual) => {
    const delta = marcaTiempoActual - ultimaMarcaTiempo;
    ultimaMarcaTiempo = marcaTiempoActual;

    actualizarTimers(delta);
    requestAnimationFrame(buclePrincipal);
  };
  requestAnimationFrame(buclePrincipal);

  // Esperamos la señal de los mapas listos antes del primer flyTo
  await listoParaMostrar;

  // Disparamos la animación de entrada del HUD
  document.body.classList.add('hud-visible');

  if (appState.paises.length > 0) {
    const espIdx = appState.paises.findIndex(p => p.Nombre.toLowerCase() === "españa");
    appState.paisActualIdx = espIdx !== -1 ? espIdx : 0;
    enfocarPais(appState.paises[appState.paisActualIdx]);
  }
}

document.addEventListener("DOMContentLoaded", init);
