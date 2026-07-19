// Sirve el mismo contenido que antes era el archivo estático version.json (la app
// lo consulta en cada apertura vía checkForUpdate() en src/checkUpdate.js), y de paso
// cuenta aperturas reales por plataforma — sin tocar ningún dato del usuario, solo
// suma 1 a un contador propio cada vez que llega esta petición. Ver plan en la
// conversación del 17/07/2026 (necesitábamos una fuente de "usuarios activos" real,
// ya que RevenueCat está dormido desde el hotfix 1.7.1 y Apple solo expone datos de
// usuarios que aceptaron compartir analíticas).
import { head, put } from "@vercel/blob";

const COUNTERS_PATH = "stats/counters.json";
const DIAS_A_CONSERVAR = 60;

const INFO_VERSION = {
  version: "1.9.0",
  mensaje:
    "Ya está disponible la versión 1.9.0: recuperación de acceso con clave de respaldo, Índice de Bienestar, mapa de calor inteligente, foco semanal y más.",
  storeAndroid: "https://play.google.com/store/apps/details?id=com.equorawellness.app",
  storeIos: "https://apps.apple.com/us/app/equora-wellness/id6766343717",
};

function detectarPlataforma(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  return "other";
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function podarDiasViejos(daily) {
  const claves = Object.keys(daily).sort();
  while (claves.length > DIAS_A_CONSERVAR) {
    delete daily[claves.shift()];
  }
}

async function registrarApertura(plataforma) {
  let data = { totals: { ios: 0, android: 0, other: 0 }, daily: {} };
  try {
    const meta = await head(COUNTERS_PATH);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (res.ok) data = await res.json();
  } catch (_) {
    // Primera vez que corre, o el blob todavía no existe — arranca en cero.
  }

  const dia = hoyISO();
  data.totals[plataforma] = (data.totals[plataforma] || 0) + 1;
  data.daily[dia] = data.daily[dia] || { ios: 0, android: 0, other: 0 };
  data.daily[dia][plataforma] = (data.daily[dia][plataforma] || 0) + 1;
  podarDiasViejos(data.daily);

  await put(COUNTERS_PATH, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export default async function handler(req, res) {
  const plataforma = detectarPlataforma(req.headers["user-agent"]);

  // El conteo es "mejor esfuerzo": si falla, jamás debe romper la respuesta real
  // que la app necesita para saber si hay una versión nueva. Se espera (await)
  // a propósito — en funciones serverless, el trabajo async que sigue corriendo
  // DESPUÉS de responder puede cortarse a mitad de camino (la función se congela
  // apenas se envía la respuesta), así que el conteo nunca se completaría.
  try {
    await registrarApertura(plataforma);
  } catch (_) {}

  // La app corre dentro de una WebView cuyo origen es https://localhost (Android) o
  // capacitor://localhost (iOS) — para el navegador esto es otro dominio, así que sin
  // este header la petición llega igual (el contador suma) pero el navegador le niega
  // la respuesta al JS: checkForUpdate() cae en su catch y el banner nunca aparece.
  // El asterisco es seguro AQUÍ porque este JSON es público (versión, mensaje, links
  // de tienda). No replicar en api/stats.js, que sí devuelve datos privados.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(INFO_VERSION);
}
