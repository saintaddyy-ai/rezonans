// Воркер ТОЛЬКО для оплаты (сайт лежит на GitHub Pages).
// Переменные в Cloudflare (Settings -> Variables and Secrets):
//   LAVA_SECRET  (тип Secret) - ваш API-ключ Lava
//   SITE_ORIGIN  (тип Text)   - адрес сайта БЕЗ слеша и БЕЗ пути, например https://ваш-ник.github.io
//   USD_RATE     (необязательно) - множитель, если счета в Lava не в USD

const PRICE_GIRLS_CENTS = 4139; // $41.39
const PRICE_MEN_CENTS = 5433;   // $54.33
const MAX_PER_TYPE = 10;
const SHOP_ID = "672a3921-e0e0-4599-bfa7-63d7ead048ee"; // ID проекта Lava (не секрет)

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.SITE_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ error: "method" }, 405, cors);
    if (!env.LAVA_SECRET) return reply({ error: "missing LAVA_SECRET", seen_variable_names: Object.keys(env) }, 500, cors);

    let b;
    try { b = await req.json(); } catch (e) { return reply({ error: "bad json" }, 400, cors); }

    const girls = Number.isInteger(b.girls) ? b.girls : 0;
    const men = Number.isInteger(b.men) ? b.men : 0;
    const name = String(b.name || "").trim().slice(0, 80);
    const tg = String(b.tg || "").trim().slice(0, 60);
    const phone = String(b.phone || "").trim().slice(0, 30);
    if (girls < 0 || men < 0 || girls > MAX_PER_TYPE || men > MAX_PER_TYPE || girls + men < 1) return reply({ error: "bad quantity" }, 400, cors);
    if (!name || (!tg && !phone)) return reply({ error: "bad contact" }, 400, cors);

    // сумма считается только здесь
    const cents = girls * PRICE_GIRLS_CENTS + men * PRICE_MEN_CENTS;
    const rate = parseFloat(env.USD_RATE || "1");
    const sum = Math.round((cents / 100) * rate * 100) / 100;

    const back = req.headers.get("Origin") || env.SITE_ORIGIN || "";
    const body = JSON.stringify({
      shopId: SHOP_ID,
      sum: sum,
      orderId: crypto.randomUUID(),
      expire: 60,
      comment: "Party: girls " + girls + ", men " + men,
      customFields: JSON.stringify({ name: name, tg: tg, phone: phone, girls: girls, men: men }),
      successUrl: back,
      failUrl: back,
    });

    const r = await fetch("https://api.lava.ru/business/invoice/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Signature": String(env.LAVA_SECRET).trim() },
      body: body,
    });
    let d = null;
    try { d = await r.json(); } catch (e) {}
    const link = d && d.data && d.data.url;
    if (!link) return reply({ error: "lava", status: r.status, detail: d }, 502, cors);
    return reply({ url: link }, 200, cors);
  },
};

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status, headers: Object.assign({ "Content-Type": "application/json" }, cors) });
}
