# 🖥️ Monitor de Máquinas

Panel de monitorización en tiempo real para el seguimiento del estado de máquinas, organizadas por organismo, provincia y cliente.

---

## 📋 Descripción

Esta aplicación web permite visualizar y monitorizar el estado operativo de un conjunto de máquinas conectadas a una base de datos SQL Server. Ofrece dos modos de visualización: una **tabla interactiva** con filtros y un **modo presentación** en pantalla completa pensado para pantallas de monitorización continua (dashboards, salas de control, etc.).

---

## 🚀 Características

- **Filtrado dinámico** por organismo y provincia con selects encadenados.
- **Tabla de resultados** con indicadores de estado en tiempo real.
- **Actualización automática** de datos cada 7,5 segundos sin recargar la página.
- **Modo Presentación** a pantalla completa con paginación automática.
- **Panel de errores** integrado en la presentación, mostrando los logs de fallos activos.
- **Indicadores de estado** visuales por código de color:
  - 🟢 **OK** — Último control hace menos de 10 minutos.
  - 🔴 **!** — Último control hace más de 10 minutos (sin respuesta).
  - 🟠 **LOG** — La máquina tiene alertas activas en el log.
  - ⚫ **?** — Fecha de último control desconocida o inválida.
- **Diseño responsive** adaptado a móvil, tablet y pantallas grandes.
- **Pausar / Reanudar** la presentación con barra espaciadora o botón.

---

## 🗂️ Estructura de archivos

```
├── index.html       # Interfaz principal de la aplicación
├── style.css        # Estilos visuales (diseño Apple-inspired, modo presentación)
├── script.js        # Lógica de la aplicación (fetch, renderizado, presentación)
└── datos.php        # API backend (conexión SQL Server, consultas de datos)
```

---

## ⚙️ Requisitos

- **PHP** 7.4 o superior con extensión `sqlsrv` instalada.
- **SQL Server** (o compatible) accesible desde el servidor web.
- Servidor web compatible con PHP (Apache, Nginx, IIS, etc.).
- Navegador moderno con soporte para ES2017+ (Fetch API, async/await, Fullscreen API).

---

## 🛠️ Instalación y configuración

1. **Clona o copia** los archivos en el directorio raíz de tu servidor web.

2. **Edita `datos.php`** y configura los parámetros de conexión a tu base de datos:

   ```php
   $serverName = "NOMBRE_DEL_SERVIDOR";
   $connectionInfo = array(
       "Database" => "nombre_base_datos",
       "UID"      => "usuario",
       "PWD"      => "contraseña",
       "CharacterSet" => "UTF-8"
   );
   ```

3. **Asegúrate** de que el servidor PHP tiene instalado el driver `sqlsrv` de Microsoft.  
   Puedes verificarlo con `php -m | grep sqlsrv`.

4. Accede a `index.html` desde el navegador.

---

## 🗄️ Estructura de la base de datos

La aplicación espera las siguientes tablas en SQL Server:

| Tabla               | Campos relevantes                                                                 |
|---------------------|-----------------------------------------------------------------------------------|
| `Maquinas`          | `NumeroSerie`, `Descripcion`, `organismo`, `provincia`, `cliente`, `UltimoControl`, `MonitorizarEstado`, `MonitorizarAlertas` |
| `Organismos`        | `codigo`, `Nombre`                                                                |
| `Provincias`        | `codigo`, `Nombre`                                                                |
| `Clientes`          | `codigo`, `Nombre`                                                                |
| `Log_Actualizaciones` | `Numero_Serie`, `Mensaje`, `ResultadoCorrecto`, `ID`                            |

> **Nota:** El campo `UltimoControl` debe almacenarse como string en formato `YYYYMMDDHHMM` (12 dígitos).

---

## 📡 API — `datos.php`

El backend expone tres endpoints mediante el parámetro GET `modo`:

### `GET datos.php?modo=organismos`
Devuelve la lista de organismos disponibles.
```json
[{ "Organismo": "Nombre del organismo" }]
```

### `GET datos.php?modo=provincias&organismo=NOMBRE`
Devuelve las provincias disponibles, opcionalmente filtradas por organismo.
```json
[{ "Provincia": "Nombre de la provincia" }]
```

### `GET datos.php?modo=maquinas&organismo=NOMBRE&provincia=NOMBRE`
Devuelve las máquinas con sus logs asociados, filtradas por organismo y/o provincia.
```json
[
  {
    "Organismo": "...",
    "Provincia": "...",
    "Cliente": "...",
    "Descripcion": "...",
    "UltimoControl": "202504091530",
    "MonitorizarEstado": 1,
    "MonitorizarAlertas": 1,
    "NumeroSerie": "SN123456",
    "Logs": [
      { "Mensaje": "Error de conexión", "ResultadoCorrecto": 0 }
    ]
  }
]
```

---

## 🖱️ Uso

1. **Selecciona** un organismo y una provincia en el formulario superior.  
   Puedes dejar uno o ambos en blanco para ver todos los resultados.
2. Pulsa **Buscar** para cargar los datos.
3. La tabla se **actualiza automáticamente** cada 7,5 segundos.
4. Pulsa **Modo Presentación** para entrar en la vista de pantalla completa.
   - La presentación pagina automáticamente cada 7,5 segundos.
   - Pulsa `Espacio` para pausar/reanudar.
   - Pulsa **Salir** o `Esc` para volver a la vista normal.
5. Usa **Limpiar filtros** para resetear la selección.

---

## 🎨 Personalización

Las variables de diseño se encuentran al inicio de `style.css` en el bloque `:root`:

```css
:root {
  --primary: #007aff;       /* Color principal (botones, foco) */
  --bg: #f5f5f7;            /* Fondo de la aplicación */
  --surface: #ffffff;       /* Fondo de tarjetas y tabla */
  --radius-lg: 16px;        /* Radio de borde grande */
}
```

El intervalo de actualización se puede cambiar en `script.js`:
```js
const INTERVALO_MS = 7500; // Milisegundos entre actualizaciones
```

---

## 🔒 Consideraciones de seguridad

- **No expongas credenciales** en entornos de producción. Considera usar variables de entorno o un archivo de configuración externo no accesible públicamente.
- Las consultas SQL utilizan **parámetros preparados** para prevenir inyección SQL.
- Restringe el acceso a `datos.php` mediante autenticación si la aplicación es pública.

---

## 📄 Licencia

Uso interno. Todos los derechos reservados.
