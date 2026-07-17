// Endpoint privado para consultar los contadores reales de aperturas por plataforma.
// No es público: exige la clave STATS_KEY (variable de entorno) como query param.
import { head } from "@vercel/blob";

const COUNTERS_PATH = "stats/counters.json";

export default async function handler(req, res) {
  const clave = req.query.key;
  if (!process.env.STATS_KEY || clave !== process.env.STATS_KEY) {
    res.status(403).json({ error: "No autorizado" });
    return;
  }

  try {
    const meta = await head(COUNTERS_PATH);
    const r = await fetch(meta.url, { cache: "no-store" });
    const data = await r.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(data);
  } catch (_) {
    res.status(200).json({ totals: { ios: 0, android: 0, other: 0 }, daily: {} });
  }
}
