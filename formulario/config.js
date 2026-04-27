/**
 * @module config.js (Formulario)
 * @description Proxy de configuración para la aplicación de Formulario.
 * Este archivo actúa como un puente hacia la configuración centralizada definida en el núcleo.
 * Los valores reales se generan dinámicamente desde PHP basándose en el archivo .ini global.
 */
import { CONFIG as C } from '../core/config.js.php';

export const CONFIG = C;