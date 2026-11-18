/**
 * StockPulse - Archivo de Configuración Central
 * 
 * Define las constantes de conexión para Supabase y el Webhook de N8N.
 * IMPORTANTE: No utilices la clave 'service_role' en este archivo.
 * Usa únicamente la clave pública 'anon' de Supabase para respetar las políticas de RLS.
 */

// URL del proyecto Supabase (ejemplo: https://xyzcompany.supabase.co)
export const SUPABASE_URL = "https://fouriuekstmectbacslo.supabase.co";

// Clave pública anónima de Supabase (anon key)
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdXJpdWVrc3RtZWN0YmFjc2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwMDk4NzYsImV4cCI6MjExMDU4NTg3Nn0.hsFj9lCDZesQIVOaKhsyuI3W44CFfs37q5emMEsRkd0";

// URL del Webhook de N8N que recibe las alertas y actualizaciones de stock
export const N8N_WEBHOOK_URL = "https://stockpulse.app.n8n.cloud/webhook/stockpulse-actualizacion";

/**
 * Determina si las credenciales de Supabase aún contienen valores de placeholder.
 * @returns {boolean}
 */
export function estaConfiguradoSupabase() {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes("TU_PROYECTO") &&
    !SUPABASE_ANON_KEY.includes("TU_SUPABASE_ANON_KEY")
  );
}

/**
 * Determina si el Webhook de N8N aún contiene valores de placeholder.
 * @returns {boolean}
 */
export function estaConfiguradoN8N() {
  return (
    Boolean(N8N_WEBHOOK_URL) &&
    !N8N_WEBHOOK_URL.includes("tu-instancia-n8n")
  );
}
