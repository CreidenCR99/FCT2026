/**
 * @module worker.js
 * @description Web Worker para el procesamiento de datos en segundo plano.
 * Realiza las peticiones fetch a la API, la reconstrucción de objetos y las
 * operaciones de ordenación pesada para mantener el hilo principal (UI) libre.
 */

self.onmessage = async (e) => {
  const { mode, url, payload } = e.data;

  try {
    const response = await fetch(url);
    
    if (response.status === 304) {
      self.postMessage({ mode, status: 304 });
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      self.postMessage({ 
        mode, 
        status: response.status, 
        error: errorData.error || `HTTP Error: ${response.status}`,
        db_connection_error: !!errorData.db_connection_error
      });
      return;
    }

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