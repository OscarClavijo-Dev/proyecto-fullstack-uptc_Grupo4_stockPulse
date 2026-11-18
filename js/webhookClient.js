/**
 * StockPulse - Cliente de Automatización Webhook N8N
 * 
 * Envía notificaciones de actualización de inventario a N8N mediante HTTP POST.
 * Implementa timeout estricto de 8 segundos con AbortController.
 * Si la petición falla o expira, no genera error fatal, permitiendo informar
 * al usuario que el stock ya fue guardado en la base de datos de forma segura.
 */

import { N8N_WEBHOOK_URL, estaConfiguradoN8N } from "./config.js";

/**
 * Envía el evento de actualización de stock al webhook de N8N.
 * 
 * @param {Object} params Parámetros para construir el payload exacto requerido.
 * @param {Object} params.producto Objeto producto actualizado retornado por la RPC de Supabase.
 * @param {'ENTRADA' | 'SALIDA'} params.tipoMovimiento Tipo de movimiento ejecutado.
 * @param {number} params.cantidad Unidades del movimiento.
 * @returns {Promise<{ success: boolean, clasificacion?: string, isWarning?: boolean, mensaje: string }>}
 */
export async function notificarActualizacionN8N({ producto, tipoMovimiento, cantidad }) {
  // Validar si la URL del webhook está configurada
  if (!estaConfiguradoN8N()) {
    console.warn("StockPulse: Webhook de N8N no configurado en js/config.js");
    return {
      success: false,
      isWarning: true,
      mensaje: "Stock actualizado en BD. Webhook N8N no configurado (notificación omitida)."
    };
  }

  // Payload exacto según especificación
  const payload = {
    evento: "actualizacion_stock",
    producto_id: producto.id,
    sku: producto.sku,
    nombre_producto: producto.nombre_producto,
    bodega: producto.bodega,
    stock_actual: parseInt(producto.stock_actual, 10),
    stock_minimo: parseInt(producto.stock_minimo, 10),
    proveedor_email: producto.proveedor_email,
    tipo_movimiento: tipoMovimiento,
    cantidad: parseInt(cantidad, 10),
    timestamp: new Date().toISOString()
  };

  const controller = new AbortController();
  const timeoutMs = 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`StockPulse: N8N respondió con código HTTP ${response.status}`);
      return {
        success: false,
        isWarning: true,
        mensaje: `Stock guardado. Webhook N8N reportó estado HTTP ${response.status}.`
      };
    }

    let respuestaJson = null;
    const responseText = await response.text();
    
    try {
      respuestaJson = responseText ? JSON.parse(responseText) : {};
    } catch {
      respuestaJson = {};
    }

    // Extraer campo 'clasificacion' devuelto por N8N o valor predeterminado amigable
    const clasificacion = respuestaJson.clasificacion || "Notificación de stock procesada por N8N";

    return {
      success: true,
      isWarning: false,
      clasificacion: clasificacion,
      mensaje: `N8N: ${clasificacion}`
    };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      console.warn("StockPulse: Timeout (8s) al enviar webhook a N8N.");
      return {
        success: false,
        isWarning: true,
        mensaje: "Stock guardado. Tiempo de espera agotado (8 s) al contactar N8N."
      };
    }

    console.warn("StockPulse: Fallo de conexión con webhook N8N:", error);
    return {
      success: false,
      isWarning: true,
      mensaje: "Stock guardado. No fue posible conectar con el webhook de N8N."
    };
  }
}
