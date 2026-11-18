/**
 * StockPulse - Servicio de Inventario y Alertas
 * 
 * Gestiona las operaciones de base de datos con Supabase:
 * - Consulta de productos y alertas
 * - Inserción de nuevos productos
 * - Ejecución de la función RPC atómica 'registrar_movimiento'
 * - Suscripciones en tiempo real (Supabase Realtime)
 */

import { supabase } from "./supabaseClient.js";

/**
 * Valida la disponibilidad del cliente de Supabase.
 * @throws {Error} si Supabase no está configurado.
 */
function verificarClienteSupabase() {
  if (!supabase) {
    throw new Error("Supabase no está configurado. Por favor, define tus credenciales en js/config.js.");
  }
}

/**
 * Obtiene la lista completa de productos ordenados por nombre.
 * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
 */
export async function obtenerProductos() {
  try {
    verificarClienteSupabase();

    const { data, error } = await supabase
      .from("inventario_productos")
      .select("*")
      .order("nombre_producto", { ascending: true });

    if (error) {
      console.error("Error al obtener productos:", error);
      return {
        success: false,
        error: "No se pudo cargar la lista de productos. Intente nuevamente."
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error("Excepción en obtenerProductos:", err);
    return {
      success: false,
      error: err.message || "Error inesperado al conectar con el inventario."
    };
  }
}

/**
 * Registra un nuevo producto en la tabla inventario_productos.
 * @param {Object} producto Datos del producto a registrar.
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function crearProducto(producto) {
  try {
    verificarClienteSupabase();

    const nuevoProducto = {
      sku: producto.sku.trim().toUpperCase(),
      nombre_producto: producto.nombre_producto.trim(),
      bodega: producto.bodega.trim(),
      stock_actual: parseInt(producto.stock_actual, 10),
      stock_minimo: parseInt(producto.stock_minimo, 10),
      proveedor_email: producto.proveedor_email.trim().toLowerCase(),
      ultima_actualizacion: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("inventario_productos")
      .insert([nuevoProducto])
      .select()
      .single();

    if (error) {
      console.error("Error al crear producto:", error);
      if (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("sku")) {
        return {
          success: false,
          error: "Ya existe un producto registrado con este código SKU."
        };
      }
      return {
        success: false,
        error: "No fue posible guardar el producto en la base de datos."
      };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Excepción en crearProducto:", err);
    return {
      success: false,
      error: err.message || "Error al intentar crear el producto."
    };
  }
}

/**
 * Ejecuta la función RPC 'registrar_movimiento' de forma atómica en Supabase.
 * Actualiza el stock, registra el movimiento y retorna el producto actualizado.
 * Si el stock es insuficiente, la base de datos aborta y lanza excepción.
 * 
 * @param {string} productoId UUID del producto.
 * @param {'ENTRADA' | 'SALIDA'} tipo Tipo de movimiento.
 * @param {number} cantidad Unidades a ingresar o retirar.
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function registrarMovimiento(productoId, tipo, cantidad) {
  try {
    verificarClienteSupabase();

    const cantidadEntera = parseInt(cantidad, 10);
    if (isNaN(cantidadEntera) || cantidadEntera <= 0) {
      return {
        success: false,
        error: "La cantidad debe ser un número entero mayor a cero."
      };
    }

    if (tipo !== "ENTRADA" && tipo !== "SALIDA") {
      return {
        success: false,
        error: "Tipo de movimiento no válido. Solo se permite ENTRADA o SALIDA."
      };
    }

    const { data, error } = await supabase.rpc("registrar_movimiento", {
      p_producto_id: productoId,
      p_tipo: tipo,
      p_cantidad: cantidadEntera
    });

    if (error) {
      console.error("Error devuelto por la función RPC registrar_movimiento:", error);
      
      const mensaje = error.message ? error.message.toLowerCase() : "";
      if (mensaje.includes("insuficiente") || mensaje.includes("stock") || mensaje.includes("saldo")) {
        return {
          success: false,
          error: "Stock insuficiente para realizar la salida solicitada."
        };
      }

      return {
        success: false,
        error: "No se pudo completar el movimiento. Verifique los datos e intente nuevamente."
      };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Excepción en registrarMovimiento:", err);
    return {
      success: false,
      error: err.message || "Error inesperado al registrar el movimiento."
    };
  }
}

/**
 * Obtiene el historial de alertas de reabastecimiento ordenado por fecha descendente.
 * @param {number} limite Cantidad máxima de alertas a recuperar (por defecto 50).
 * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
 */
export async function obtenerAlertas(limite = 50) {
  try {
    verificarClienteSupabase();

    const { data, error } = await supabase
      .from("alertas_reabastecimiento")
      .select("*")
      .order("creado_en", { ascending: false })
      .limit(limite);

    if (error) {
      console.error("Error al obtener alertas:", error);
      return {
        success: false,
        error: "No se pudo cargar el historial de alertas."
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error("Excepción en obtenerAlertas:", err);
    return {
      success: false,
      error: err.message || "Error al consultar las alertas."
    };
  }
}

/**
 * Suscribe la aplicación a cambios en tiempo real en la tabla inventario_productos.
 * @param {Function} onInsert Callback al insertar un nuevo producto.
 * @param {Function} onUpdate Callback al actualizar un producto existente.
 * @param {Function} onDelete Callback al eliminar un producto.
 * @returns {Object|null} Canal de Supabase Realtime o null si no está configurado.
 */
export function suscribirInventario(onInsert, onUpdate, onDelete) {
  if (!supabase) return null;

  try {
    const canal = supabase
      .channel("realtime-inventario-productos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventario_productos" },
        (payload) => {
          if (payload.eventType === "INSERT" && typeof onInsert === "function") {
            onInsert(payload.new);
          } else if (payload.eventType === "UPDATE" && typeof onUpdate === "function") {
            onUpdate(payload.new);
          } else if (payload.eventType === "DELETE" && typeof onDelete === "function") {
            onDelete(payload.old);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("StockPulse: Canal Realtime de inventario activo.");
        }
      });

    return canal;
  } catch (error) {
    console.error("Error al suscribir a Realtime de inventario:", error);
    return null;
  }
}

/**
 * Suscribe la aplicación a nuevas alertas en la tabla alertas_reabastecimiento.
 * @param {Function} onInsert Callback al crearse una nueva alerta.
 * @returns {Object|null} Canal de Supabase Realtime o null si no está configurado.
 */
export function suscribirAlertas(onInsert) {
  if (!supabase) return null;

  try {
    const canal = supabase
      .channel("realtime-alertas-reabastecimiento")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alertas_reabastecimiento" },
        (payload) => {
          if (typeof onInsert === "function") {
            onInsert(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("StockPulse: Canal Realtime de alertas activo.");
        }
      });

    return canal;
  } catch (error) {
    console.error("Error al suscribir a Realtime de alertas:", error);
    return null;
  }
}
