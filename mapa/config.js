/**
 * @module config.js (Mapa)
 * @description Proxy de configuración para la aplicación de Mapa.
 * Importa y exporta las constantes de configuración, vistas de mapas secundarios (insets)
 * y proveedores de tiles definidos centralizadamente en PHP.
 */
import { CONFIG as C, INSET_VIEWS as I, MAPAS as M } from '../core/config.js.php';

export const CONFIG = C;
export const INSET_VIEWS = I;
export const MAPAS = M;