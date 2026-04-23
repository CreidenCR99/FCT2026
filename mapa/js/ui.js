/**
 * Módulo: ui.js
 * Controla los elementos visuales de la interfaz, temporizadores y skeletons.
 */
import { appState } from './state.js';
import { CONFIG } from '../config.js';

/**
 * Inyecta estados de carga (skeletons) en los contenedores de texto.
 */
export function mostrarSkeleton() {
  document.getElementById("pais-nombre").innerHTML = '<div class="skeleton" style="width:15vw; height:4vh"></div>';
  document.getElementById("stats-info").innerHTML = '<div class="skeleton" style="width:20vw; height:1.8vh"></div>';
  document.getElementById("rotation-timer").innerHTML = '<div class="skeleton" style="width:10vw; height:3.5vh"></div>';
}

/**
 * Ajusta el tono del mapa mediante filtros CSS según la hora del sistema.
 */
export function aplicarFiltroHorario() {
  const hour = new Date().getHours();
  let filter = "brightness(0.25) contrast(1.5) saturate(0.4)"; // Noche default
  if (hour >= 6 && hour < 10) filter = "brightness(0.5) contrast(1.2) saturate(0.8) sepia(0.3) hue-rotate(-20deg)";
  else if (hour >= 10 && hour < 18) filter = "brightness(0.8) contrast(1.1) saturate(0.9)";
  else if (hour >= 18 && hour < 21) filter = "brightness(0.5) contrast(1.2) saturate(0.8) sepia(0.3) hue-rotate(20deg)";
  document.documentElement.style.setProperty('--map-filter', filter);
}

/**
 * Actualiza la barra de progreso y el cronómetro de rotación.
 * @param {number} delta - Tiempo transcurrido desde el último frame en milisegundos.
 * @returns {void}
 */
export function actualizarTimers(delta) {
  // Si la pestaña no está activa, pausamos todo el avance de tiempos
  if (document.hidden) return;

  // Barra de progreso superior
  const bar = document.getElementById("data-refresh-bar");
  if (bar) {
    const percData = ((CONFIG.MS_DATOS - appState.msNextData) / CONFIG.MS_DATOS) * 100;
    // Con rAF (16ms), la transición CSS ya no es estrictamente necesaria para la suavidad
    bar.style.transition = appState.msNextData >= CONFIG.MS_DATOS - 50 ? "none" : "width 0.1s linear";
    bar.style.width = `${Math.min(100, Math.max(0, percData))}%`;
  }
  appState.msNextData = Math.max(0, appState.msNextData - delta);

  if (appState.estaPausado) return;
  
  const prevRotationSec = Math.floor(appState.msNextRotation / 1000);
  appState.msNextRotation = Math.max(0, appState.msNextRotation - delta);
  const currentRotationSec = Math.floor(appState.msNextRotation / 1000);
  
  // Cronómetro de rotación
  const timerEl = document.getElementById("rotation-timer");
  if (timerEl && prevRotationSec !== currentRotationSec) {
    const totalSec = currentRotationSec;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const newText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    
    // Usamos morphdom para parchear solo el texto
    if (timerEl.textContent !== newText) timerEl.textContent = newText;

    // Feedback visual de urgencia
    timerEl.style.color = totalSec < 30 ? "#f00" : "#fff";
    timerEl.style.backgroundColor = totalSec < 30 ? "rgba(161, 7, 2, 0.4)" : "rgba(255, 255, 255, 0.05)";
    timerEl.classList.toggle('shake-timer', totalSec < 10 && totalSec > 0);
  }
}

/**
 * Calcula y renderiza el resumen de estados del país seleccionado usando morphdom.
 */
export function actualizarStatsUI() {
  if (!appState.paises.length || !appState.provincias.length) return;
  const paisActual = appState.paises[appState.paisActualIdx];
  const provs = appState.provincias.filter(p => 
    String(p.id_pais) === String(paisActual.id) || String(p.id_pais) === String(paisActual.Codigo)
  );

  let ok = 0, alerta = 0, rojo = 0;
  provs.forEach(p => {
    ok += p.counts.verde; alerta += p.counts.naranja; rojo += p.counts.rojo;
  });

  const statsEl = document.getElementById("stats-info");
  if (statsEl && typeof morphdom === 'function') {
    const newContent = `<span><b style="color:var(--kpi-ok-color)">${ok}</b> Activos   <b style="color:var(--kpi-log-color)">${alerta}</b> Errores   <b style="color:var(--kpi-alerta-color); text-shadow: 1px 1px 0 rgba(255,255,255,0.05), -1px -1px 0 rgba(255,255,255,0.05), 1px -1px 0 rgba(255,255,255,0.05), -1px 1px 0 rgba(255,255,255,0.05);">${rojo}</b> Sin respuesta</span>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newContent;
    morphdom(statsEl, tempDiv, { childrenOnly: true });
  }
}

/**
 * Sincroniza el delay de la animación de la leyenda con el reloj global.
 * @returns {void}
 */
export function sincronizarLeyenda() {
  const syncDelay = -(performance.now() % 2000) / 1000;
  document.querySelectorAll('.legend .dot').forEach(dot => {
    dot.style.animationDelay = `${syncDelay}s`;
  });
}