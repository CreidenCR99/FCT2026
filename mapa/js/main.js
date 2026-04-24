/**
 * Módulo: main.js
 * Orquestador principal de la aplicación de monitoreo.
 */
import { appState } from './state.js';
import { CONFIG, MAPAS } from '../config.js';
import { cargarPaises, actualizarDatos } from './api.js';
import { mostrarSkeleton, aplicarFiltroHorario, actualizarTimers } from './ui.js';
import { navegarPais, togglePausa, enfocarPais } from './navigation.js';
import { iniciarCarrusel } from './notifications.js';

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
    dragging: true,
    scrollWheelZoom: true,
    doubleClickZoom: false,
    touchZoom: true,
    boxZoom: false,
    keyboard: true 
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
  const baseTiles = L.tileLayer(MAPAS.MAP_TILES, { attribution: MAPAS.ATTRIBUTION, className: "dark-tiles", ext: 'png' });
  const insetTiles = L.tileLayer(MAPAS.MAP_TILES, { className: "dark-tiles", ext: 'png' });

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
  L.tileLayer(MAPAS.TERRAIN_LINES, { minZoom: 5, maxZoom: 6.9, ext: 'png' }).addTo(appState.map);
  L.tileLayer(MAPAS.TERRAIN_LINES, { minZoom: 7.1, maxZoom: 20, ext: 'png' }).addTo(appState.map);
  insetTiles.addTo(appState.insetMap);

  mostrarSkeleton();
  await cargarPaises();
  aplicarFiltroHorario();
  await actualizarDatos();
  iniciarCarrusel();

  // --- Registro de Eventos ---

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") navegarPais(1);
    if (e.key === "ArrowLeft") navegarPais(-1);
    if (e.key === "ArrowUp") enfocarPais(appState.paises[appState.paisActualIdx]);
    if (e.code === "Space") {
      e.preventDefault(); // Evitar scroll no deseado
      togglePausa();
    }
  });

  document.getElementById("btn-prev").onclick = () => navegarPais(-1);
  document.getElementById("btn-next").onclick = () => navegarPais(1);
  document.getElementById("btn-pause").onclick = togglePausa;

  appState.msNextData = CONFIG.MS_DATOS;
  appState.msNextRotation = CONFIG.MS_ROTACION_DEFAULT; // Se ajustará al enfocar el primer país

  // --- Lógica de Inactividad del Mapa ---
  const resetInactivityTimer = () => {
    // No resetear si el mapa se mueve por la rotación automática o INACTIVO es -1
    if (appState.isProgrammaticMove || CONFIG.INACTIVO == -1) return;
    clearTimeout(appState.inactivityTimeout);
    appState.inactivityTimeout = setTimeout(() => {
      enfocarPais(appState.paises[appState.paisActualIdx]);
    }, CONFIG.INACTIVO); // 30 segundos
  };

  appState.map.on('movestart zoomstart', resetInactivityTimer);
  appState.map.on('moveend zoomend', () => { appState.isProgrammaticMove = false; });

  // --- Bucle de Animación de Alto Rendimiento (60 FPS) ---
  let ultimaMarcaTiempo = performance.now();
  
  const buclePrincipal = (marcaTiempoActual) => {
    const delta = marcaTiempoActual - ultimaMarcaTiempo;
    ultimaMarcaTiempo = marcaTiempoActual;

    actualizarTimers(delta);

    // Control de ejecución: Si el tiempo expira, disparamos las acciones
    if (appState.msNextData <= 0 && !document.hidden) {
      actualizarDatos();
    }

    if (appState.msNextRotation <= 0 && !appState.estaPausado && !document.hidden) {
      navegarPais(1);
    }

    requestAnimationFrame(buclePrincipal);
  };
  requestAnimationFrame(buclePrincipal);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ultimaMarcaTiempo = performance.now();
  });

  // Esperamos la señal de los mapas listos antes del primer flyTo
  await listoParaMostrar;

  // Disparamos la animación de entrada del HUD
  document.body.classList.add('hud-visible');

  // Ocultar pantalla de carga
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.classList.add('hidden');

  if (appState.paises.length > 0) {
    const espIdx = appState.paises.findIndex(p => String(p.Codigo) === "724");
    appState.paisActualIdx = espIdx !== -1 ? espIdx : 0;
    enfocarPais(appState.paises[appState.paisActualIdx]);
  }
}

document.addEventListener("DOMContentLoaded", init);
