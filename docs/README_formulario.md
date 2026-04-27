# SicoLares - Formulario de Gestión y Control

Sistema integral de administración y gestión de estados de máquinas. Esta aplicación permite visualizar en tiempo real el estado de conectividad, gestionar incidencias y administrar los catálogos maestros del sistema SicoLares.

## 🚀 Funcionalidades Principales

### 1. Panel de Control y KPIs
-   **KPIs en Tiempo Real**: Resumen visual (Total, Activas, Sin Respuesta, Errores) con animaciones fluidas.
-   **Búsqueda Dinámica**: Filtrado instantáneo por Organismo, Provincia o Texto libre.
-   **Buscador Maestro (F2)**: Acceso rápido a catálogos de Organismos, Provincias, Clientes y Máquinas. Las etiquetas se adaptan dinámicamente según el contexto de búsqueda.

### 2. Gestión de Errores e Incidencias
-   **Listado Activo**: Visualización inmediata de fallos detectados.
-   **Registro Manual**: Permite dar de alta errores para máquinas con fallos no monitorizados automáticamente.
-   **Edición de Logs**: Modal interactivo para actualizar estados (Activo/Inactivo) y añadir observaciones técnicas.
-   **Navegación Unificada**: Botonera de navegación (Primero, Anterior, Siguiente, Último) consistente en todos los maestros.

### 3. Modo Presentación (Pantalla Completa)
-   Diseñado para monitores de control o TVs en oficinas.
-   **Paginación Automática**: Ciclo continuo que recorre todo el parque de máquinas.
-   **Footer Dinámico**: Los errores críticos rotan en la parte inferior durante la presentación.
-   **Controles**: Pausa/Reanudación con `Espacio` y navegación manual con flechas.

### 4. Reportes y Exportación
-   **Exportación CSV (24h)**: Genera un reporte detallado de todos los errores ocurridos en las últimas 24 horas.
-   **Historial Completo**: Incluye tanto errores actualmente activos como los ya corregidos, con marcas de tiempo, organización, provincia y observaciones técnicas.
-   **Optimizado para Excel**: Soporta caracteres especiales y codificación universal para una visualización correcta.

---

## ⌨️ Atajos y Controles
Para una operación ágil en entornos profesionales, el sistema soporta los siguientes controles:

-   **`F1`**: Navegación Cruzada: Cambia instantáneamente al **Mapa de Monitoreo**.
-   **`F2`**: Abre el **Buscador Maestro** desde cualquier parte de la aplicación.
-   **`F3`**: Abre el selector de **Registros de Entidades** (Maestros).
-   **`F11`**: Alterna el **Modo Presentación** (Pantalla Completa).
-   **`Espacio`**: Pausa o reanuda la rotación de páginas en Modo Presentación.
-   **`Flechas ← / →`**: Cambia manualmente de página mientras estás en Modo Presentación o en un modal de busqueda.
-   **`Inicio / Fin`**: Ir al primer o último registro en un modal de busqueda.
-   **`Esc`**: Cierra rápidamente cualquier ventana modal o sale del Modo Presentación.
-   **Click en KPIs**: Al hacer click en las tarjetas superiores (Activas, Sin Respuesta, Errores), la tabla se filtrará automáticamente para mostrar solo esas máquinas.
-   **Click en Logo**: Navega instantáneamente al **Mapa de Monitoreo** (Navegación Cruzada).
-   **Navegación en Formularios**: Usa los botones de flecha en los modales para navegar entre registros sin cerrar la ventana.

## 🛠️ Tecnologías
-   **Frontend**: JS Vanilla (ES6 Modules), CSS Grid/Flexbox, SweetAlert2, Leaflet.
-   **Optimización**: Los datos se transfieren de forma segregada para minimizar el ancho de banda.
-   **Diseño**: Soporte nativo para Modo Oscuro y Claro basado en la preferencia del sistema.

---

## ⚙️ Configuración

Este proyecto utiliza la configuración centralizada definida en la raíz. Los valores que afectan directamente a esta aplicación son:

| Variable | Descripción | Valor Predefinido |
| :--- | :--- | :--- |
| `refresh_interval_ms` | Frecuencia de actualización de la tabla | 7500ms |
| `debounce_ms` | Retraso en la búsqueda mientras escribes | 250ms |
| `presentation_errors_per_page` | Errores visibles en modo presentación | 8 |
| `ui_table_animation_limit` | Límite de filas para animaciones de carga | 50 |

> [!NOTE]
> Para modificar estos valores, edita el archivo [config.ini](../config.ini) en la raíz del proyecto.

---

## 📂 Estructura de Archivos
-   `js/`: Lógica dividida en módulos (api, state, table, ui, presentation, etc.).
-   `css/`: Estilos modulares (layout, components, animations, theme).
-   `api/`: Endpoints PHP para la gestión de datos.
-   `config.js`: Archivo proxy que enlaza con la configuración central.

---
*Para instrucciones de instalación global, consulta el [README de la raíz](README_general.md).*
