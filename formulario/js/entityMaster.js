/**
 * Módulo: entityMaster.js
 * Proporciona funcionalidad de navegación y CRUD para maestros secundarios.
 */
import { CONFIG } from './config.js';
import * as dom from './dom.js';
import { openSearchMasterExternally } from './searchMaster.js';
import { appState } from './state.js';

/** Icono SVG para el botón de volver */
const SVG_BACK = `<svg width="1.8vh" height="1.8vh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;

/** Caché global de nombres para evitar peticiones redundantes al servidor entre diferentes instancias */
const globalNameCache = {};

/**
 * Controlador Genérico para Maestros de Entidades.
 * Esta clase encapsula toda la lógica de CRUD (Crear, Leer, Actualizar, Borrar),
 * navegación y validación de campos para cualquier tabla maestra del sistema.
 */
class MasterController {
    /**
     * @param {Object} config - Configuración de la entidad y mapeo del DOM.
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
        if (this.ui.btnBack) this.ui.btnBack.innerHTML = SVG_BACK + "<span>Volver</span>";

        // Eventos de validación
        this.config.form.addEventListener("input", (e) => {
            e.target.classList.add('touched');
            this.updateBtnState();
        });

        // Validación automática por tipo de dato
        Object.values(this.config.inputs).forEach(input => {
            if (!input) return;
            if (input.type === 'number') {
                input.addEventListener('keypress', (e) => {
                    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Tab') e.preventDefault();
                });
            }
        });

        // Configuración de Padding y Helpers (Nombres descriptivos)
        if (this.config.paddingConfigs) {
            this.config.paddingConfigs.forEach(cfg => {
                const input = this.config.inputs[cfg.key];
                if (input) {
                    input.addEventListener("blur", () => this.handleFieldBlur(cfg));
                    input.addEventListener("keydown", (e) => { if(e.key === "Enter") this.handleFieldBlur(cfg); });
                }
            });
        }

        // Verificación de duplicados (Unique Check)
        if (this.config.uniqueCheck) {
            const pkInput = this.config.inputs.Codigo;
            pkInput?.addEventListener("blur", async () => {
                const val = pkInput.value.trim();
                if (!val || this.state.index !== -1) return;
                const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=verificar_ns&ns=${encodeURIComponent(val)}`);
                const data = await res.json();
                if (data.exists) {
                    Swal.fire("Aviso", `El ${this.config.uniqueCheck.label} ya existe`, "warning");
                    pkInput.value = "";
                }
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
        
        const value = input.value.padStart(cfg.length, '0');
        input.value = value;
        input.classList.add('touched');

        if (cfg.helper && cfg.type) {
            const cacheKey = `${cfg.type}_${value}`;
            
            // Si ya tenemos el nombre en caché, lo usamos directamente sin ir al servidor
            if (globalNameCache[cacheKey]) {
                cfg.helper.textContent = globalNameCache[cacheKey];
            } else {
                try {
                    const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=get_nombre&tipo=${cfg.type}&codigo=${value}`, { signal });
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
        await this.loadData();
        this.resetForm();
    }

    /**
     * Cierra el modal y restaura el scroll de la página.
     */
    close() {
        this.config.modal.style.display = "none";
        document.body.style.overflow = "";
    }

    /**
     * Recupera el listado completo de la entidad desde la API.
     */
    async loadData() {
        const modo = this.config.type === 'maquinas' ? 'maquinas_navegacion' : 'maestro';
        const res = await fetch(`${CONFIG.API_ENDPOINT}?modo=${modo}&tipo=${this.config.type}`);
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
            if (input.type === 'checkbox') input.checked = !!item[key];
            else input.value = item[key] || "";
        });

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

    resetForm() {
        this.state.index = -1;
        this.config.form.reset();
        if (this.config.inputs.Codigo) this.config.inputs.Codigo.readOnly = false;
        
        this.config.form.classList.remove('form-invalid');
        this.config.form.querySelectorAll('.touched').forEach(el => el.classList.remove('touched'));
        this.config.form.querySelectorAll('.helper-name').forEach(el => el.textContent = "");
        
        this.updateUI();
    }

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

    async handleSave(e) {
        e.preventDefault();
        
        this.config.form.classList.add('form-invalid');
        if (!this.config.form.checkValidity()) {
            Swal.fire("Atención", "Rellene los campos obligatorios", "warning");
            return;
        }

        const formData = new FormData(this.config.form);
        formData.append("tabla", this.config.tableName);
        
        // Si es máquinas, el endpoint de guardado es específico por ahora
        const url = this.config.type === 'maquinas' ? `${CONFIG.API_ENDPOINT}?modo=crear_maquina` : `${CONFIG.API_ENDPOINT}?modo=guardar_maestro`;

        try {
            const res = await fetch(url, { method: "POST", body: formData });
            const result = await res.json();
            if (result.success) {
                Swal.fire({ title: "¡Éxito!", text: "Registro guardado", icon: "success", timer: 1500 });
                await this.loadData();
                this.resetForm();
            } else  errorDetail = result.error;
                if (Array.isArray(errorDetail)) {
                    errorDetail = errorDetail.map(e => e.message || JSON.stringify(e)).join(" | ");
                } else if (typeof errorDetail === 'object' && errorDetail !== null) {
                    errorDetail = JSON.stringify(errorDetail);
                }
                throw new Error(errorDetail || "Error desconocido al guardar");
            } catch (err) { 
            Swal.fire("Error", err.message, "error");
        }
    }

    async handleDelete() {
        if (this.state.index === -1) return;
        const item = this.state.data[this.state.index];
        
        let isConfirmed = false;
        if (this.config.deleteConfirmField) {
            const { value } = await Swal.fire({
                title: '¿Eliminar registro?',
                text: `Para confirmar, escriba: "${item[this.config.deleteConfirmField]}"`,
                input: 'text',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: 'var(--kpi-alerta-color)'
            });
            isConfirmed = (value === item[this.config.deleteConfirmField]);
            if (value !== undefined && !isConfirmed) Swal.fire("Error", "La descripción no coincide", "error");
        } else {
            const result = await Swal.fire({
                title: '¿Eliminar registro?',
                text: `Se borrará: ${item.Nombre || item.Codigo}`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: 'var(--kpi-alerta-color)'
            });
            isConfirmed = result.isConfirmed;
        }

        if (isConfirmed) {
            const formData = new FormData();
            const modo = this.config.type === 'maquinas' ? 'eliminar_maquina' : 'eliminar_maestro';
            if (this.config.type === 'maquinas') formData.append('ns', item.Codigo);
            else {
                formData.append("tabla", this.config.tableName);
                formData.append("codigo", item.Codigo);
            }
            await fetch(`${CONFIG.API_ENDPOINT}?modo=${modo}`, { method: "POST", body: formData });
            await this.loadData();
            this.resetForm();
        }
    }
}

/**
 * Gestión del Selector Principal y Teclado
 */
function openSelector() {
    dom.modalRegistroMaestro.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeSelector() {
    dom.modalRegistroMaestro.style.display = "none";
    document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
    // Atajo F1 para Máquinas
    if (e.key === "F1" && !appState.modoPresentacion) {
        e.preventDefault();
        maestros.maquinas.open();
    }

    // Handle Escape key for the main selector modal first
    if (dom.modalRegistroMaestro.style.display === "flex" && e.key === "Escape") {
        closeSelector();
        e.stopImmediatePropagation(); // Prevent other listeners from reacting
        return;
    }

    const activeMasterKey = Object.keys(maestros).find(key => maestros[key].config.modal.style.display === "flex");
    if (!activeMasterKey) return; // No master modal is open

    const m = maestros[activeMasterKey];
    if (e.key === "ArrowLeft" || e.key === "PageUp") m.navigate(m.state.index - 1);
    else if (e.key === "ArrowRight" || e.key === "PageDown") m.navigate(m.state.index + 1);
    else if (e.key === "ArrowUp" || e.key === "Home") m.navigate(0);
    else if (e.key === "ArrowDown" || e.key === "End") m.navigate(m.state.data.length - 1);
    else if (e.key === "Escape") { m.close(); }
});

/**
 * Inicialización de todos los controladores.
 */
export const maestros = {
    maquinas: new MasterController({
        type: 'maquinas', tableName: 'Maquinas',
        modal: dom.modalMaquinas, form: dom.formMaquinasMaster,
        inputs: { 
            Codigo: dom.mmNS, Descripcion: dom.mmDesc, TipoMaquina: dom.mmTipo, Notas: dom.mmNotas,
            Organismo: dom.mmOrg, Cliente: dom.mmCli, Provincia: dom.mmProv,
            MonitorizarEstado: dom.mmMonEstado, MonitorizarAlertas: dom.mmMonAlerta, Actualizar: dom.mmActualizar, Activo: dom.mmActivo
        },
        uniqueCheck: { label: 'Número de Serie' },
        deleteConfirmField: 'Descripcion',
        paddingConfigs: [
            { key: 'Organismo', length: 4, type: 'organismos', helper: dom.mmOrgName },
            { key: 'Cliente', length: 5, type: 'clientes', helper: dom.mmCliName },
            { key: 'Provincia', length: 2, type: 'provincias', helper: dom.mmProvName }
        ]
    }),
    organismos: new MasterController({
        type: 'organismos', tableName: 'Organismos',
        modal: dom.modalRegistroOrganismo, form: dom.formRegistroOrganismo,
        inputs: { Codigo: dom.inputOrganismoCodigo, Nombre: dom.inputOrganismoNombre },
        paddingConfigs: [{ key: 'Codigo', length: 4 }]
    }),
    clientes: new MasterController({
        type: 'clientes', tableName: 'Clientes',
        modal: dom.modalRegistroCliente, form: dom.formRegistroCliente,
        inputs: { Codigo: dom.inputClienteCodigo, Nombre: dom.inputClienteNombre },
        paddingConfigs: [{ key: 'Codigo', length: 5 }]
    }),
    errores: new MasterController({
        type: 'errores', tableName: 'Errores',
        modal: dom.modalRegistroError, form: dom.formRegistroError,
        inputs: { Codigo: dom.inputErrorCodigo, Nombre: dom.inputErrorNombre },
        paddingConfigs: [{ key: 'Codigo', length: 4 }]
    }),
    paises: new MasterController({
        type: 'paises', tableName: 'Paises',
        modal: dom.modalRegistroPais, form: dom.formRegistroPais,
        inputs: { Codigo: dom.inputPaisCodigo, Nombre: dom.inputPaisNombre, Latitud: dom.inputPaisLatitud, Longitud: dom.inputPaisLongitud },
        paddingConfigs: [{ key: 'Codigo', length: 3 }]
    }),
    provincias: new MasterController({
        type: 'provincias', tableName: 'Provincias',
        modal: dom.modalRegistroProvincia, form: dom.formRegistroProvincia,
        inputs: { Codigo: dom.inputProvinciaCodigo, Nombre: dom.inputProvinciaNombre, Pais: dom.inputProvinciaPais, Latitud: dom.inputProvinciaLatitud, Longitud: dom.inputProvinciaLongitud },
        paddingConfigs: [
            { key: 'Codigo', length: 10 },
            { key: 'Pais', length: 3, type: 'paises', helper: dom.labelProvinciaPais }
        ]
    })
};

export function initAllMaestros() {
    dom.registroMaquinasBtn?.addEventListener("click", openSelector);
    dom.cerrarRegistroMaestroBtn?.addEventListener("click", closeSelector);
    dom.btnRegistroMaquina?.addEventListener("click", () => { closeSelector(); maestros.maquinas.open(); });
    
    dom.btnRegistroOrganismo?.addEventListener("click", () => { closeSelector(); maestros.organismos.open(); });
    dom.btnRegistroCliente?.addEventListener("click", () => { closeSelector(); maestros.clientes.open(); });
    dom.btnRegistroError?.addEventListener("click", () => { closeSelector(); maestros.errores.open(); });
    dom.btnRegistroPais?.addEventListener("click", () => { closeSelector(); maestros.paises.open(); });
    dom.btnRegistroProvincia?.addEventListener("click", () => { closeSelector(); maestros.provincias.open(); });

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