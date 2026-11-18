/**
 * StockPulse - Cliente de Conexión a Supabase
 * 
 * Utiliza @supabase/supabase-js v2 como módulo ES oficial desde CDN.
 * Configura el cliente con soporte para Supabase Realtime habilitado.
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, estaConfiguradoSupabase } from "./config.js";

let supabaseClient = null;

if (estaConfiguradoSupabase()) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  } catch (error) {
    console.error("StockPulse: Error al inicializar el cliente de Supabase.", error);
  }
} else {
  console.warn("StockPulse: Credenciales de Supabase pendientes de configuración en js/config.js");
}

export const supabase = supabaseClient;
