/**
 * Módulo: machineMaster.js
 * Gestiona el formulario de alta y mantenimiento de máquinas,
 * incluyendo la navegación por el catálogo y validaciones de integridad.
 */
import { appState } from './state.js';
import { openSearchMasterExternally } from './searchMaster.js';

/**
 * Estado local para la navegación de máquinas.
 */
const state = {
	machines: [],
	index: -1
};

/**
 * Inicializa los eventos y validaciones del maestro de máquinas.
 */
export function initMachineMaster() {
	const modal = document.getElementById("modalMaquinas");
    const modalBusqueda = document.getElementById("modalBusqueda");
	const form = document.getElementById("formMaquinasMaster");

	/**
	 * Actualiza el estado del botón Guardar según la validez del formulario.
	 */
	const updateBtnState = () => {
		const submitBtn = form.querySelector('button[type="submit"]');
		if (!submitBtn) return;

		const isInvalid = !form.checkValidity();
		submitBtn.disabled = isInvalid;

		if (isInvalid) {
			const missing = [];
			form.querySelectorAll('[required]').forEach(el => {
				if (!el.checkValidity()) {
					const labelText = el.closest('.form-control')?.querySelector('label')?.innerText.replace('*', '').trim();
					if (labelText) missing.push(labelText);
				}
			});
			submitBtn.title = "Faltan campos obligatorios: " + missing.join(", ");
		} else {
			submitBtn.title = state.index === -1 ? "Crear nueva máquina" : "Guardar cambios";
		}
	};

	form.addEventListener("input", (e) => {
		e.target.classList.add('touched');
		updateBtnState();
	});

	document.getElementById("mmOpenBtn").onclick = openMachineMaster;
	document.getElementById("cerrarMMBtn").onclick = () => {
		modal.style.display = "none";
		document.body.style.overflow = "";
	};

	/**
	 * Atajos de teclado para navegación y cierre.
	 * Se usa stopImmediatePropagation para evitar cerrar múltiples modales a la vez.
	 */
	document.addEventListener("keydown", (e) => {
		if (e.key === "F1" && !appState.modoPresentacion) {
			e.preventDefault();
			openMachineMaster();
		}
		if (modal.style.display === "flex" && modalBusqueda.style.display === "none") {
			if (e.key === "ArrowLeft" || e.key === "PageUp") navigate(state.index - 1);
			if (e.key === "ArrowRight" || e.key === "PageDown") navigate(state.index + 1);
			if (e.key === "ArrowUp" || e.key === "Home") navigate(0);
			if (e.key === "ArrowDown" || e.key === "End") navigate(state.machines.length - 1);
			if (e.key === "Escape") {
				e.stopImmediatePropagation();
				document.getElementById("cerrarMMBtn").click();
			}
		}
	});

	// Padding de ceros y validación al perder foco
	setupPadding("mmOrg", 4, "organismos");
	setupPadding("mmCli", 5, "clientes");
	setupPadding("mmProv", 2, "provincias");

	/**
	 * Verificación de existencia de Número de Serie al perder el foco,
	 * siempre que no estemos en modo edición (index !== -1).
	 */
	document.getElementById("mmNS").addEventListener("blur", async (e) => {
		const ns = e.target.value.trim();
		if (!ns || state.index !== -1) return;

		try {
			const res = await fetch(`datos.php?modo=verificar_ns&ns=${encodeURIComponent(ns)}`);
			const data = await res.json();
			if (data.exists) {
				Swal.fire("Aviso", "Este número de serie ya está registrado en el sistema", "warning");
				e.target.value = "";
			}
		} catch (err) {
			console.error("Error validando NS:", err);
		}
	});

	/**
	 * Vincula la lupa del NS con el buscador maestro global (F2).
	 */
	document.getElementById("mmSearchTrigger").onclick = () => {
		openSearchMasterExternally('maquinas', (selected) => {
			const idx = state.machines.findIndex(m => m.NumeroSerie === selected.Codigo);
			if (idx === -1) {
				Swal.fire("Aviso", "La máquina seleccionada no se encuentra en el listado de navegación actual.", "warning");
				return;
			}
			navigate(idx);
		});
	};

	/**
	 * Configura los botones de búsqueda (lupas) para Organismos, Clientes y Provincias.
	 */
	document.querySelectorAll(".sm-trigger").forEach(btn => {
		btn.onclick = () => {
			const type = btn.dataset.type;
			openSearchMasterExternally(type, (selected) => {
				const inputId = type === 'organismos' ? 'mmOrg' : (type === 'clientes' ? 'mmCli' : 'mmProv');
				const nameId = type === 'organismos' ? 'mmOrgName' : (type === 'clientes' ? 'mmCliName' : 'mmProvName');
				document.getElementById(inputId).value = selected.Codigo;
				document.getElementById(nameId).textContent = selected.Nombre;
			});
		};
	});

	/**
	 * Enlaces de los botones físicos de navegación del modal.
	 */
	document.getElementById("mmBtnFirst").onclick = () => navigate(0);
	document.getElementById("mmBtnLast").onclick = () => navigate(state.machines.length - 1);
	document.getElementById("mmBtnPrev").onclick = () => navigate(state.index - 1);
	document.getElementById("mmBtnNext").onclick = () => navigate(state.index + 1);
	document.getElementById("mmBtnEliminar").onclick = async () => {
		await eliminarMaquina();
		updateBtnState();
	};
	document.getElementById("mmBtnNuevo").onclick = resetForm;

	form.onsubmit = async (e) => {
		e.preventDefault();

		form.classList.add('form-invalid');
		if (!form.checkValidity()) {
			Swal.fire("Atención", "Por favor, rellene todos los campos obligatorios marcados con *", "warning");
			return;
		}

		const formData = new FormData(form);
		try {
			const res = await fetch("datos.php?modo=crear_maquina", {
				method: "POST",
				body: formData
			});
			const result = await res.json();
			if (result.success) {
				Swal.fire("Éxito", "Máquina guardada correctamente", "success");
				resetForm();
				loadNavigationData(); // Recargar lista para navegación
			} else throw new Error(result.error);
		} catch (err) {
			Swal.fire("Error", err.message, "error");
		}
	};

	updateBtnState();
}

/**
 * Aplica relleno de ceros a la izquierda y recupera el nombre descriptivo
 * de la entidad seleccionada.
 */
function setupPadding(id, length, type) {
	const el = document.getElementById(id);
	const form = document.getElementById("formMaquinasMaster");
	const nameId = id === 'mmOrg' ? 'mmOrgName' : (id === 'mmCli' ? 'mmCliName' : 'mmProvName');
	const handler = async () => {
		if (el.value) {
			el.value = el.value.padStart(length, '0');
			el.classList.add('touched');
			// Intentar escribir el nombre si existe
			try {
				const res = await fetch(`datos.php?modo=get_nombre&tipo=${type}&codigo=${el.value}`);
				const data = await res.json();
				document.getElementById(nameId).textContent = data.nombre || "No encontrado";
			} catch (err) {
				console.error("Error recuperando nombre:", err);
			}
		} else {
			document.getElementById(nameId).textContent = "";
		}
		// Disparar validación tras el padding
		const submitBtn = form.querySelector('button[type="submit"]');
		if (submitBtn) submitBtn.disabled = !form.checkValidity();
	};
	el.onblur = handler;
	el.onkeydown = (e) => {
		if (e.key === "Enter") handler();
	};
}

/**
 * Abre el modal y carga la lista de máquinas para permitir la navegación.
 */
async function openMachineMaster() {
	document.getElementById("modalMaquinas").style.display = "flex";
	document.body.style.overflow = "hidden";
	await loadNavigationData();
	resetForm();
}

/**
 * Descarga el listado de navegación desde el servidor.
 */
async function loadNavigationData() {
	const res = await fetch("datos.php?modo=maquinas_navegacion");
	state.machines = await res.json();
}

/**
 * Proceso de eliminación de máquina.
 * Requiere que el usuario escriba la descripción exacta como medida de seguridad.
 */
async function eliminarMaquina() {
	if (state.index === -1) return;
	const m = state.machines[state.index];

	const {
		value: confirmacion
	} = await Swal.fire({
		title: '¿Eliminar máquina?',
		text: `Para confirmar, escriba la descripción de la máquina: "${m.Descripcion}"`,
		input: 'text',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: 'var(--kpi-alerta-color)',
		confirmButtonText: 'Sí, eliminar',
		cancelButtonText: 'Cancelar'
	});

	if (confirmacion === m.Descripcion) {
		try {
			const formData = new FormData();
			formData.append('ns', m.NumeroSerie);

			const res = await fetch("datos.php?modo=eliminar_maquina", {
				method: "POST",
				body: formData
			});
			const result = await res.json();

			if (result.success) {
				Swal.fire("Eliminada", "La máquina ha sido borrada del sistema", "success");
				resetForm();
				await loadNavigationData();
			} else {
				throw new Error(result.error);
			}
		} catch (err) {
			Swal.fire("Error", err.message, "error");
		}
	} else if (confirmacion !== undefined) {
		Swal.fire("Error", "La descripción no coincide. No se ha eliminado la máquina.", "error");
	}
}

/**
 * Carga los datos de una máquina específica en los campos del formulario
 * según su índice en el array de navegación.
 */
function navigate(idx) {
	if (idx < 0 || idx >= state.machines.length) return;
	state.index = idx;
	const m = state.machines[idx];

	document.getElementById("mmNS").value = m.NumeroSerie;
	document.getElementById("mmDesc").value = m.Descripcion;
	document.getElementById("mmTipo").value = m.TipoMaquina;
	document.getElementById("mmNotas").value = m.Notas;
	document.getElementById("mmOrg").value = m.Organismo;
	document.getElementById("mmCli").value = m.Cliente;
	document.getElementById("mmProv").value = m.Provincia;
	document.getElementById("mmMonEstado").checked = !!m.MonitorizarEstado;
	document.getElementById("mmMonAlerta").checked = !!m.MonitorizarAlertas;
	document.getElementById("mmActualizar").checked = !!m.Actualizar;

	document.getElementById("mmCount").textContent = `${state.index + 1} / ${state.machines.length}`;
	document.getElementById("mmNS").readOnly = true; // No permitir cambiar PK en edición
	document.getElementById("mmBtnEliminar").style.display = "inline-flex";

	// Actualizar estado del botón al navegar
	const submitBtn = document.getElementById("formMaquinasMaster").querySelector('button[type="submit"]');
	if (submitBtn) submitBtn.disabled = false; // Las máquinas existentes suelen ser válidas
}

/**
 * Limpia el formulario y lo prepara para un alta nueva.
 */
function resetForm() {
	state.index = -1;
	const form = document.getElementById("formMaquinasMaster");
	form.reset();
	document.getElementById("mmNS").readOnly = false;
	document.getElementById("mmMonEstado").checked = false;
	document.getElementById("mmMonAlerta").checked = false;
	document.getElementById("mmActualizar").checked = false;
	document.getElementById("mmCount").textContent = "Nuevo";
	document.getElementById("mmBtnEliminar").style.display = "none";
	document.querySelectorAll(".helper-name").forEach(el => el.textContent = "");
	form.querySelectorAll('.touched').forEach(el => el.classList.remove('touched'));
	form.classList.remove('form-invalid');
	// Botón deshabilitado al resetear (campos obligatorios vacíos)
	form.querySelector('button[type="submit"]').disabled = true;
}