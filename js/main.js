/**
 * StockPulse - Orquestador Principal de la Aplicación
 * 
 * Integra los servicios de Supabase, Webhook N8N y la interfaz de usuario.
 * Controla el ciclo de vida, eventos de filtros, apertura de modales,
 * validaciones en el cliente y sincronización reactiva en tiempo real.
 */

import { estaConfiguradoSupabase, estaConfiguradoN8N } from "./config.js";
import {
  obtenerProductos,
  crearProducto,
  registrarMovimiento,
  obtenerAlertas,
  suscribirInventario,
  suscribirAlertas
} from "./inventarioService.js";
import { notificarActualizacionN8N } from "./webhookClient.js";
import {
  renderKPIs,
  renderTablaInventario,
  renderHistorialAlertas,
  actualizarSelectorBodegas,
  showToast,
  limpiarErroresFormulario,
  mostrarErrorCampo,
  setBotonCargando,
  validarEmail
} from "./ui.js";

// ==========================================
// ESTADO LOCAL DE LA APLICACIÓN
// ==========================================
const estado = {
  productos: [],
  alertas: [],
  filtroTexto: "",
  filtroBodega: "",
  productoSeleccionado: null,
  tipoMovimiento: "ENTRADA" // 'ENTRADA' | 'SALIDA'
};

// ==========================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ==========================================
const dom = {
  // Filtros y búsqueda
  inputBuscar: document.getElementById("input-buscar"),
  filtroBodega: document.getElementById("filtro-bodega"),
  btnLimpiarFiltros: document.getElementById("btn-limpiar-filtros"),

  // Modal Nuevo Producto
  btnAbrirModalNuevo: document.getElementById("btn-abrir-modal-nuevo"),
  btnCerrarModalNuevo: document.getElementById("btn-cerrar-modal-nuevo"),
  btnCancelarModalNuevo: document.getElementById("btn-cancelar-modal-nuevo"),
  modalNuevoProducto: document.getElementById("modal-nuevo-producto"),
  formNuevoProducto: document.getElementById("form-nuevo-producto"),
  btnGuardarNuevoProducto: document.getElementById("btn-guardar-nuevo-producto"),

  // Campos de formulario Nuevo Producto
  inputSku: document.getElementById("nuevo-sku"),
  inputNombre: document.getElementById("nuevo-nombre"),
  inputBodega: document.getElementById("nuevo-bodega"),
  inputStockActual: document.getElementById("nuevo-stock-actual"),
  inputStockMinimo: document.getElementById("nuevo-stock-minimo"),
  inputProveedorEmail: document.getElementById("nuevo-proveedor-email"),

  // Modal Registrar Movimiento (Entrada/Salida)
  modalMovimiento: document.getElementById("modal-movimiento"),
  btnCerrarModalMovimiento: document.getElementById("btn-cerrar-modal-movimiento"),
  btnCancelarModalMovimiento: document.getElementById("btn-cancelar-modal-movimiento"),
  formMovimiento: document.getElementById("form-movimiento"),
  btnConfirmarMovimiento: document.getElementById("btn-confirmar-movimiento"),
  tituloModalMovimiento: document.getElementById("titulo-modal-movimiento"),
  descModalMovimiento: document.getElementById("desc-modal-movimiento"),
  infoProductoMovimiento: document.getElementById("info-producto-movimiento"),
  inputCantidadMovimiento: document.getElementById("movimiento-cantidad"),
  previewStockResultante: document.getElementById("preview-stock-resultante"),

  // Tabla de inventario (para delegación de eventos)
  tbodyInventario: document.getElementById("tbody-inventario"),

  // Indicador de estado de conexión
  badgeConexion: document.getElementById("badge-conexion"),
  bannerConfig: document.getElementById("banner-configuracion")
};

// ==========================================
// FUNCIONES DE RENDERIZADO Y CÁLCULO
// ==========================================

/**
 * Filtra los productos según el término de búsqueda y la bodega seleccionada.
 * Actualiza la tabla de inventario y los KPIs.
 */
function actualizarVistaInventario() {
  const query = estado.filtroTexto.trim().toLowerCase();
  const bodega = estado.filtroBodega;

  const filtrados = estado.productos.filter((prod) => {
    const coincideTexto =
      !query ||
      (prod.sku && prod.sku.toLowerCase().includes(query)) ||
      (prod.nombre_producto && prod.nombre_producto.toLowerCase().includes(query));

    const coincideBodega = !bodega || prod.bodega === bodega;

    return coincideTexto && coincideBodega;
  });

  // Renderizar tabla con productos filtrados
  renderTablaInventario(filtrados);

  // Calcular KPIs con base en la lista completa de productos
  const totalProductos = estado.productos.length;
  const productosCriticos = estado.productos.filter(
    (p) => Number(p.stock_actual) <= Number(p.stock_minimo)
  ).length;
  const totalAlertas = estado.alertas.length;

  renderKPIs({ totalProductos, productosCriticos, totalAlertas });

  // Extraer lista única de bodegas para el dropdown
  const bodegasUnicas = [...new Set(estado.productos.map((p) => p.bodega).filter(Boolean))].sort();
  actualizarSelectorBodegas(bodegasUnicas, estado.filtroBodega);
}

// ==========================================
// GESTIÓN DE MODALES
// ==========================================

/**
 * Abre el modal para registrar un nuevo producto.
 */
function abrirModalNuevoProducto() {
  if (!dom.modalNuevoProducto) return;
  limpiarErroresFormulario(dom.formNuevoProducto);
  dom.formNuevoProducto.reset();
  dom.modalNuevoProducto.classList.remove("hidden");
  dom.modalNuevoProducto.classList.add("flex");
  setTimeout(() => dom.inputSku && dom.inputSku.focus(), 50);
}

/**
 * Cierra el modal de nuevo producto.
 */
function cerrarModalNuevoProducto() {
  if (!dom.modalNuevoProducto) return;
  dom.modalNuevoProducto.classList.add("hidden");
  dom.modalNuevoProducto.classList.remove("flex");
  limpiarErroresFormulario(dom.formNuevoProducto);
}

/**
 * Abre el modal de Entrada / Salida para un producto específico.
 * @param {string} productoId
 * @param {'ENTRADA' | 'SALIDA'} tipo
 */
function abrirModalMovimiento(productoId, tipo) {
  const producto = estado.productos.find((p) => p.id === productoId);
  if (!producto) {
    showToast("No se encontró el producto seleccionado.", "error");
    return;
  }

  estado.productoSeleccionado = producto;
  estado.tipoMovimiento = tipo;

  limpiarErroresFormulario(dom.formMovimiento);
  dom.formMovimiento.reset();

  const esEntrada = tipo === "ENTRADA";

  // Configuración de títulos y estilos según el tipo de movimiento
  if (dom.tituloModalMovimiento) {
    dom.tituloModalMovimiento.textContent = esEntrada
      ? "Registrar Entrada de Stock"
      : "Registrar Salida de Stock";
  }

  if (dom.descModalMovimiento) {
    dom.descModalMovimiento.textContent = esEntrada
      ? "Ingresa las unidades recibidas para sumar al inventario disponible."
      : "Registra las unidades despachadas. Si el stock cae al mínimo o menos, se alertará automáticamente.";
  }

  if (dom.infoProductoMovimiento) {
    dom.infoProductoMovimiento.innerHTML = `
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
        <div class="flex justify-between font-semibold text-slate-900">
          <span>${producto.nombre_producto}</span>
          <span class="font-mono">${producto.sku}</span>
        </div>
        <div class="flex justify-between text-slate-600">
          <span>Bodega: <strong>${producto.bodega}</strong></span>
          <span>Stock mínimo: <strong>${producto.stock_minimo}</strong></span>
        </div>
        <div class="flex justify-between pt-1 border-t border-slate-200">
          <span>Stock actual:</span>
          <span class="font-bold text-sm ${Number(producto.stock_actual) <= Number(producto.stock_minimo) ? 'text-red-600' : 'text-slate-900'}">
            ${producto.stock_actual} unidades
          </span>
        </div>
      </div>
    `;
  }

  // Personalización del botón de confirmación
  if (dom.btnConfirmarMovimiento) {
    if (esEntrada) {
      dom.btnConfirmarMovimiento.className =
        "w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
      dom.btnConfirmarMovimiento.textContent = "Confirmar Entrada";
    } else {
      dom.btnConfirmarMovimiento.className =
        "w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500";
      dom.btnConfirmarMovimiento.textContent = "Confirmar Salida";
    }
  }

  actualizarPreviewStock();

  if (dom.modalMovimiento) {
    dom.modalMovimiento.classList.remove("hidden");
    dom.modalMovimiento.classList.add("flex");
    setTimeout(() => dom.inputCantidadMovimiento && dom.inputCantidadMovimiento.focus(), 50);
  }
}

/**
 * Calcula y muestra el stock resultante estimado mientras el usuario digita la cantidad.
 */
function actualizarPreviewStock() {
  if (!dom.previewStockResultante || !estado.productoSeleccionado) return;

  const stockActual = Number(estado.productoSeleccionado.stock_actual);
  const stockMinimo = Number(estado.productoSeleccionado.stock_minimo);
  const cantidad = parseInt(dom.inputCantidadMovimiento.value, 10);

  if (isNaN(cantidad) || cantidad <= 0) {
    dom.previewStockResultante.innerHTML = `<span class="text-slate-400">Ingrese una cantidad válida</span>`;
    return;
  }

  const esEntrada = estado.tipoMovimiento === "ENTRADA";
  const resultante = esEntrada ? stockActual + cantidad : stockActual - cantidad;

  if (resultante < 0) {
    dom.previewStockResultante.innerHTML = `
      <span class="text-red-600 font-bold">
        ${resultante} (Insuficiente: excede en ${Math.abs(resultante)} unidades el stock)
      </span>
    `;
  } else if (resultante <= stockMinimo) {
    dom.previewStockResultante.innerHTML = `
      <span class="text-red-600 font-bold">
        ${resultante} unidades (¡Entrará en estado CRÍTICO!)
      </span>
    `;
  } else {
    dom.previewStockResultante.innerHTML = `
      <span class="text-emerald-700 font-bold">
        ${resultante} unidades (Stock óptimo)
      </span>
    `;
  }
}

/**
 * Cierra el modal de movimiento.
 */
function cerrarModalMovimiento() {
  if (!dom.modalMovimiento) return;
  dom.modalMovimiento.classList.add("hidden");
  dom.modalMovimiento.classList.remove("flex");
  estado.productoSeleccionado = null;
  limpiarErroresFormulario(dom.formMovimiento);
}

// ==========================================
// VALIDACIONES Y ACCIONES DE FORMULARIOS
// ==========================================

/**
 * Maneja el envío del formulario para crear un nuevo producto.
 * Valida todos los campos en el DOM sin utilizar alert(), prompt() ni confirm().
 * @param {Event} e
 */
async function handleCrearProducto(e) {
  e.preventDefault();
  limpiarErroresFormulario(dom.formNuevoProducto);

  let esValido = true;

  const sku = dom.inputSku.value.trim();
  const nombre = dom.inputNombre.value.trim();
  const bodega = dom.inputBodega.value.trim();
  const stockActualStr = dom.inputStockActual.value.trim();
  const stockMinimoStr = dom.inputStockMinimo.value.trim();
  const proveedorEmail = dom.inputProveedorEmail.value.trim();

  // 1. Validación de SKU
  if (!sku) {
    mostrarErrorCampo(dom.inputSku, "El código SKU es obligatorio.");
    esValido = false;
  } else if (sku.length < 3) {
    mostrarErrorCampo(dom.inputSku, "El SKU debe tener al menos 3 caracteres.");
    esValido = false;
  }

  // 2. Validación de Nombre
  if (!nombre) {
    mostrarErrorCampo(dom.inputNombre, "El nombre del producto es obligatorio.");
    esValido = false;
  }

  // 3. Validación de Bodega
  if (!bodega) {
    mostrarErrorCampo(dom.inputBodega, "Debe especificar la bodega o ubicación.");
    esValido = false;
  }

  // 4. Validación de Stock Actual (entero >= 0)
  const stockActual = Number(stockActualStr);
  if (stockActualStr === "" || isNaN(stockActual) || !Number.isInteger(stockActual) || stockActual < 0) {
    mostrarErrorCampo(dom.inputStockActual, "El stock actual debe ser un número entero mayor o igual a 0.");
    esValido = false;
  }

  // 5. Validación de Stock Mínimo (entero >= 0)
  const stockMinimo = Number(stockMinimoStr);
  if (stockMinimoStr === "" || isNaN(stockMinimo) || !Number.isInteger(stockMinimo) || stockMinimo < 0) {
    mostrarErrorCampo(dom.inputStockMinimo, "El stock de seguridad debe ser un número entero mayor o igual a 0.");
    esValido = false;
  }

  // 6. Validación de Correo del Proveedor
  if (!proveedorEmail) {
    mostrarErrorCampo(dom.inputProveedorEmail, "El correo del proveedor es obligatorio para notificaciones.");
    esValido = false;
  } else if (!validarEmail(proveedorEmail)) {
    mostrarErrorCampo(dom.inputProveedorEmail, "Ingrese una dirección de correo electrónico válida (ej: proveedor@empresa.com).");
    esValido = false;
  }

  if (!esValido) return;

  setBotonCargando(dom.btnGuardarNuevoProducto, true, "Guardar Producto", "Guardando...");

  const resultado = await crearProducto({
    sku,
    nombre_producto: nombre,
    bodega,
    stock_actual: stockActual,
    stock_minimo: stockMinimo,
    proveedor_email: proveedorEmail
  });

  setBotonCargando(dom.btnGuardarNuevoProducto, false, "Guardar Producto");

  if (!resultado.success) {
    showToast(resultado.error, "error");
    return;
  }

  showToast(`Producto "${resultado.data.nombre_producto}" creado con éxito.`, "success");
  cerrarModalNuevoProducto();

  // Actualizar estado local si Realtime aún no ha transmitido el evento
  const yaExiste = estado.productos.some((p) => p.id === resultado.data.id);
  if (!yaExiste) {
    estado.productos.push(resultado.data);
    estado.productos.sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto));
    actualizarVistaInventario();
  }
}

/**
 * Maneja el envío del formulario de Entrada o Salida de mercancía.
 * Ejecuta la RPC de Supabase y notifica de forma asíncrona a N8N.
 * @param {Event} e
 */
async function handleRegistrarMovimiento(e) {
  e.preventDefault();
  limpiarErroresFormulario(dom.formMovimiento);

  if (!estado.productoSeleccionado) {
    showToast("Error: No hay ningún producto seleccionado.", "error");
    return;
  }

  const cantidadStr = dom.inputCantidadMovimiento.value.trim();
  const cantidad = Number(cantidadStr);

  // Validación de cantidad en el cliente (entero > 0)
  if (cantidadStr === "" || isNaN(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
    mostrarErrorCampo(dom.inputCantidadMovimiento, "La cantidad debe ser un número entero mayor a cero.");
    return;
  }

  // Validación preventiva en cliente para salida que supere el stock disponible
  const stockActual = Number(estado.productoSeleccionado.stock_actual);
  if (estado.tipoMovimiento === "SALIDA" && cantidad > stockActual) {
    mostrarErrorCampo(
      dom.inputCantidadMovimiento,
      `No es posible retirar ${cantidad} unidades. El stock actual disponible es de solo ${stockActual}.`
    );
    return;
  }

  const textoBtn = estado.tipoMovimiento === "ENTRADA" ? "Confirmar Entrada" : "Confirmar Salida";
  setBotonCargando(dom.btnConfirmarMovimiento, true, textoBtn, "Registrando...");

  // Llamada a la RPC atómica en Supabase
  const resRpc = await registrarMovimiento(
    estado.productoSeleccionado.id,
    estado.tipoMovimiento,
    cantidad
  );

  setBotonCargando(dom.btnConfirmarMovimiento, false, textoBtn);

  if (!resRpc.success) {
    // Si la base de datos aborta (ej. stock insuficiente por concurrencia), muestra error claro
    mostrarErrorCampo(dom.inputCantidadMovimiento, resRpc.error);
    showToast(resRpc.error, "error");
    return;
  }

  const productoActualizado = resRpc.data;

  // Actualizar inmediatamente en el estado local
  const index = estado.productos.findIndex((p) => p.id === productoActualizado.id);
  if (index !== -1) {
    estado.productos[index] = productoActualizado;
  }
  actualizarVistaInventario();

  const tipoLabel = estado.tipoMovimiento === "ENTRADA" ? "Entrada" : "Salida";
  showToast(
    `Se registraron ${cantidad} unidades de ${tipoLabel} para "${productoActualizado.nombre_producto}".`,
    "success"
  );

  cerrarModalMovimiento();

  // Enviar evento al webhook de N8N en segundo plano con AbortController (timeout 8s)
  notificarActualizacionN8N({
    producto: productoActualizado,
    tipoMovimiento: estado.tipoMovimiento,
    cantidad: cantidad
  }).then((resWebhook) => {
    if (resWebhook.success) {
      showToast(resWebhook.mensaje, "info", 6000);
    } else if (resWebhook.isWarning) {
      // Si el webhook falla o expira, el stock YA se guardó: muestra aviso amarillo, no error fatal
      showToast(resWebhook.mensaje, "warning", 7000);
    }
  });
}

// ==========================================
// SUSCRIPCIONES REALTIME DE SUPABASE
// ==========================================

/**
 * Conecta los canales Realtime de Supabase para actualización automática.
 */
function iniciarSuscripcionesRealtime() {
  if (!estaConfiguradoSupabase()) return;

  // 1. Canal Realtime para inventario_productos
  suscribirInventario(
    // onInsert
    (nuevoProd) => {
      const idx = estado.productos.findIndex((p) => p.id === nuevoProd.id);
      if (idx === -1) {
        estado.productos.push(nuevoProd);
        estado.productos.sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto));
        actualizarVistaInventario();
      }
    },
    // onUpdate
    (prodActualizado) => {
      const idx = estado.productos.findIndex((p) => p.id === prodActualizado.id);
      if (idx !== -1) {
        estado.productos[idx] = prodActualizado;
      } else {
        estado.productos.push(prodActualizado);
      }
      actualizarVistaInventario();
    },
    // onDelete
    (prodEliminado) => {
      estado.productos = estado.productos.filter((p) => p.id !== prodEliminado.id);
      actualizarVistaInventario();
    }
  );

  // 2. Canal Realtime para alertas_reabastecimiento
  suscribirAlertas((nuevaAlerta) => {
    // Agregar al inicio del historial
    estado.alertas.unshift(nuevaAlerta);
    renderHistorialAlertas(estado.alertas);

    // Actualizar contador de alertas en KPIs
    const elAlertas = document.getElementById("kpi-total-alertas");
    if (elAlertas) elAlertas.textContent = estado.alertas.length;

    // Toast informativo de nueva alerta generada
    showToast(
      `Alerta generada: ${nuevaAlerta.nombre_producto} (SKU: ${nuevaAlerta.sku}) requiere reabastecimiento.`,
      "warning",
      6000
    );
  });
}

// ==========================================
// CARGA INICIAL DE DATOS
// ==========================================

/**
 * Carga los productos y el historial de alertas iniciales desde Supabase.
 */
async function cargarDatosIniciales() {
  if (!estaConfiguradoSupabase()) {
    if (dom.bannerConfig) {
      dom.bannerConfig.classList.remove("hidden");
    }
    if (dom.badgeConexion) {
      dom.badgeConexion.className = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800";
      dom.badgeConexion.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
        Modo Demostración (Sin configurar)
      `;
    }
    return;
  }

  // Cargar productos y alertas en paralelo
  const [resProd, resAlertas] = await Promise.all([
    obtenerProductos(),
    obtenerAlertas(50)
  ]);

  if (resProd.success) {
    estado.productos = resProd.data;
    actualizarVistaInventario();
  } else {
    showToast(resProd.error, "error");
  }

  if (resAlertas.success) {
    estado.alertas = resAlertas.data;
    renderHistorialAlertas(estado.alertas);
    const elAlertas = document.getElementById("kpi-total-alertas");
    if (elAlertas) elAlertas.textContent = estado.alertas.length;
  } else {
    console.warn("No se pudo cargar el historial de alertas inicial:", resAlertas.error);
  }

  if (dom.badgeConexion) {
    dom.badgeConexion.className = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800";
    dom.badgeConexion.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
      Realtime Conectado
    `;
  }

  // Iniciar listeners en tiempo real
  iniciarSuscripcionesRealtime();
}

// ==========================================
// REGISTRO DE EVENTOS
// ==========================================

function inicializarEventos() {
  // Filtro por texto en búsqueda
  if (dom.inputBuscar) {
    dom.inputBuscar.addEventListener("input", (e) => {
      estado.filtroTexto = e.target.value;
      actualizarVistaInventario();
    });
  }

  // Filtro por bodega
  if (dom.filtroBodega) {
    dom.filtroBodega.addEventListener("change", (e) => {
      estado.filtroBodega = e.target.value;
      actualizarVistaInventario();
    });
  }

  // Botón limpiar filtros
  if (dom.btnLimpiarFiltros) {
    dom.btnLimpiarFiltros.addEventListener("click", () => {
      estado.filtroTexto = "";
      estado.filtroBodega = "";
      if (dom.inputBuscar) dom.inputBuscar.value = "";
      if (dom.filtroBodega) dom.filtroBodega.value = "";
      actualizarVistaInventario();
    });
  }

  // Apertura y cierre de modal Nuevo Producto
  if (dom.btnAbrirModalNuevo) dom.btnAbrirModalNuevo.addEventListener("click", abrirModalNuevoProducto);
  if (dom.btnCerrarModalNuevo) dom.btnCerrarModalNuevo.addEventListener("click", cerrarModalNuevoProducto);
  if (dom.btnCancelarModalNuevo) dom.btnCancelarModalNuevo.addEventListener("click", cerrarModalNuevoProducto);

  // Envío del formulario Nuevo Producto
  if (dom.formNuevoProducto) dom.formNuevoProducto.addEventListener("submit", handleCrearProducto);

  // Cierre de modal Movimiento
  if (dom.btnCerrarModalMovimiento) dom.btnCerrarModalMovimiento.addEventListener("click", cerrarModalMovimiento);
  if (dom.btnCancelarModalMovimiento) dom.btnCancelarModalMovimiento.addEventListener("click", cerrarModalMovimiento);

  // Cálculo en vivo de previsualización de stock
  if (dom.inputCantidadMovimiento) {
    dom.inputCantidadMovimiento.addEventListener("input", actualizarPreviewStock);
  }

  // Envío del formulario de Movimiento
  if (dom.formMovimiento) dom.formMovimiento.addEventListener("submit", handleRegistrarMovimiento);

  // Delegación de eventos en la tabla de inventario para Entrada y Salida
  if (dom.tbodyInventario) {
    dom.tbodyInventario.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-accion-movimiento");
      if (!btn) return;

      const accion = btn.dataset.action; // 'entrada' | 'salida'
      const productoId = btn.dataset.id;

      if (accion === "entrada") {
        abrirModalMovimiento(productoId, "ENTRADA");
      } else if (accion === "salida") {
        abrirModalMovimiento(productoId, "SALIDA");
      }
    });
  }

  // Cerrar modales con tecla Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarModalNuevoProducto();
      cerrarModalMovimiento();
    }
  });

  // Cerrar al hacer clic en el backdrop del modal
  if (dom.modalNuevoProducto) {
    dom.modalNuevoProducto.addEventListener("click", (e) => {
      if (e.target === dom.modalNuevoProducto) cerrarModalNuevoProducto();
    });
  }
  if (dom.modalMovimiento) {
    dom.modalMovimiento.addEventListener("click", (e) => {
      if (e.target === dom.modalMovimiento) cerrarModalMovimiento();
    });
  }
}

// ==========================================
// INICIALIZACIÓN AL CARGAR EL DOM
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  inicializarEventos();
  cargarDatosIniciales();
});
