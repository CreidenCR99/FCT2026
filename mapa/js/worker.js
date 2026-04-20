/**
 * Web Worker: worker.js
 * Procesa las peticiones a la API y la lógica de datos pesada en un hilo separado
 * para no bloquear las animaciones de la interfaz de usuario.
 */

self.onmessage = async (e) => {
  const { mode, url, payload } = e.data;

  try {
    const response = await fetch(url);
    
    if (response.status === 304) {
      self.postMessage({ mode, status: 304 });
      return;
    }

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const data = await response.json();

    if (mode === 'mapa_data') {
      const { provincias, alertas } = data;

      // Lógica de ordenación pesada (Prioridad: Rojo > Naranja)
      alertas.sort((a, b) => {
        if (a.status === 'rojo' && b.status !== 'rojo') return -1;
        if (a.status !== 'rojo' && b.status === 'rojo') return 1;
        return 0;
      });

      // Identificar nuevas alertas comparando con el estado anterior enviado desde el main thread
      // Structured Clone permite pasar Sets entre hilos en navegadores modernos
      const lastAlertsSet = payload.lastAlerts;
      const newAlerts = alertas.filter(a => !lastAlertsSet.has(a.sn));

      // Devolvemos los datos ya procesados y listos para inyectar en el DOM
      self.postMessage({
        mode,
        status: 200,
        provincias,
        alertas,
        newAlerts
      });
    } else {
      self.postMessage({ mode, status: 200, data });
    }
  } catch (error) {
    self.postMessage({ mode, status: 500, error: error.message });
  }
};