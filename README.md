# SicoLares - Control de Máquinas

Sistema de monitorización y gestión de estados de máquinas distribuido por organismos, provincias y clientes. Esta aplicación permite visualizar en tiempo real el estado de conectividad y los errores activos de un parque de máquinas.

## 1. Funcionalidades Principales

### 1.1. Panel de Control y Filtrado
- **Búsqueda Dinámica:** Filtrado de máquinas por Organismo y Provincia.
- **KPIs de Estado:** Resumen visual rápido que incluye:
  - Total de máquinas listadas.
  - Máquinas con estado **Activo** (Conectadas recientemente).
  - Máquinas **Sin respuesta** (Alerta de conexión).
  - **Errores activos** detectados en el log de errores (filtrado por monitorización).

### 1.2. Gestión de Errores
- **Listado de Errores Activos:** Visualización inmediata de las máquinas que presentan fallos.
- **Registro de Nuevos Errores:** Permite dar de alta manualmente un error para máquinas con fallos desconocidos.
- **Edición de Logs:** Modal interactivo para actualizar el estado de un error (Activo/Inactivo) y añadir observaciones técnicas. Incluye visualización de Código de Error, Tipo de Máquina y Fecha/Hora exacta.
- **Campos Obligatorios:** Validación de Código de Error, Fecha y Hora para mantener la integridad de la base de datos.

### 1.3. Modo Presentación (Pantalla Completa)
- Diseñado para ser visualizado en monitores de control o TVs.
- **Paginación Automática:** Ciclo de pantallas que recorre todas las máquinas filtradas.
- **Visualización de Errores:** Espacio dedicado en la parte inferior para mostrar errores críticos durante la rotación.
- **Controles de Reproducción:** Posibilidad de pausar/reanudar con la tecla `Espacio` y navegar con las flechas del teclado.

### 1.4. Interfaz y Experiencia de Usuario
- **Modo Oscuro/Claro:** Soporte nativo para temas visuales que se adaptan a la preferencia del usuario o del entorno.
- **Refresco Automático:** Sincronización constante con el servidor cada 7.5 segundos con una barra de progreso visual.
- **Exportación:** Permite descargar los resultados actuales en formato CSV para reportes externos (incluye estado de conexión).
- **Diseño Fluido:** Interfaz adaptada mediante unidades relativas (`vh`/`vw`) para una escala perfecta en pantallas horizontales de alta resolución.

---

## 2. Requisitos del Sistema

- **Servidor Web:** XAMPP (Apache) o similar.
- **Base de Datos:** SQL Server con el driver `sqlsrv` habilitado en PHP.
- **Navegador:** Compatible con ES6+ (Chrome, Edge, Firefox, Safari).

---

## 3. Guía de Uso Rápido

1. **Consulta:** Seleccione un organismo o provincia en el formulario superior y pulse "Buscar".
2. **Monitorización:** Observe los KPIs para entender el estado general del parque. La tabla se actualizará sola periódicamente.
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

### Módulos Principales:

- **`main.js`**: El punto de entrada. Gestiona la inicialización de la app, los eventos de visibilidad del navegador (pausa/reanudación del refresco) y el envío del formulario de búsqueda principal.
- **`state.js`**: (Estado Global) Centraliza el objeto `appState`. Aquí se almacenan los filtros actuales, los datos brutos recibidos del servidor, el estado de la paginación de presentación y la configuración de ordenación.
- **`api.js`**: Capa de abstracción de datos. Contiene las funciones `fetch` para comunicarse con `datos.php`. Se encarga de abortar peticiones anteriores si se lanza una nueva (evitando condiciones de carrera).
- **`ui.js`**: Controlador de la interfaz de usuario. Gestiona la renderización de KPIs, el sistema de errores activos (sección naranja) y la lógica del modal de edición/creación de logs.
- **`presentation.js`**: Lógica del "Modo Pantalla Completa". Calcula dinámicamente cuántas líneas caben en pantalla según la resolución y agrupa las máquinas por Organismo > Provincia > Cliente para evitar cortes visuales incómodos.
- **`dom.js`**: Pequeña utilidad que cachea las referencias a los elementos del DOM para evitar llamadas repetitivas a `document.getElementById`.
- **`table.js`**: Especializado en la lógica de la tabla principal: cálculo de estados (OK/Error/Sin Respuesta), formateo de fechas y renderizado de filas con animaciones de cambio.

### Ciclo de Vida del Refresco:
1. Se activa un `setInterval` (7.5s definido en `INTERVALO_MS`).
2. `api.js` solicita nuevos datos.
3. Se comparan los estados actuales con los anteriores para disparar la animación de "flash" en las filas cambiadas.
4. Se actualizan los KPIs y la tabla/presentación sin recargar la página.

---

## 2. Estructura de la Base de Datos

El sistema se conecta a una base de datos **SQL Server**. A continuación se detallan las tablas implicadas y su relación:

### Tabla: `Maquinas`
Es la entidad central del sistema.
| Campo | Tipo | Descripción |
|-------|--------|--------|
| `NumeroSerie` | PK | Identificador único físico de la máquina. |
| `Descripcion` | String | Nombre descriptivo. |
| `organismo` | FK | Código que enlaza con la tabla `Organismos`. |
| `provincia` | FK | Código que enlaza con la tabla `Provincias`. |
| `cliente` | FK | Código que enlaza con la tabla `Clientes`. |
| `UltimoControl` | String (YYYYMMDDHHMM) | Marca de tiempo de la última conexión. |
| `MonitorizarEstado` | Bit/Bool | Indica si la máquina debe aparecer en el listado general. |
| `MonitorizarAlertas` | Bit/Bool | Si es `0` (false), los errores de la máquina se ignoran para KPIs y estados. |

### Tabla: `Log_Errores`
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

### Tabla: `Errores`
Diccionario maestro de códigos de error.
| Campo | Tipo | Descripción |
|-------|--------|--------|
| `id` | PK | ID interno. |
| `Codigo` | String | Código alfanumérico del error. |
| `Descripcion` | String | Texto explicativo del fallo. |

### Tablas Maestras (`Organismos`, `Provincias`, `Clientes`)
Tablas de referencia que contienen el `codigo` y el `Nombre` para normalizar los datos de las máquinas.

---

## 3. Backend (PHP)

El archivo `datos.php` actúa como un **API RESTful** simplificado. Utiliza el parámetro `modo` para determinar la acción:

- **`organismos` / `provincias`**: Devuelve listas únicas para llenar los selectores del filtro.
- **`maquinas`**: Realiza un `LEFT JOIN` con `Log_Errores` y `Errores`. Filtra por jerarquía y devuelve la estructura anidada de máquinas y sus logs activos.
- **`crear_log`**: Inserta en `Log_Errores`. Calcula el `TimeStamp` y mapea el estado de `Activo` basado en la entrada de la UI.
- **`actualizar_log`**: Actualiza el campo `Activo` y las `Observaciones` en `Log_Errores`.

### Seguridad y Conexión:
- Utiliza un archivo `.env` para las credenciales de base de datos.
- Implementa consultas preparadas (`sqlsrv_query` con parámetros) para prevenir inyecciones SQL.