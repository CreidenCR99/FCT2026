# SicoLares - Mapa de Monitoreo en Tiempo Real

Visualización geográfica de alto impacto diseñada para salas de control. Este módulo permite supervisar globalmente el estado de las máquinas SicoLares mediante un mapa interactivo con rotación automática y alertas inteligentes.

## 🛰️ Funcionalidades Principales

### 1. Visualización Geográfica
-   **Mapa Dinámico**: Basado en Leaflet con capas de terreno y fronteras personalizadas.
-   **Clústeres de Alertas**: Agrupación automática de máquinas por provincia con indicadores de color (Verde, Naranja, Rojo).
-   **Inset Maps**: Ventanas secundarias para regiones remotas (ej: Islas Canarias) que permiten una visión completa sin perder el contexto global.

### 2. Automatización y Rotación
-   **Ciclo de Países**: Rotación automática de la cámara entre diferentes regiones configuradas.
-   **Retorno por Inactividad**: El sistema retoma la monitorización automática si no detecta interacción del usuario tras un tiempo definido.
-   **Zooms Adaptativos**: Ajuste fino del nivel de visualización según la densidad de máquinas de cada país.

### 3. Sistema de Alertas HUD (Glassmorphism)
-   **Carrusel de Errores**: Panel inferior que muestra detalles de las máquinas con fallos activos.
-   **Alertas Sonoras**: Sintetizador de audio integrado que emite tonos distintos para advertencias y errores críticos.
-   **Feedback Visual**: Efectos de pulso y brillo para alertas detectadas recientemente.

---

## 🖱️ Interacción y Controles
El mapa está diseñado para ser tanto autónomo como interactivo:

-   **`F1`**: Navegación Cruzada: Cambia instantáneamente al **Formulario de Gestión**.
-   **`Espacio`**: Pausa o reanuda la rotación de países.
-   **`Flechas ← / →`**: Cambia manualmente de país.
-   **`Flecha ↑ `**: Centra la vista en el país actual.
-   **Rotación Automática**: El mapa cambiará de país cada pocos minutos automáticamente.
-   **Click en Marcador**: Centra la cámara en la provincia y muestra sus estadísticas.
-   **Click en Alerta (Carrusel)**: Al pulsar sobre un error en el panel inferior, el mapa viajará instantáneamente a la máquina afectada.
-   **Arrastrar y Zoom**: Puedes explorar libremente usando el ratón. Al hacerlo, la rotación automática se pausará durante 30 segundos (configurable).
-   **Botón de Pausa (⏸/▶)**: Ubicado en la esquina superior, permite detener el ciclo de países indefinidamente.
-   **Click en Logo**: Navega instantáneamente al **Formulario de Gestión** (Navegación Cruzada).
-   **Doble Click**: Zoom rápido hacia el punto pulsado.

---

## 🛠️ Tecnologías y Optimización
-   **Motor de Actualización**: Uso de **Morphdom** para actualizar el mapa sin redibujar elementos innecesarios, garantizando estabilidad visual y rendimiento.
-   **Background Processing**: Un Web Worker gestiona el refresco de datos en un hilo secundario para no bloquear la interfaz.
-   **Caché Inteligente**: Implementación de **IndexedDB** para almacenar datos geográficos y **ETags** para evitar transferencias de datos innecesarios.

---

## ⚙️ Configuración

El comportamiento del mapa se gestiona desde el archivo central de configuración. Parámetros clave:

| Variable | Descripción | Valor Predefinido |
| :--- | :--- | :--- |
| `ms_rotacion_default` | Tiempo de estancia en cada país | 300000ms |
| `velocidad_carrusel` | Velocidad de rotación de alertas HUD | 20000ms |
| `sounds_volume` | Volumen maestro del sintetizador | 0.5 |
| `recent_threshold_ms` | Tiempo para considerar una alerta como "nueva" | 120000ms |

> [!NOTE]
> Para modificar estos valores, edita el archivo [config.ini](../config.ini) en la raíz del proyecto.

---

## 📂 Estructura de Archivos
-   `js/`: Módulos de mapa, navegación, notificaciones, sincronización y workers.
-   `css/`: Diseño basado en Glassmorphism y animaciones.
-   `api/`: Endpoints especializados en datos geográficos y estados agregados.
-   `config.js`: Archivo proxy que enlaza con la configuración central.

---
*Para instrucciones de instalación global, consulta el [README de la raíz](README_general.md).*
