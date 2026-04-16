# SicoLares - Control de Máquinas

Sistema de monitorización y gestión de estados de máquinas distribuido por organismos, provincias y clientes. Esta aplicación permite visualizar en tiempo real el estado de conectividad y los errores activos de un parque de máquinas.

## 1. Funcionalidades Principales

### 1.1. Panel de Control y Filtrado
- **Búsqueda Dinámica:** Filtrado de máquinas por Organismo y Provincia.
- **KPIs de Estado:** Resumen visual rápido que incluye:
  - Total de máquinas listadas.
  - Máquinas con estado **Activo** (Conectadas en los ultimos 10m).
  - Máquinas **Sin respuesta** (Alerta de conexión).
  - **Errores activos** detectados en el log de errores (filtrado por monitorización).

### 1.2. Gestión de Errores
- **Listado de Errores Activos:** Visualización inmediata de las máquinas que presentan fallos.
- **Registro de Nuevos Errores:** Permite dar de alta manualmente un error para máquinas con fallos desconocidos.
- **Edición de Logs:** Modal interactivo para actualizar el estado de un error (Activo/Inactivo) y añadir observaciones técnicas. Incluye visualización de Código de Error, Tipo de Máquina y Fecha/Hora exacta.
- **Navegación en Modal:** Botones de "Anterior" y "Siguiente" para gestionar múltiples errores de una misma máquina sin cerrar la ventana.
- **Campos Obligatorios:** Validación de Código de Error, Fecha y Hora para mantener la integridad de la base de datos.

### 1.3. Modo Presentación (Pantalla Completa)
- Diseñado para ser visualizado en monitores de control o TVs.
- **Paginación Automática:** Ciclo de pantallas que recorre todas las máquinas filtradas.
- **Visualización de Errores:** Espacio dedicado en la parte inferior para mostrar errores críticos durante la rotación.
- **Controles de Reproducción:** Posibilidad de pausar/reanudar con la tecla `Espacio` y navegar con las flechas del teclado.

### 1.4. Compresión y Rendimiento
- **Compresión Brotli/Gzip:** El servidor prioriza la compresión Brotli (Nivel 6) para reducir el tamaño del JSON hasta un 80%, con fallback automático a Gzip.
- **JSON Estructural Compacto:** Los datos viajan en formato de matriz de registros (`cols` y `rows`) para evitar la repetición de claves y minimizar el uso de ancho de banda.
- **Renderizado con Morphdom:** En lugar de reescribir el HTML por completo, el sistema "parchea" solo los nodos del DOM que han cambiado, preservando el scroll del usuario, el foco y las animaciones activas.
- **Gestión de Caché (ETags):** Implementación de cabeceras ETag para que el servidor responda con un `304 Not Modified` si los datos no han variado, eliminando transferencias innecesarias.
- **Debounce de Búsqueda:** El filtro de la tabla espera 250ms tras la última pulsación para evitar procesamientos pesados durante la escritura.
- **Delegación de Eventos:** Gestión de clics en la tabla mediante un único listener en el contenedor principal, optimizando el uso de memoria RAM.

### 1.5. Interfaz y Experiencia de Usuario
- **Modo Oscuro/Claro:** Soporte nativo para temas visuales que se adaptan a la preferencia del usuario o del entorno.
- **Refresco Automático:** Sincronización constante con el servidor cada 7.5 segundos con una barra de progreso visual.
- **Diseño Responsivo:** Interfaz adaptada mediante unidades relativas (`vh`/`vw`) para una escala perfecta en pantallas horizontales de distinta resolución.
- **Exportación:** Permite descargar los resultados actuales en formato CSV para reportes externos (incluye estado de conexión).
- **Animaciones y Fluidez Visual:** Implementación de microinteracciones para mejorar la respuesta visual:
  - **Entrada en Cascada:** Las filas de la tabla aparecen secuencialmente con un desplazamiento vertical suave (limitado a las primeras 50 filas para garantizar un alto rendimiento).
  - **Efecto Slide en Errores:** La sección de errores activos utiliza transiciones de `grid-template-rows` para expandirse y contraerse de forma fluida.
  - **Indicadores de Tendencia y brillo:** Flechas animadas (`▲`, `▼`) y brillo en los KPIs que indican si los valores han subido o bajado respecto al ciclo anterior, desapareciendo tras unos segundos si el dato se estabiliza.
  - **Movimientos Naturales:** Uso de curvas de interpolación `cubic-bezier` para que las transiciones se sientan orgánicas.


---

## 2. Requisitos del Sistema

- **Servidor Web:** XAMPP (Apache) o similar.
- **Base de Datos:** SQL Server con el driver `sqlsrv` habilitado en PHP.
- **Navegador:** Compatible con ES6+ (Chrome, Edge, Firefox, Safari).

---

## 3. Guía de Uso Rápido

1. **Consulta:** Seleccione un organismo o provincia en el formulario superior y pulse "Buscar".
2. **Monitorización:** Observe los KPIs para entender el estado general. La tabla se actualizará sola periódicamente.
3. **Gestión:** Si aparece un error en la sección naranja de "Errores Activos", haga clic sobre él para abrir el panel de gestión.
4. **Resolución:** Cambie el estado a "Solucionado" y añada notas sobre la intervención realizada.
5. **Exhibición:** Pulse el botón "Pantalla Completa" para activar el modo de monitorización continua.

---

## 4. Atajos de Teclado (Modo Presentación)

| Tecla | Acción |
|-------|--------|
| `Espacio` | Pausar / Reanudar la rotación automática |
| `Flecha Derecha` | Siguiente página |
| `Flecha Izquierda` | Página anterior |
| `Esc` | Salir del modo presentación / Cerrar modales |

---

# Documentación Técnica

## 1. Arquitectura del Frontend (JavaScript Moderno)

La aplicación está construida utilizando **Módulos de JavaScript (ESM)**, lo que permite una separación de responsabilidades clara y facilita el mantenimiento.

### 1.1. Módulos Principales:

- **`main.js`**: Punto de entrada. Gestiona la inicialización, eventos de visibilidad y el reseteo de hashes en nuevas búsquedas.
- **`state.js`**: (Estado Global) Centraliza el objeto `appState`. Aquí se almacenan los filtros actuales, los datos brutos recibidos del servidor, el estado de la paginación de presentación y la configuración de ordenación.
- **`api.js`**: Capa de abstracción de datos. Contiene las funciones `fetch` para comunicarse con `datos.php`. Se encarga de abortar peticiones anteriores si se lanza una nueva (evitando condiciones de carrera).
- **`ui.js`**: Controlador de la interfaz de usuario. Gestiona la renderización de KPIs, el sistema de errores activos (sección naranja) y la lógica del modal de edición/creación de logs.
- **`presentation.js`**: Lógica del "Modo Pantalla Completa". Calcula dinámicamente cuántas líneas caben en pantalla según la resolución y agrupa las máquinas por Organismo > Provincia > Cliente para evitar cortes visuales incómodos.
- **`dom.js`**: Pequeña utilidad que cachea las referencias a los elementos del DOM para evitar llamadas repetitivas a `document.getElementById`.
- **`table.js`**: Especializado en la lógica de la tabla principal: cálculo de estados (OK/Error/Sin Respuesta), formateo de fechas y renderizado de filas con animaciones de cambio.

### 1.2. Ciclo de Vida del Refresco:
1. Se activa un `setInterval` (7.5s definido en `INTERVALO_MS`).
2. `api.js` solicita datos optimizados y comprimidos (Brotli o Gzip/Compact JSON).
3. El servidor valida el **ETag**. Si no hay cambios, devuelve `304`.
4. Si hay cambios, se reconstruye el objeto en el cliente y se pre-calculan los estados (`_estado`) y tooltips (`_tooltip`) en una sola pasada.
5. **Morphdom** actualiza la UI de forma quirúrgica.
6. Se disparan animaciones de tendencia y pulso en las filas modificadas.
4. Se actualizan los KPIs y la tabla/presentación sin recargar la página.

---

## 2. Estructura de la Base de Datos

El sistema se conecta a una base de datos **SQL Server**. A continuación se detallan las tablas implicadas y su relación:

### 2.1. Tabla: `Maquinas`
Es la entidad central del sistema.
| Campo | Tipo | Descripción |
|-------|--------|--------|
| `NumeroSerie` | PK | Identificador único físico de la máquina. |
| `TipoMaquina` | String | Categoría o modelo de la máquina. |
| `Descripcion` | String | Nombre descriptivo. |
| `organismo` | FK | Código que enlaza con la tabla `Organismos`. |
| `provincia` | FK | Código que enlaza con la tabla `Provincias`. |
| `cliente` | FK | Código que enlaza con la tabla `Clientes`. |
| `UltimoControl` | String (YYYYMMDDHHMM) | Marca de tiempo de la última conexión. |
| `MonitorizarEstado` | Bit/Bool | Indica si la máquina debe aparecer en el listado general. |
| `MonitorizarAlertas` | Bit/Bool | Si es `0` (false), los errores de la máquina se ignoran para KPIs y estados. |

### 2.2. Tabla: `Log_Errores`
Almacena el historial de incidencias técnicas.
| Campo | Tipo | Descripción |
|-------|--------|--------|
| `Id` | PK (Identity) | Identificador autoincremental. |
| `NumeroSerie` | FK | Relación con la tabla `Maquinas`. |
| `TipoMaquina` | String | Categoría o modelo de la máquina. |
| `TimeStamp` | String (YYYYMMDDHHMMSS) | Marca de tiempo precisa del evento. |
| `CodigoError` | FK | Enlace con la tabla `Errores`. |
| `Activo` | Bit/Bool | `1` si el error persiste, `0` si está solucionado. |
| `Observaciones` | Text | Notas introducidas por el técnico. |

### 2.3. Tabla: `Errores`
Diccionario maestro de códigos de error.
| Campo | Tipo | Descripción |
|-------|--------|--------|
| `id` | PK | ID interno. |
| `Codigo` | String | Código alfanumérico del error. |
| `Descripcion` | String | Texto explicativo del fallo. |

### 2.4. Tablas Maestras (`Organismos`, `Provincias`, `Clientes`)
Tablas de referencia que contienen el `codigo` y el `Nombre` para normalizar los datos de las máquinas.

---

## 3. Backend (PHP)

El archivo `datos.php` actúa como un **API RESTful** simplificado. Utiliza el parámetro `modo` para determinar la acción

### 3.1 Parametros de `modo`

- **`organismos` / `provincias`**: Devuelve listas únicas para llenar los selectores del filtro.
- **`maquinas`**: Realiza un `LEFT JOIN` con `Log_Errores` y `Errores`. Filtra por jerarquía y devuelve la estructura anidada de máquinas y sus logs activos.
- **`crear_log`**: Inserta en `Log_Errores`. Calcula el `TimeStamp` y mapea el estado de `Activo` basado en la entrada de la UI.
- **`actualizar_log`**: Actualiza el campo `Activo` y las `Observaciones` en `Log_Errores`.

### 3.2 Seguridad y Conexión:
- Utiliza un archivo `.env` para las credenciales de base de datos.
- Implementa consultas preparadas (`sqlsrv_query` con parámetros) para prevenir inyecciones SQL.

### 3.3 Optimización de Salida:
- **Compresión Adaptativa:** El servidor detecta automáticamente las capacidades del cliente y la disponibilidad de extensiones. Prioriza la compresión **Brotli** por su mayor eficiencia en datos JSON, utilizando **Gzip** (`ob_gzhandler`) como fallback automático para garantizar que la transferencia de datos sea siempre mínima.