/**
 * Módulo: entityMaster.js
 * Proporciona funcionalidad de navegación y CRUD para maestros secundarios.
 */
import { CONFIG } from '../config.js';
import * as dom from './dom.js';
import { openSearchMasterExternally } from './searchMaster.js';
import { appState } from './state.js';
import { getClaseConexion } from './utils.js';
import { abrirMapaPicker } from './mapa.js'

/** Icono SVG para el botón de volver */
const SVG_BACK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

/** Caché global de nombres para evitar peticiones redundantes al servidor entre diferentes instancias */
const globalNameCache = {};

/** 
 * Normaliza una cadena eliminando acentos, espacios extra y convirtiendo a minúsculas.
 */
const normalizeString = (str) => {
    if (!str) return "";
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

/**
 * Controlador Genérico para Maestros de Entidades.
 * Esta clase encapsula toda la lógica de CRUD (Crear, Leer, Actualizar, Borrar),
 * navegación y validación de campos para cualquier tabla maestra del sistema.
 */
class MasterController {
    /**
     * @param {Object} config - Configuración de la entidad y mapeo del DOM.
     * @param {string} config.type - Tipo de entidad (ej. 'maquinas', 'organismos').
     * @param {string} config.tableName - Nombre de la tabla física en la base de datos.
     * @param {HTMLElement} config.modal - Referencia al contenedor modal.
     * @param {HTMLFormElement} config.form - Referencia al formulario dentro del modal.
     * @param {Object<string, HTMLElement>} config.inputs - Mapa de campos del formulario.
     * @param {Array<Object>} [config.paddingConfigs] - Configuración de autocompletado de ceros.
     * @param {Object} [config.uniqueCheck] - Configuración para validación de duplicados.
     * @param {string} [config.deleteConfirmField] - Nombre del campo a escribir para confirmar borrado.
     */
    constructor(config) {
        this.config = config; // { type, tableName, modal, form, inputs, paddingConfigs, uniqueCheck, deleteConfirmField }
        this.state = { data: [], index: -1 };
        this.navAbortController = null;

        // Referencias a elementos de navegación dentro del modal (Genérico por clases)
        this.ui = {
            btnFirst:    config.modal.querySelector(".btn-first"),
            btnPrev:     config.modal.querySelector(".btn-prev"),
            btnNext:     config.modal.querySelector(".btn-next"),
            btnLast:     config.modal.querySelector(".btn-last"),
            btnNuevo:    config.modal.querySelector(".btn-nuevo") || config.modal.querySelector('button[type="reset"]'),
            btnEliminar: config.modal.querySelector(".btn-eliminar"),
            btnBack:     config.modal.querySelector(".btn-back"),
            btnSearch:   config.modal.querySelector(".btn-search"),
            btnCerrar:   config.modal.querySelector(".cerrar-btn"),
            count:       config.modal.querySelector(".nav-count"),
            footerNav:   config.modal.querySelector(".modal-footer-nav")
        };

        this.init();
    }

    /**
     * Inicializa los escuchadores de eventos y configuraciones iniciales.
     * @private
     */
    init() {
        if (!this.config.form) return;

        // Configuración inicial de botones
        // (El contenido se maneja en el HTML para facilitar personalización visual)

        // Eventos de validación
        this.config.form.addEventListener("input", (e) => {
            e.target.classList.add('touched');
            e.target.style.border = ""; // Limpiar resaltado de error/null al escribir
            this.updateBtnState();
        });

        // Validación automática por tipo de dato
        Object.entries(this.config.inputs).forEach(([key, input]) => {
            if (!input) return;

            // Formateo de Latitud/Longitud (cambiar . por , solo si no es input de tipo number nativo)
            if (key === 'Latitud' || key === 'Longitud') {
                input.addEventListener('blur', () => {
                    if (input.type !== 'number' && input.value.includes('.')) {
                        input.value = input.value.replace(/\./g, ',');
                    }
                });
            }

            if (input.type === 'number' || key === 'Latitud' || key === 'Longitud') {
                input.addEventListener('keypress', (e) => {
                    // Permitir números, retroceso, tab, signo menos, punto y coma
                    if (!/[0-9]/.test(e.key) && !['Backspace', 'Tab', '-', '.', ','].includes(e.key)) {
                        e.preventDefault();
                    }
                });
            }
        });

        // Configuración de Padding y Helpers (Nombres descriptivos)
        if (this.config.paddingConfigs) {
            this.config.paddingConfigs.forEach(cfg => {
                const input = this.config.inputs[cfg.key];
                if (input) {
                    input.addEventListener("blur", () => this.handleFieldBlur(cfg));
                    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.handleFieldBlur(cfg); });
                }
            });
        }

// Verificación de duplicados (Unique Check)
if (this.config.uniqueCheck) {
            const pkInput = this.config.inputs.Codigo || this.config.inputs.NumeroSerie;
            const nameInput = this.config.inputs.Nombre || this.config.inputs.Descripcion;

            // Validación de Código / Nº Serie
            pkInput?.addEventListener("blur", () => {
                // Si tiene padding, handleFieldBlur ya se encarga de llamar a verifyDuplicate
                const hasPadding = this.config.paddingConfigs?.some(c => c.key === 'Codigo' || c.key === 'NumeroSerie');
                if (!hasPadding) this.verifyDuplicate(pkInput, 'codigo', this.config.uniqueCheck.label);
            });

            // Validación de Nombre / Descripción
            nameInput?.addEventListener("blur", () => {
                this.verifyDuplicate(nameInput, 'nombre', this.config.uniqueCheck.label);
            });
        }

        // Asignación de eventos de navegación
        if (this.ui.btnFirst)    this.ui.btnFirst.onclick    = () => this.navigate(0);
        if (this.ui.btnLast)     this.ui.btnLast.onclick     = () => this.navigate(this.state.data.length - 1);
        if (this.ui.btnPrev)     this.ui.btnPrev.onclick     = () => this.navigate(this.state.index - 1);
        if (this.ui.btnNext)     this.ui.btnNext.onclick     = () => this.navigate(this.state.index + 1);
        if (this.ui.btnNuevo)    this.ui.btnNuevo.onclick    = () => this.resetForm();
        if (this.ui.btnEliminar) this.ui.btnEliminar.onclick = () => this.handleDelete();
        if (this.ui.btnCerrar)   this.ui.btnCerrar.onclick   = () => this.close();
        if (this.ui.btnBack)     this.ui.btnBack.onclick     = () => { this.close(); openSelector(); };

        if (this.ui.btnSearch) {
            this.ui.btnSearch.onclick = () => {
                openSearchMasterExternally(this.config.type, (selected) => {
                    const idx = this.state.data.findIndex(item => item.Codigo === selected.Codigo);
                    if (idx !== -1) this.navigate(idx);
                });
            };
        }

        // CRUD
        this.config.form.onsubmit = (e) => this.handleSave(e);
    }

    /**
     * Verifica duplicados en tiempo real (Local + Servidor) y aplica feedback visual.
     * @async
     * @param {HTMLInputElement} input - Elemento de entrada a validar.
     * @param {'codigo'|'nombre'} fieldType - Tipo de campo para la consulta.
     * @param {string} label - Nombre legible del campo para el mensaje de alerta.
     * @param {AbortSignal} [signal] - Señal para abortar peticiones fetch.
     * @returns {Promise<boolean>} True si el valor está duplicado.
     */
    async verifyDuplicate(input, fieldType, label, signal = null) {
        const val = input.value.trim();
        // Si estamos editando (index != -1), no validamos duplicados del propio registro
        if (!val || this.state.index !== -1) {
            input.style.border = "";
            return false;
        }

        const isName = fieldType === 'nombre';
        const valNorm = isName ? normalizeString(val) : val;

        // 1. Verificación en caché local (insensible a acentos si es nombre)
        let isDuplicate = this.state.data.some(item => {
            const itemVal = isName ? (item.Nombre || item.Descripcion) : (item.Codigo || item.NumeroSerie);
            return isName ? normalizeString(itemVal) === valNorm : String(itemVal).trim() === val;
        });

        // 2. Consulta al servidor si no se encontró localmente
        if (!isDuplicate) {
            try {
                // Endpoint unificado
                const url = `${CONFIG.API_ENDPOINT}?modo=verificar_duplicado&tipo=${this.config.type}&campo=${fieldType}&valor=${encodeURIComponent(val)}`;
                const res = await fetch(url, { signal });
                const data = await res.json();
                isDuplicate = data.exists;
            } catch (e) { if (e.name !== 'AbortError') console.error(`Error verificando ${fieldType}:`, e); }
        }

        if (isDuplicate) {
            input.style.border = "0.25vh solid var(--kpi-alerta-color)";
            await Swal.fire({
                title: isName ? "Nombre Duplicado" : "Código Duplicado",
                text: `El ${label} "${val}" ya existe en el sistema.`,
                icon: "warning",
                target: document.fullscreenElement || document.body
            });
            input.value = ""; // Limpiar campo
            input.style.border = "0.25vh solid var(--kpi-alerta-color)"; // Mantener borde rojo
            this.updateBtnState();
            return true;
        }
        input.style.border = "";
        return false;
    }

    /**
     * Gestiona la pérdida de foco en campos que requieren autocompletado de ceros o búsqueda de nombres.
     * @param {Object} cfg - Configuración del campo (longitud, tipo de tabla relacionada).
     * @param {AbortSignal} [signal] - Señal para abortar la petición si el usuario sigue navegando.
     */
    async handleFieldBlur(cfg, signal = null) {
        const input = this.config.inputs[cfg.key];
        if (!input.value) {
            if (cfg.helper) cfg.helper.textContent = "";
            return;
        }

        // 1. Verificar duplicado ANTES del padding (si es el campo clave y estamos creando)
        if ((cfg.key === 'Codigo' || cfg.key === 'NumeroSerie') && this.state.index === -1) {
            const dupBefore = await this.verifyDuplicate(input, 'codigo', this.config.uniqueCheck?.label || 'Código', signal);
            if (dupBefore) return; // Si es duplicado, verifyDuplicate limpia el campo y paramos
        }

        const value = input.value.padStart(cfg.length, '0');
        input.value = value;
        input.classList.add('touched');

        // 2. Verificar duplicado DESPUÉS del padding
        if ((cfg.key === 'Codigo' || cfg.key === 'NumeroSerie') && this.state.index === -1) {
            const dupAfter = await this.verifyDuplicate(input, 'codigo', this.config.uniqueCheck?.label || 'Código', signal);
            if (dupAfter) return;
        }

        if (cfg.helper && cfg.type) {
            const cacheKey = `${cfg.type}_${value}`;

            // Si ya tenemos el nombre en caché, lo usamos directamente sin ir al servidor
            if (globalNameCache[cacheKey]) {
                cfg.helper.textContent = globalNameCache[cacheKey];
            } else {
                try {
                    const res  = await fetch(`${CONFIG.API_ENDPOINT}?modo=get_nombre&tipo=${cfg.type}&codigo=${value}`, { signal });
                    const data = await res.json();
                    globalNameCache[cacheKey] = data.nombre || "No encontrado";
                    cfg.helper.textContent = globalNameCache[cacheKey];
                } catch (err) {
                    if (err.name !== 'AbortError') console.error("Error recuperando nombre:", err);
                }
            }
        }
        this.updateBtnState();
    }

    /**
     * Abre el modal del maestro, carga los datos del servidor y resetea el formulario.
     * @async
     */
    async open() {
        this.config.modal.style.display = "flex";
        document.body.style.overflow = "hidden";
        if (dom.logsNormalSection) dom.logsNormalSection.style.display = "none";
        await this.loadData();
        this.resetForm();
    }

    /**
     * Cierra el modal y restaura el scroll de la página.
     */
    close() {
        this.config.modal.style.display = "none";
        document.body.style.overflow = "";
        if (dom.logsNormalSection) dom.logsNormalSection.style.display = "";
    }

    /**
     * Recupera el listado completo de la entidad desde la API.
     * @async
     * @returns {Promise<void>}
     */
    async loadData() {
        const modo = this.config.type === 'maquinas' ? 'maquinas_navegacion' : 'maestro';
        const res  = await fetch(`${CONFIG.API_ENDPOINT}?modo=${modo}&tipo=${this.config.type}`);
        this.state.data = await res.json();
    }

    /**
     * Carga los datos de un registro específico en los campos del formulario.
     * @param {number} idx - Índice del registro en el array de datos.
     */
    navigate(idx) {
        if (idx < 0 || idx >= this.state.data.length) return;

        // Abortamos cualquier petición de nombres pendiente de la navegación anterior
        if (this.navAbortController) this.navAbortController.abort();
        this.navAbortController = new AbortController();
        const signal = this.navAbortController.signal;

        this.state.index = idx;
        const item = this.state.data[idx];

        Object.keys(this.config.inputs).forEach(key => {
            const input = this.config.inputs[key];
            if (!input) return;
            
            let value = item[key] || "";

            // Formateo específico para UltimoControl (YYYYMMDDHHMM -> DD/MM/YYYY HH:mm)
            if (key === 'UltimoControl') {
                const valStr = String(value);
                if (valStr.length >= 12) {
                    value = `${valStr.slice(6, 8)}/${valStr.slice(4, 6)}/${valStr.slice(0, 4)} ${valStr.slice(8, 10)}:${valStr.slice(10, 12)}`;
                } else {
                    value = "0";
                }
            }

            if (input.type === 'checkbox') input.checked = !!item[key];
            else if (input.tagName === 'SPAN' || input.tagName === 'LABEL' || input.tagName === 'DIV') input.textContent = value;
            else input.value = value;
        });

        // Aplicar borde dinámico según conexión en el maestro de máquinas
        if (this.config.type === 'maquinas' && this.config.inputs.UltimoControl) {
            const inputUC = this.config.inputs.UltimoControl;
            inputUC.classList.remove('border-con-verde', 'border-con-rojo', 'border-con-gris');
            
            const claseCon = getClaseConexion(item);
            if (claseCon === 'estado-verde') inputUC.classList.add('border-con-verde');
            else if (claseCon === 'estado-rojo') inputUC.classList.add('border-con-rojo');
            else inputUC.classList.add('border-con-gris');
        }

        // Actualizar helpers si existen
        if (this.config.paddingConfigs) {
            this.config.paddingConfigs.forEach(cfg => this.handleFieldBlur(cfg, signal));
        }

        if (this.config.inputs.Codigo) this.config.inputs.Codigo.readOnly = true;

        // Limpiar estados de validación previos
        this.config.form.classList.remove('form-invalid');
        this.config.form.querySelectorAll('.touched').forEach(el => el.classList.remove('touched'));

        this.updateUI();
    }

    /**
     * Resetea el formulario a su estado inicial para la creación de un nuevo registro.
     */
    resetForm() {
        this.state.index = -1;
        this.config.form.reset();
        if (this.config.inputs.Codigo) this.config.inputs.Codigo.readOnly = false;

        this.config.form.classList.remove('form-invalid');
        this.config.form.querySelectorAll('.touched').forEach(el => el.classList.remove('touched'));
        this.config.form.querySelectorAll('.helper-name').forEach(el => el.textContent = "");

        // Si es el maestro de máquinas, reseteamos el label de Último Control a "0" para nuevos registros
        if (this.config.type === 'maquinas' && this.config.inputs.UltimoControl) {
            const el = this.config.inputs.UltimoControl;
            if (el.tagName === 'SPAN' || el.tagName === 'LABEL' || el.tagName === 'DIV') el.textContent = "0";
            else el.value = "0";
            el.classList.remove('border-con-verde', 'border-con-rojo', 'border-con-gris');
        }

        this.updateUI();
    }

    /**
     * Actualiza los elementos informativos de la interfaz (contador, visibilidad de botones).
     */
    updateUI() {
        if (this.ui.count) {
            this.ui.count.textContent = this.state.index === -1 ? "Nuevo" : `${this.state.index + 1} / ${this.state.data.length}`;
        }
        if (this.ui.btnEliminar) {
            this.ui.btnEliminar.style.display = this.state.index === -1 ? "none" : "inline-flex";
        }
        if (this.ui.footerNav) {
            this.ui.footerNav.style.display = "flex";
        }
        this.updateBtnState();
    }

    /**
     * Comprueba la validez del formulario y habilita/deshabilita el botón de guardado.
     * También actualiza el tooltip con los campos faltantes.
     */
    updateBtnState() {
        const btn = this.config.form.querySelector('button[type="submit"]');
        if (!btn) return;

        const isInvalid = !this.config.form.checkValidity();
        btn.disabled = isInvalid;

        if (isInvalid) {
            const missing = [];
            this.config.form.querySelectorAll('[required]').forEach(el => {
                if (!el.checkValidity()) {
                    const label = el.closest('.form-control')?.querySelector('label')?.innerText.replace('*', '').trim();
                    if (label) missing.push(label);
                }
            });
            btn.title = "Faltan campos obligatorios: " + missing.join(", ");
        } else {
            btn.title = this.state.index === -1 ? "Crear nuevo registro" : "Guardar cambios";
        }
    }

    /**
     * Procesa el envío del formulario, realizando validaciones finales y enviando los datos a la API.
     * @async
     * @param {Event} e - Evento de submit del formulario.
     */
    async handleSave(e) {
        e.preventDefault();

        this.config.form.classList.add('form-invalid');
        if (!this.config.form.checkValidity()) {
            Swal.fire({
                title: "Campos pendientes",
                text:  "Por favor, rellene todos los campos obligatorios marcados con (*).",
                icon:  "warning",
                confirmButtonColor: 'var(--primary)',
                target: document.fullscreenElement || document.body
            });
            return;
        }

        const isNew    = this.state.index === -1;
        const formData = new FormData(this.config.form);

        // 1. Detección de duplicados (Local + Servidor) → si existe, pedir confirmación para editar
        if (isNew) {
            const codeVal = (formData.get('Codigo') || formData.get('NumeroSerie') || "").toString().trim();
            const nameValNorm = normalizeString(formData.get('Nombre') || formData.get('Descripcion'));

            // Identificamos qué campo está duplicado para informar al usuario
            let campoDuplicado = null;

            // Comprobación local de código
            const localCodeDup = codeVal && this.state.data.some(item =>
                (item.Codigo || item.NumeroSerie || "").toString().trim() === codeVal
            );
            if (localCodeDup) campoDuplicado = 'codigo';

            // Comprobación local de nombre
            if (!campoDuplicado && nameValNorm) {
                const localNameDup = this.state.data.some(item =>
                    normalizeString(item.Nombre) === nameValNorm ||
                    normalizeString(item.Descripcion) === nameValNorm
                );
                if (localNameDup) campoDuplicado = 'nombre';
            }

            // Comprobación en servidor de código (solo maestros, no máquinas — estas usan verificar_ns)
            if (!campoDuplicado && codeVal && this.config.type !== 'maquinas') {
                try {
                    const res  = await fetch(`${CONFIG.API_ENDPOINT}?modo=verificar_duplicado&tipo=${this.config.type}&campo=codigo&valor=${encodeURIComponent(codeVal)}`);
                    const data = await res.json();
                    if (data.exists) campoDuplicado = 'codigo';
                } catch (e) { console.error("Error validando código al guardar:", e); }
            }

            // Comprobación en servidor de nombre
            if (!campoDuplicado && nameValNorm) {
                try {
                    const res  = await fetch(`${CONFIG.API_ENDPOINT}?modo=verificar_duplicado&tipo=${this.config.type}&campo=nombre&valor=${encodeURIComponent(formData.get('Nombre') || formData.get('Descripcion'))}`);
                    const data = await res.json();
                    if (data.exists) campoDuplicado = 'nombre';
                } catch (e) { console.error("Error validando nombre al guardar:", e); }
            }

            // Si hay duplicado → confirmar que se quiere sobreescribir el registro existente
            if (campoDuplicado) {
                const labelCampo = campoDuplicado === 'codigo'
                    ? `El <b>${this.config.uniqueCheck?.label || 'código'}</b> <code>${codeVal}</code> ya existe en el sistema.`
                    : `Ya existe un registro con el mismo <b>nombre / descripción</b> en ${this.config.type}.`;

                const confirm = await Swal.fire({
                    title:             '⚠️ Registro duplicado',
                    html:              `${labelCampo}<br><br>Si continúas, <b>se editará el registro existente</b> con los datos que has introducido. ¿Deseas continuar?`,
                    icon:              'warning',
                    showCancelButton:  true,
                    confirmButtonText: 'Sí, editar el existente',
                    cancelButtonText:  'Cancelar',
                    confirmButtonColor: 'var(--kpi-naranja-color, #e67e22)',
                    target:            document.fullscreenElement || document.body
                });
                if (!confirm.isConfirmed) return;
                // Si acepta, continuamos: el backend hará UPDATE gracias al UPSERT (IF EXISTS ... UPDATE)
            }
        }

        // 2. Alerta de confirmación para datos NULL (campos vacíos)
        let emptyFields   = [];
        let emptyElements = [];
        this.config.form.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]), select, textarea').forEach(el => {
            if (!el.value.trim()) {
                const label = el.closest('.form-control')?.querySelector('label')?.innerText.replace('*', '').trim() || el.name;
                emptyFields.push(label);
                emptyElements.push(el);
            }
        });

        if (emptyFields.length > 0) {
            // Resaltado visual (borde amarillo/naranja)
            emptyElements.forEach(el => el.style.border = "0.2vh solid var(--kpi-naranja-color)");

            const confirm = await Swal.fire({
                title:             "¿Enviar campos vacíos?",
                html:              `Los campos: <b>${emptyFields.join(", ")}</b> se enviarán como NULL.<br>¿Desea continuar con el registro?`,
                icon:              "question",
                showCancelButton:  true,
                confirmButtonText: "Sí, enviar",
                cancelButtonText:  "Revisar",
                target:            document.fullscreenElement || document.body
            });
            if (!confirm.isConfirmed) return;

            // Limpiar resaltado si el usuario decide enviar de todos modos
            emptyElements.forEach(el => el.style.border = "");
        }

        formData.append("tabla", this.config.tableName);

        // Si es máquinas, el endpoint de guardado es específico por ahora
        const url = this.config.type === 'maquinas'
            ? `${CONFIG.API_ENDPOINT}?modo=crear_maquina`
            : `${CONFIG.API_ENDPOINT}?modo=guardar_maestro`;

        // 3. UltimoControl = "0" para nuevas máquinas
        if (isNew && this.config.type === 'maquinas') {
            formData.append("UltimoControl", "0");
        }

        const submitBtn = this.config.form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = "Guardando...";
        }

        try {
            const res    = await fetch(url, { method: "POST", body: formData });
            const result = await res.json();
            if (result.success) {
                Swal.fire({
                    title:             isNew ? "¡Registro Creado!"   : "¡Cambios Guardados!",
                    text:              isNew ? "La nueva entrada se ha incorporado correctamente al sistema." : "La información ha sido actualizada con éxito.",
                    icon:              "success",
                    timer:             2000,
                    showConfirmButton: false,
                    target:            document.fullscreenElement || document.body
                });
                await this.loadData();
                this.resetForm();
            } else {
                let errorDetail = result.error;
                if (Array.isArray(errorDetail)) {
                    errorDetail = errorDetail.map(e => e.message || JSON.stringify(e)).join("\n");
                } else if (typeof errorDetail === 'object' && errorDetail !== null) {
                    errorDetail = JSON.stringify(errorDetail);
                }
                throw new Error(errorDetail || "El servidor no pudo procesar la solicitud.");
            }
        } catch (err) {
            Swal.fire({
                title:              "Error al Guardar",
                text:               err.message,
                icon:               "error",
                confirmButtonColor: 'var(--kpi-alerta-color)',
                target:             document.fullscreenElement || document.body
            });
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.originalText;
            }
        }
    }

    /**
     * Gestiona la eliminación del registro actual tras una confirmación de seguridad.
     * @async
     */
    async handleDelete() {
        if (this.state.index === -1) return;
        const item = this.state.data[this.state.index];

        let isConfirmed = false;
        if (this.config.deleteConfirmField) {
            const { value } = await Swal.fire({
                title:             '¿Eliminar registro?',
                text:              `Para confirmar, escriba: "${item[this.config.deleteConfirmField]}"`,
                input:             'text',
                icon:              'warning',
                showCancelButton:  true,
                confirmButtonColor: 'var(--kpi-alerta-color)',
                target:            document.fullscreenElement || document.body
            });
            isConfirmed = (value === item[this.config.deleteConfirmField]);
            if (value !== undefined && !isConfirmed) Swal.fire({
                title: "Error", text: "La descripción no coincide", icon: "error",
                target: document.fullscreenElement || document.body
            });
        } else {
            const result = await Swal.fire({
                title:             '¿Eliminar registro?',
                text:              `Se borrará: ${item.Nombre || item.Codigo}`,
                icon:              'warning',
                showCancelButton:  true,
                confirmButtonColor: 'var(--kpi-alerta-color)',
                target:            document.fullscreenElement || document.body
            });
            isConfirmed = result.isConfirmed;
        }

        if (isConfirmed) {
            const delBtn = this.ui.btnEliminar;
            if (delBtn) {
                delBtn.disabled = true;
                delBtn.dataset.originalText = delBtn.innerHTML;
                delBtn.innerHTML = "Eliminando...";
            }

            try {
                const formData = new FormData();
                const modo = this.config.type === 'maquinas' ? 'eliminar_maquina' : 'eliminar_maestro';
                if (this.config.type === 'maquinas') formData.append('ns', item.Codigo);
                else {
                    formData.append("tabla",  this.config.tableName);
                    formData.append("codigo", item.Codigo);
                }
                const res    = await fetch(`${CONFIG.API_ENDPOINT}?modo=${modo}`, { method: "POST", body: formData });
                const result = await res.json();
                if (result.success) {
                    Swal.fire({
                        title:             '¡Eliminado!',
                        text:              'El registro se ha borrado definitivamente del sistema.',
                        icon:              'success',
                        timer:             2000,
                        showConfirmButton: false,
                        target:            document.fullscreenElement || document.body
                    });
                    await this.loadData();
                    this.resetForm();
                } else {
                    throw new Error(result.error || "No se pudo eliminar el registro por restricciones del sistema.");
                }
        } catch (err) {
                Swal.fire({
                    title:              "Error al eliminar",
                    text:               err.message,
                    icon:               "error",
                    confirmButtonColor: 'var(--kpi-alerta-color)',
                    target:             document.fullscreenElement || document.body
                });
            } finally {
                const delBtn = this.ui.btnEliminar;
                if (delBtn) {
                    delBtn.disabled = false;
                    delBtn.innerHTML = delBtn.dataset.originalText;
                }
            }
        }
    }
}

/**
 * Abre el modal de selección de maestro principal.
 */
function openSelector() {
    dom.modalRegistroMaestro.style.display = "flex";
    document.body.style.overflow = "hidden";
}

/**
 * Cierra el modal de selección de maestro principal.
 */
function closeSelector() {
    dom.modalRegistroMaestro.style.display = "none";
    document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
    // Atajo F1 para Navegación Cruzada (Ir al Mapa)
    if (e.key === "F1" && !appState.modoPresentacion) {
        e.preventDefault();
        window.location.href = "../mapa/";
        return;
    }

    // Atajo F3 para Maestro de Registros
    if (e.key === "F3" && !appState.modoPresentacion) {
        e.preventDefault();
        openSelector();
        return;
    }

    // Handle Escape key for the main selector modal first
    if (dom.modalRegistroMaestro.style.display === "flex" && e.key === "Escape") {
        closeSelector();
        e.stopImmediatePropagation();
        return;
    }

    const activeMasterKey = Object.keys(maestros).find(key => maestros[key].config.modal.style.display === "flex");
    if (!activeMasterKey) return;

    const m = maestros[activeMasterKey];
    if      (e.key === "ArrowLeft"  || e.key === "PageUp")   m.navigate(m.state.index - 1);
    else if (e.key === "ArrowRight" || e.key === "PageDown")  m.navigate(m.state.index + 1);
    else if (e.key === "ArrowUp"    || e.key === "Home")      m.navigate(0);
    else if (e.key === "ArrowDown"  || e.key === "End")       m.navigate(m.state.data.length - 1);
    else if (e.key === "Escape")                              m.close();
});

/**
 * Inicialización de todos los controladores.
 * Todos los maestros tienen uniqueCheck para activar la verificación de Codigo y Nombre/Descripcion.
 */
export const maestros = {
    maquinas: new MasterController({
        type: 'maquinas', tableName: 'Maquinas',
        modal: dom.modalMaquinas, form: dom.formMaquinasMaster,
        inputs: {
            Codigo: dom.mmNS, Descripcion: dom.mmDesc, TipoMaquina: dom.mmTipo, Notas: dom.mmNotas,
            Organismo: dom.mmOrg, Cliente: dom.mmCli, Provincia: dom.mmProv,
            MonitorizarEstado: dom.mmMonEstado, MonitorizarAlertas: dom.mmMonAlerta, 
            UltimoControl: dom.mmUltControl, Actualizar: dom.mmActualizar
        },
        uniqueCheck: { label: 'Número de Serie' },
        deleteConfirmField: 'Descripcion',
        paddingConfigs: [
            { key: 'Organismo', length: 4, type: 'organismos', helper: dom.mmOrgName },
            { key: 'Cliente',   length: 5, type: 'clientes',   helper: dom.mmCliName },
            { key: 'Provincia', length: 2, type: 'provincias', helper: dom.mmProvName }
        ]
    }),
    organismos: new MasterController({
        type: 'organismos', tableName: 'Organismos',
        modal: dom.modalRegistroOrganismo, form: dom.formRegistroOrganismo,
        inputs: { Codigo: dom.inputOrganismoCodigo, Nombre: dom.inputOrganismoNombre },
        paddingConfigs: [{ key: 'Codigo', length: 4 }],
        uniqueCheck: { label: 'Código de Organismo' }
    }),
    clientes: new MasterController({
        type: 'clientes', tableName: 'Clientes',
        modal: dom.modalRegistroCliente, form: dom.formRegistroCliente,
        inputs: { Codigo: dom.inputClienteCodigo, Nombre: dom.inputClienteNombre },
        paddingConfigs: [{ key: 'Codigo', length: 5 }],
        uniqueCheck: { label: 'Código de Cliente' }
    }),
    errores: new MasterController({
        type: 'errores', tableName: 'Errores',
        modal: dom.modalRegistroError, form: dom.formRegistroError,
        inputs: { Codigo: dom.inputErrorCodigo, Nombre: dom.inputErrorNombre },
        paddingConfigs: [{ key: 'Codigo', length: 4 }],
        uniqueCheck: { label: 'Código de Error' }
    }),
    paises: new MasterController({
        type: 'paises', tableName: 'Paises',
        modal: dom.modalRegistroPais, form: dom.formRegistroPais,
        inputs: { Codigo: dom.inputPaisCodigo, Nombre: dom.inputPaisNombre, Latitud: dom.inputPaisLatitud, Longitud: dom.inputPaisLongitud },
        paddingConfigs: [{ key: 'Codigo', length: 3 }],
        uniqueCheck: { label: 'Código de País' }
    }),
    provincias: new MasterController({
        type: 'provincias', tableName: 'Provincias',
        modal: dom.modalRegistroProvincia, form: dom.formRegistroProvincia,
        inputs: { Codigo: dom.inputProvinciaCodigo, Nombre: dom.inputProvinciaNombre, Pais: dom.inputProvinciaPais, Latitud: dom.inputProvinciaLatitud, Longitud: dom.inputProvinciaLongitud },
        paddingConfigs: [
            { key: 'Codigo', length: 10 },
            { key: 'Pais',   length: 3, type: 'paises', helper: dom.labelProvinciaPais }
        ],
        uniqueCheck: { label: 'Código de Provincia' }
    })
};

/**
 * Inicializa todos los controladores de maestros y vincula los eventos de apertura globales.
 */
export function initAllMaestros() {
    dom.registroMaquinasBtn?.addEventListener("click", openSelector);
    dom.cerrarRegistroMaestroBtn?.addEventListener("click", closeSelector);
    dom.btnRegistroMaquina?.addEventListener("click",    () => { closeSelector(); maestros.maquinas.open(); });
    dom.btnRegistroOrganismo?.addEventListener("click",  () => { closeSelector(); maestros.organismos.open(); });
    dom.btnRegistroCliente?.addEventListener("click",    () => { closeSelector(); maestros.clientes.open(); });
    dom.btnRegistroError?.addEventListener("click",      () => { closeSelector(); maestros.errores.open(); });
    dom.btnRegistroPais?.addEventListener("click",       () => { closeSelector(); maestros.paises.open(); });
    dom.btnRegistroProvincia?.addEventListener("click",  () => { closeSelector(); maestros.provincias.open(); });

    // Vincular lupas internas (ej. en Provincias para buscar Paises)
    document.querySelectorAll(".modal .sm-trigger").forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            openSearchMasterExternally(type, (selected) => {
                const parentModal = btn.closest('.modal');
                const input = parentModal.querySelector(`input[name="${type.slice(0, -1)}"]`) || parentModal.querySelector(`input[id*="Pais"]`);
                const label = parentModal.querySelector('.helper-name');
                if (input) input.value = selected.Codigo;
                if (label) label.textContent = selected.Nombre;
            });
        };
    });
}


// --- Manejo de Coordenadas y Mapa ---

document.getElementById('btnMapaPais')?.addEventListener('click', () => {
	abrirMapaPicker((lat, lng) => {
		document.getElementById('inputPaisLatitud').value = lat;
		document.getElementById('inputPaisLongitud').value = lng;
	});
});

document.getElementById('btnMapaProvincia')?.addEventListener('click', () => {
	abrirMapaPicker((lat, lng) => {
		document.getElementById('inputProvinciaLatitud').value = lat;
		document.getElementById('inputProvinciaLongitud').value = lng;
	});
});

// Validación visual de rangos
const validarCoordInput = (id, min, max) => {
	const input = document.getElementById(id);
	if (!input) return;
	input.addEventListener('input', () => {
		const val = parseFloat(input.value);
		const esValido = isNaN(val) || (val >= min && val <= max);
		input.style.borderColor = esValido ? '' : 'var(--kpi-alerta-color)';
	});
};

validarCoordInput('inputPaisLatitud', -90, 90);
validarCoordInput('inputPaisLongitud', -180, 180);
validarCoordInput('inputProvinciaLatitud', -90, 90);
validarCoordInput('inputProvinciaLongitud', -180, 180);