# SicoLares - Control de Máquinas

Sistema de monitorización y gestión de estados de máquinas distribuido por organismos, provincias y clientes. Esta aplicación permite visualizar en tiempo real el estado de conectividad y los errores activos de un parque de máquinas.

## 1. Funcionalidades Principales

### 1.1. Panel de Control y Filtrado
- **Búsqueda Dinámica:** Filtrado de máquinas por Organismo y Provincia.
- **KPIs de Estado:** Resumen visual rápido que incluye:
  - Total de máquinas listadas.
  - Máquinas con estado **Activo** (Conectadas recientemente).
  - Máquinas **Sin respuesta** (Alerta de conexión).
  - **Errores activos** detectados en los logs.

### 1.2. Gestión de Errores
- **Listado de Errores Activos:** Visualización inmediata de las máquinas que presentan fallos.
- **Registro de Nuevos Errores:** Permite dar de alta manualmente un error para máquinas con fallos desconocidos.
- **Edición de Logs:** Modal interactivo para actualizar el estado de un error (Solucionado/Sin solucionar) y añadir observaciones técnicas.
- **Campos Obligatorios:** Validación de Fecha, Hora y Mensaje para mantener la integridad de la base de datos.

### 1.3. Modo Presentación (Pantalla Completa)
- Diseñado para ser visualizado en monitores de control o TVs.
- **Paginación Automática:** Ciclo de pantallas que recorre todas las máquinas filtradas.
- **Visualización de Errores:** Espacio dedicado en la parte inferior para mostrar errores críticos durante la rotación.
- **Controles de Reproducción:** Posibilidad de pausar/reanudar con la tecla `Espacio` y navegar con las flechas del teclado.

### 1.4. Interfaz y Experiencia de Usuario
- **Modo Oscuro/Claro:** Soporte nativo para temas visuales que se adaptan a la preferencia del usuario o del entorno.
- **Refresco Automático:** Sincronización constante con el servidor cada 7.5 segundos con una barra de progreso visual.
- **Exportación:** Permite descargar los resultados actuales en formato CSV para reportes externos.
- **Diseño Responsivo:** Adaptado para su uso en pantallas horizontales de todos los tamaños.

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
1. Se activa un `setInterval` (7.5s por defecto).
2. `api.js` solicita nuevos datos.
3. Se comparan los estados actuales con los anteriores para disparar la animación de "flash" en las filas cambiadas.
4. Se actualizan los KPIs y la tabla/presentación sin recargar la página.

---

## 2. Estructura de la Base de Datos

El sistema se conecta a una base de datos **SQL Server**. A continuación se detallan las tablas implicadas y su relación:

### Tabla: `Maquinas`
Es la entidad central del sistema.
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `NumeroSerie` | PK | Identificador único físico de la máquina. |
| `Descripcion` | String | Nombre descriptivo. |
| `organismo` | FK | Código que enlaza con la tabla `Organismos`. |
| `provincia` | FK | Código que enlaza con la tabla `Provincias`. |
| `cliente` | FK | Código que enlaza con la tabla `Clientes`. |
| `UltimoControl` | String (YYYYMMDDHHMM) | Marca de tiempo de la última conexión. |
| `MonitorizarEstado` | Bit/Bool | Indica si la máquina debe aparecer en el listado general. |
| `MonitorizarAlertas` | Bit/Bool | Indica si la máquina está en estado de error crítico. |

### Tabla: `Log_Actualizaciones`
Almacena el historial de errores y las intervenciones técnicas.
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `ID` | PK (Identity) | Identificador autoincremental del log. |
| `Numero_Serie` | FK | Relación 1:N con la tabla `Maquinas`. |
| `Mensaje` | String | Descripción del error detectado. |
| `ResultadoCorrecto` | Bit/Bool | `1` si está solucionado, `0` si persiste. |
| `Observaciones` | Text | Notas introducidas por el técnico. |
| `Fecha` | String (YYYYMMDD) | Fecha del registro. |
| `Hora` | String (HH:MM) | Hora del registro. |

### Tablas Maestras (`Organismos`, `Provincias`, `Clientes`)
Tablas de referencia que contienen el `codigo` y el `Nombre` para normalizar los datos de las máquinas.

---

## 3. Backend (PHP)

El archivo `datos.php` actúa como un **API RESTful** simplificado. Utiliza el parámetro `modo` para determinar la acción:

- **`organismos` / `provincias`**: Devuelve listas únicas para llenar los selectores del filtro.
- **`maquinas`**: Realiza un `LEFT JOIN` complejo entre máquinas y sus respectivos logs. Agrupa los logs en un array dentro de cada objeto máquina antes de enviarlo al cliente.
- **`crear_log`**: Inserta una nueva entrada cuando el usuario registra un error manualmente (campos Fecha, Hora y Mensaje obligatorios).
- **`actualizar_log`**: Realiza un `UPDATE` sobre una entrada existente para cambiar su estado u observaciones.

### Seguridad y Conexión:
- Utiliza un archivo `.env` para las credenciales de base de datos.
- Implementa consultas preparadas (`sqlsrv_query` con parámetros) para prevenir inyecciones SQL.