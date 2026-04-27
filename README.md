# SicoLares - Sistema de Monitoreo de Máquinas

Bienvenido al sistema **SicoLares**, software para la monitorización, gestión y visualización en tiempo real de parques de máquinas distribuidos geográficamente.

El sistema se compone de dos aplicaciones principales que comparten una base de datos común y un núcleo de configuración unificado:

1.  **[Mapa de Monitoreo](mapa/)**: Visualización geográfica de alertas, estados y rotación automática de países para salas de control.
2.  **[Formulario de Gestión](formulario/)**: Panel de administración para la gestión de inventario, resolución de incidencias y KPIs operativos.

---

## 🛠️ Arquitectura y Tecnologías

El proyecto sigue una arquitectura desacoplada donde el frontend (JS Vanilla) se comunica con una API robusta en PHP.

-   **Frontend**: HTML5, CSS3 (Glassmorphism & Diseño Premium), JavaScript ES6+ (Módulos).
-   **Backend**: PHP 8.0+ (Siguiendo estándares PSR-12).
-   **Base de Datos**: Microsoft SQL Server.
-   **Configuración**: Sistema híbrido de variables de entorno (`.env`) y configuración dinámica (`config.ini`).

---

## ⚙️ Guía de Configuración

Este sistema de monitorización utiliza un archivo centralizado para que el administrador pueda ajustar el comportamiento de ambas plataformas sin tocar código fuente.

### Archivo Maestro: `config.ini`

Ubicado en la raíz del proyecto, este archivo permite cambiar:
-   **Tiempos de refresco**: ¿Cada cuánto se consultan datos nuevos?
-   **Umbrales de Alerta**: ¿Cuándo se considera que una máquina ha perdido la conexión?
-   **Ajustes Visuales**: Zooms del mapa, animaciones de tablas, rotación de cámaras, etc.

> [!TIP]
> Consulta los comentarios extensos dentro de [config.ini](config.ini) para entender el propósito de cada variable y sus valores recomendados.

### Variables Privadas: `.env`

Para datos sensibles (credenciales de DB), utiliza el archivo `.env` en la raíz. **Nunca subas este archivo a repositorios públicos.**

---

## 🚀 Despliegue e Instalación

### Requisitos Previos
-   Servidor Web (Apache/Nginx/IIS).
-   PHP 8.0 o superior con las extensiones `sqlsrv` y `pdo_sqlsrv` habilitadas.
-   Acceso a una base de datos SQL Server con el esquema de SicoLares cargado.

### Instalación en Producción (Servidor Real)
1.  Copia el contenido de este repositorio a la raíz de tu servidor web (ej: `/var/www/html/` o `C:\inetpub\wwwroot\`).
2.  Configura tu servidor web para que tenga permisos de lectura en la raíz y subcarpetas.
3.  Crea un archivo `.env` basado en la configuración de tu base de datos:
    ```env
    DB_SERVER=tu_servidor,1433
    DB_DATABASE=nombre_db
    DB_USER=usuario
    DB_PASS=contraseña
    ```
4.  Ajusta los valores en `config.ini` según las necesidades de tu red.
5.  Asegúrate de que la extensión de PHP `brotli` o `zlib` esté activa para una compresión de datos óptima.

### Desarrollo Local (XAMPP)
1.  Clona el repositorio en `C:\xampp\htdocs\`.
2.  Asegúrate de haber instalado los drivers de SQL Server para PHP en tu instalación de XAMPP.
3.  Accede vía `http://localhost/mapa` o `http://localhost/formulario`.

---

## 📄 Documentación por Proyecto

Para detalles específicos sobre el funcionamiento interno de cada módulo, consulta sus respectivos manuales:
-   📖 [README del Mapa](docs/README_mapa.md)
-   📖 [README del Formulario](docs/README_formulario.md)

---
*© 2026 SicoLares*
