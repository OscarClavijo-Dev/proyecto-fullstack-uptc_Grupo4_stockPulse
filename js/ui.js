/**
 * StockPulse - Módulo de Interfaz de Usuario (UI)
 * 
 * Responsabilidades:
 * - Renderizado reactivo de KPIs y tablas (Inventario y Alertas)
 * - Protección estricta contra inyecciones XSS mediante sanitización
 * - Sistema de notificaciones Toast (éxito, advertencia, error, info)
 * - Validación y presentación de errores en línea en el DOM
 * - Ergonomía táctil para tablets y móviles (zonas táctiles >= 44px)
 * - Manejo de estados de carga (spinners y botones deshabilitados)
 */

/**
 * Escapa caracteres HTML para prevenir vulnerabilidades XSS.
 * @param {string|number|null|undefined} valor 
 * @returns {string} Cadena sanitizada segura para inserción en el DOM.
 */
export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return "";
  const str = String(valor);
  const mapa = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return str.replace(/[&<>"']/g, (m) => mapa[m]);
}

/**
 * Formatea una fecha ISO a una representación legible en español.
 * @param {string} fechaIso 
 * @returns {string}
 */
export function formatearFecha(fechaIso) {
  if (!fechaIso) return "—";
  try {
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return "—";
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(fecha);
  } catch {
    return String(fechaIso);
  }
}

/**
 * Renderiza los indicadores clave de desempeño (KPIs) en las tarjetas superiores.
 * @param {Object} kpis
 * @param {number} kpis.totalProductos
 * @param {number} kpis.productosCriticos
 * @param {number} kpis.totalAlertas
 */
export function renderKPIs({ totalProductos = 0, productosCriticos = 0, totalAlertas = 0 }) {
  const elTotal = document.getElementById("kpi-total-productos");
  const elCriticos = document.getElementById("kpi-productos-criticos");
  const elAlertas = document.getElementById("kpi-total-alertas");

  if (elTotal) elTotal.textContent = totalProductos;
  if (elCriticos) {
    elCriticos.textContent = productosCriticos;
    // Si hay productos críticos, resalta la tarjeta visualmente
    const cardCriticos = document.getElementById("card-kpi-criticos");
    if (cardCriticos) {
      if (productosCriticos > 0) {
        cardCriticos.classList.add("ring-2", "ring-red-500", "bg-red-50/50");
      } else {
        cardCriticos.classList.remove("ring-2", "ring-red-500", "bg-red-50/50");
      }
    }
  }
  if (elAlertas) elAlertas.textContent = totalAlertas;
}

/**
 * Actualiza las opciones del selector de bodega según las bodegas disponibles.
 * @param {Array<string>} bodegas Lista de nombres únicos de bodegas.
 * @param {string} bodegaSeleccionada
 */
export function actualizarSelectorBodegas(bodegas = [], bodegaSeleccionada = "") {
  const select = document.getElementById("filtro-bodega");
  if (!select) return;

  const valorActual = bodegaSeleccionada || select.value;
  select.innerHTML = '<option value="">Todas las bodegas</option>';

  bodegas.forEach((bodega) => {
    if (!bodega) return;
    const option = document.createElement("option");
    option.value = bodega;
    option.textContent = bodega;
    if (bodega === valorActual) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * Renderiza la tabla de inventario de productos en tiempo real.
 * Aplica resaltado en ROJO y badge "CRÍTICO" si stock_actual <= stock_minimo.
 * 
 * @param {Array<Object>} productos Lista de productos a renderizar.
 */
export function renderTablaInventario(productos = []) {
  const tbody = document.getElementById("tbody-inventario");
  const emptyState = document.getElementById("inventario-vacio");
  const badgeTotal = document.getElementById("badge-total-filas");

  if (!tbody) return;

  if (badgeTotal) {
    badgeTotal.textContent = `${productos.length} producto${productos.length === 1 ? "" : "s"}`;
  }

  if (productos.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  productos.forEach((prod) => {
    const stockActual = Number(prod.stock_actual);
    const stockMinimo = Number(prod.stock_minimo);
    const esCritico = stockActual <= stockMinimo;

    const tr = document.createElement("tr");
    tr.dataset.id = prod.id;

    if (esCritico) {
      // Resaltado ROJO para productos críticos
      tr.className = "bg-red-50/90 hover:bg-red-100/90 border-l-4 border-red-600 transition-colors duration-150";
    } else {
      tr.className = "hover:bg-slate-50 transition-colors duration-150 border-l-4 border-transparent";
    }

    tr.innerHTML = `
      <td class="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-800">
        ${escapeHtml(prod.sku)}
      </td>
      <td class="px-4 py-3.5 text-sm text-slate-900 font-medium max-w-xs truncate" title="${escapeHtml(prod.nombre_producto)}">
        ${escapeHtml(prod.nombre_producto)}
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          ${escapeHtml(prod.bodega)}
        </span>
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-sm text-center">
        <span class="inline-block px-2.5 py-1 rounded-md font-bold ${
          esCritico ? "bg-red-600 text-white shadow-sm" : "bg-slate-100 text-slate-800"
        }">
          ${stockActual}
        </span>
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-sm text-center text-slate-500 font-medium">
        ${stockMinimo}
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-sm text-center">
        ${
          esCritico
            ? `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm animate-pulse" title="Stock en o por debajo del mínimo de seguridad">
                <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                CRÍTICO
              </span>`
            : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                Óptimo
              </span>`
        }
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate" title="${escapeHtml(prod.proveedor_email)}">
        ${escapeHtml(prod.proveedor_email)}
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-sm text-right font-medium">
        <div class="flex items-center justify-end gap-2">
          <!-- Botón táctil ENTRADA (Mínimo 44px de altura ergonómica para tablets) -->
          <button
            type="button"
            data-action="entrada"
            data-id="${escapeHtml(prod.id)}"
            class="btn-accion-movimiento inline-flex items-center justify-center min-h-[44px] min-w-[76px] px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            title="Registrar entrada de mercancía"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Entrada
          </button>
          
          <!-- Botón táctil SALIDA (Mínimo 44px de altura ergonómica para tablets) -->
          <button
            type="button"
            data-action="salida"
            data-id="${escapeHtml(prod.id)}"
            class="btn-accion-movimiento inline-flex items-center justify-center min-h-[44px] min-w-[76px] px-3 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
            title="Registrar salida de mercancía"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
            </svg>
            Salida
          </button>
        </div>
      </td>
    `;

    fragment.appendChild(tr);
  });

  tbody.innerHTML = "";
  tbody.appendChild(fragment);
}

/**
 * Renderiza la tabla de historial de alertas de reabastecimiento.
 * @param {Array<Object>} alertas 
 */
export function renderHistorialAlertas(alertas = []) {
  const tbody = document.getElementById("tbody-alertas");
  const emptyState = document.getElementById("alertas-vacias");
  const badgeAlertas = document.getElementById("badge-total-alertas-panel");

  if (!tbody) return;

  if (badgeAlertas) {
    badgeAlertas.textContent = `${alertas.length} registro${alertas.length === 1 ? "" : "s"}`;
  }

  if (alertas.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  alertas.forEach((alerta) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors duration-150 border-b border-slate-100";

    const estadoLower = (alerta.estado || "ENVIADO").toLowerCase();
    let badgeEstado = "bg-amber-100 text-amber-800";
    if (estadoLower.includes("enviado") || estadoLower.includes("notificado")) {
      badgeEstado = "bg-blue-100 text-blue-800";
    } else if (estadoLower.includes("resuelto") || estadoLower.includes("atendido")) {
      badgeEstado = "bg-emerald-100 text-emerald-800";
    }

    tr.innerHTML = `
      <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
        ${formatearFecha(alerta.creado_en)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-800">
        ${escapeHtml(alerta.sku)}
      </td>
      <td class="px-4 py-3 text-xs text-slate-900 font-medium max-w-xs truncate" title="${escapeHtml(alerta.nombre_producto)}">
        ${escapeHtml(alerta.nombre_producto)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap text-xs text-center font-bold text-red-600">
        ${escapeHtml(alerta.stock_actual)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap text-xs text-center text-slate-500 font-medium">
        ${escapeHtml(alerta.stock_minimo)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap text-xs text-center font-semibold text-slate-700">
        ${alerta.cantidad_sugerida !== undefined && alerta.cantidad_sugerida !== null ? escapeHtml(alerta.cantidad_sugerida) : "—"}
      </td>
      <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-500 max-w-xs truncate" title="${escapeHtml(alerta.proveedor_email)}">
        ${escapeHtml(alerta.proveedor_email)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap text-xs text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeEstado}">
          ${escapeHtml(alerta.estado || "ENVIADA")}
        </span>
      </td>
    `;

    fragment.appendChild(tr);
  });

  tbody.innerHTML = "";
  tbody.appendChild(fragment);
}

/**
 * Sistema de Notificaciones Flotantes (Toasts).
 * Prohibido el uso de alert(), confirm() o prompt().
 * 
 * @param {string} mensaje Texto a mostrar en el toast.
 * @param {'success' | 'warning' | 'error' | 'info'} tipo Tipo de alerta.
 * @param {number} duracion Duración en milisegundos antes de autodestruirse (por defecto 5000 ms).
 */
export function showToast(mensaje, tipo = "info", duracion = 5000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto flex items-start p-4 rounded-xl shadow-lg border text-sm transition-all duration-300 transform translate-y-2 opacity-0 max-w-md w-full`;

  let icono = "";
  let clasesEstilo = "";

  switch (tipo) {
    case "success":
      clasesEstilo = "bg-emerald-50 border-emerald-300 text-emerald-950";
      icono = `
        <svg class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `;
      break;

    case "warning":
      clasesEstilo = "bg-amber-50 border-amber-300 text-amber-950";
      icono = `
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      `;
      break;

    case "error":
      clasesEstilo = "bg-red-50 border-red-300 text-red-950";
      icono = `
        <svg class="w-5 h-5 text-red-600 shrink-0 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `;
      break;

    default: // info
      clasesEstilo = "bg-blue-50 border-blue-300 text-blue-950";
      icono = `
        <svg class="w-5 h-5 text-blue-600 shrink-0 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `;
      break;
  }

  toast.className += ` ${clasesEstilo}`;
  toast.innerHTML = `
    ${icono}
    <div class="flex-1 font-medium leading-relaxed">
      ${escapeHtml(mensaje)}
    </div>
    <button type="button" class="ml-3 text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors" aria-label="Cerrar">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  // Botón de cierre manual
  const btnCerrar = toast.querySelector("button");
  const removerToast = () => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  };

  btnCerrar.addEventListener("click", removerToast);

  container.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
  });

  // Temporizador de autodestrucción
  if (duracion > 0) {
    setTimeout(removerToast, duracion);
  }
}

/**
 * Limpia todos los mensajes de error existentes en un formulario.
 * @param {HTMLFormElement} formElement 
 */
export function limpiarErroresFormulario(formElement) {
  if (!formElement) return;
  const errores = formElement.querySelectorAll(".error-campo-dom");
  errores.forEach((el) => el.remove());

  const inputs = formElement.querySelectorAll(".border-red-500");
  inputs.forEach((input) => {
    input.classList.remove("border-red-500", "focus:ring-red-500");
  });
}

/**
 * Muestra un mensaje de error adyacente al input en el DOM.
 * @param {HTMLElement} inputElement Campo que originó el error.
 * @param {string} mensaje Texto descriptivo en español.
 */
export function mostrarErrorCampo(inputElement, mensaje) {
  if (!inputElement) return;

  // Marcar borde en rojo
  inputElement.classList.add("border-red-500", "focus:ring-red-500");

  // Crear elemento de texto para el error
  const errorEl = document.createElement("p");
  errorEl.className = "error-campo-dom text-xs font-semibold text-red-600 mt-1 flex items-center";
  errorEl.innerHTML = `
    <svg class="w-3.5 h-3.5 mr-1 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
    </svg>
    <span>${escapeHtml(mensaje)}</span>
  `;

  // Insertar después del campo o de su contenedor padre inmediato si es un grupo de input
  const contenedor = inputElement.closest(".campo-contenedor") || inputElement.parentElement;
  contenedor.appendChild(errorEl);
}

/**
 * Controla el estado visual de un botón durante llamadas asíncronas.
 * @param {HTMLButtonElement} boton 
 * @param {boolean} cargando 
 * @param {string} textoOriginal 
 * @param {string} textoCargando 
 */
export function setBotonCargando(boton, cargando, textoOriginal = "Guardar", textoCargando = "Procesando...") {
  if (!boton) return;

  if (cargando) {
    boton.disabled = true;
    boton.dataset.textoOriginal = textoOriginal;
    boton.classList.add("opacity-60", "pointer-events-none");
    boton.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>${escapeHtml(textoCargando)}</span>
    `;
  } else {
    boton.disabled = false;
    boton.classList.remove("opacity-60", "pointer-events-none");
    boton.innerHTML = boton.dataset.textoOriginal || textoOriginal;
  }
}

/**
 * Valida un formato de correo electrónico simplificado según estándar RFC.
 * @param {string} email 
 * @returns {boolean}
 */
export function validarEmail(email) {
  if (!email) return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
  return regex.test(email.trim());
}
