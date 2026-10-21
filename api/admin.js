// لوحة التحكم: كل العمليات تمر من هنا (?a=اسم_العملية) وتحتاج تسجيل دخول المدير
import {
  handler, db, rpc, env, getSettings, sellPrice, storageUpload, makeAdminToken, requireAdmin,
  safeEqual, clean, HttpError,
} from "./_lib.js";
import { typeOf, categoryOf, genCodeOf, carsOf, yearsOf, CAT_NAMES } from "./_detect.js";

const STATUSES = ["pending_payment", "paid", "cod", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
const enc = encodeURIComponent;
const term = (v, n) => clean(v, n).replace(/[(),*%\\"]/g, " ").trim();

const actions = {
  // ---------- الدخول ----------
  async login(req) {
    const pw = (req.body || {}).password || "";
    await new Promise((r) => setTimeout(r, 400)); // يبطّئ محاولات التخمين
    if (!safeEqual(pw, env("ADMIN_PASSWORD"))) throw new HttpError(401, "كلمة المرور غير صحيحة");
    return { token: makeAdminToken(12) };
  },

  // ---------- الملخص ----------
  async stats() {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: orders } = await db(`orders?select=status,total,created_at&created_at=gte.${since}&order=created_at.desc&limit=5000`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const live = (o) => !["pending_payment", "cancelled", "refunded"].includes(o.status);
    const sum = (a) => a.reduce((s, o) => s + Number(o.total), 0);
    const todayO = orders.filter((o) => new Date(o.created_at) >= today && live(o));
    const open = orders.filter((o) => ["paid", "cod", "confirmed", "processing"].includes(o.status));
    const { headers } = await db("products?select=part_no&qty=lte.0&visible=eq.true", { prefer: "count=exact", headers: { Range: "0-0" } });
    const out = headers.get("content-range")?.split("/")[1];
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const n = new Date(d); n.setDate(n.getDate() + 1);
      const day = orders.filter((o) => live(o) && new Date(o.created_at) >= d && new Date(o.created_at) < n);
      days.push({ date: d.toISOString().slice(0, 10), orders: day.length, sales: sum(day) });
    }
    return {
      today_orders: todayO.length, today_sales: sum(todayO),
      month_orders: orders.filter(live).length, month_sales: sum(orders.filter(live)),
      open_orders: open.length, out_of_stock: Number(out) || 0, days,
    };
  },

  // ---------- الطلبات ----------
  async orders(req) {
    const q = req.query;
    const page = Math.max(0, Number(q.page) || 0), size = 30;
    let f = "";
    if (q.status === "open") f += "&status=in.(paid,cod,confirmed,processing)";
    else if (STATUSES.includes(q.status)) f += `&status=eq.${q.status}`;
    const s = term(q.q, 40);
    if (s) {
      if (/^\d{3,7}$/.test(s)) f += `&number=eq.${s}`;
      else f += `&or=(customer_name.ilike.*${enc(s)}*,phone.ilike.*${enc(s.replace(/\D/g, "") || s)}*,vin.ilike.*${enc(s)}*)`;
    }
    const { data, headers } = await db(`orders?select=*&order=created_at.desc${f}`, {
      prefer: "count=exact", headers: { Range: `${page * size}-${page * size + size - 1}` },
    });
    return { rows: data, total: Number(headers.get("content-range")?.split("/")[1]) || 0, size };
  },

  async order_update(req) {
    const b = req.body || {};
    if (!/^[0-9a-f-]{36}$/i.test(b.id || "")) throw new HttpError(400, "طلب غير صحيح");
    const { data } = await db(`orders?select=id,status,stock_applied&id=eq.${b.id}`);
    const cur = data[0];
    if (!cur) throw new HttpError(404, "الطلب غير موجود");
    const patch = { updated_at: new Date().toISOString() };
    for (const k of ["carrier", "tracking_no", "tracking_url", "admin_note"]) if (k in b) patch[k] = clean(b[k], k === "admin_note" ? 1000 : 300) || null;
    if (b.status) {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, "حالة غير معروفة");
      patch.status = b.status;
    }
    await db(`orders?id=eq.${b.id}`, { method: "PATCH", body: patch });
    if (b.status === "cancelled" || b.status === "refunded") await rpc("restore_order_stock", { p_order: b.id });
    else if (b.status && b.status !== "pending_payment") await rpc("apply_order_stock", { p_order: b.id });
    return { ok: true };
  },

  // ---------- الأصناف ----------
  async products(req) {
    const q = req.query;
    const page = Math.max(0, Number(q.page) || 0), size = 50;
    let f = "";
    const s = term(q.q, 60);
    if (s) f += `&or=(name.ilike.*${enc(s)}*,part_no.ilike.*${enc(s)}*)`;
    if (q.filter === "hidden") f += "&visible=eq.false";
    if (q.filter === "out") f += "&qty=lte.0";
    if (q.filter === "noprice") f += "&wholesale=lte.0&price_override=is.null";
    if (q.filter === "noimage") f += "&image_url=is.null";
    if (q.category) f += `&category=eq.${enc(q.category)}`;
    const { data, headers } = await db(`products?select=*&order=updated_at.desc${f}`, {
      prefer: "count=exact", headers: { Range: `${page * size}-${page * size + size - 1}` },
    });
    const store = (await getSettings()).store || {};
    return { rows: data.map((p) => ({ ...p, sell_price: sellPrice(p, store) })), total: Number(headers.get("content-range")?.split("/")[1]) || 0, size, categories: CAT_NAMES };
  },

  async product_save(req) {
    const b = req.body || {};
    const part_no = clean(b.part_no, 40).toUpperCase();
    if (!/^[0-9A-Z-]{5,40}$/.test(part_no)) throw new HttpError(400, "رقم القطعة غير صحيح");
    const row = { part_no, updated_at: new Date().toISOString() };
    if ("name" in b) { row.name = clean(b.name, 200); if (!row.name) throw new HttpError(400, "اكتب اسم القطعة"); }
    if ("type" in b) { if (!["a", "m", "k", "c"].includes(b.type)) throw new HttpError(400, "نوع غير صحيح"); row.type = b.type; }
    if ("qty" in b) row.qty = Math.max(0, Math.floor(Number(b.qty) || 0));
    if ("wholesale" in b) row.wholesale = Math.max(0, Number(b.wholesale) || 0);
    if ("price_override" in b) row.price_override = b.price_override === "" || b.price_override == null ? null : Math.max(0, Number(b.price_override));
    if ("cars" in b) row.cars = (Array.isArray(b.cars) ? b.cars : String(b.cars).split(/[،,]/)).map((c) => clean(c, 40)).filter(Boolean);
    if ("y_from" in b) row.y_from = b.y_from ? Number(b.y_from) : null;
    if ("y_to" in b) row.y_to = b.y_to ? Number(b.y_to) : null;
    if ("gen_code" in b) row.gen_code = clean(b.gen_code, 4).toUpperCase() || null;
    if ("category" in b) { if (!CAT_NAMES[b.category]) throw new HttpError(400, "قسم غير معروف"); row.category = b.category; }
    if ("visible" in b) row.visible = !!b.visible;
    if ("image_url" in b) row.image_url = clean(b.image_url, 500) || null;
    if (b.create) {
      if (!row.name) throw new HttpError(400, "اكتب اسم القطعة");
      row.type = row.type || typeOf(part_no);
      row.category = row.category || categoryOf(row.name);
      row.gen_code = row.gen_code ?? genCodeOf(part_no);
      await db("products", { method: "POST", body: row, prefer: "resolution=merge-duplicates" });
    } else {
      await db(`products?part_no=eq.${enc(part_no)}`, { method: "PATCH", body: row });
    }
    return { ok: true };
  },

  async product_image(req) {
    const b = req.body || {};
    const part_no = clean(b.part_no, 40).toUpperCase();
    const m = String(b.data || "").match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
    if (!m) throw new HttpError(400, "الصورة لازم تكون JPG أو PNG أو WEBP");
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 3 * 1024 * 1024) throw new HttpError(400, "حجم الصورة أكبر من 3 ميجا");
    const ext = m[2] === "jpeg" ? "jpg" : m[2];
    const url = await storageUpload("products", `${part_no}-${Date.now()}.${ext}`, buf, m[1]);
    await db(`products?part_no=eq.${enc(part_no)}`, { method: "PATCH", body: { image_url: url, updated_at: new Date().toISOString() } });
    return { url };
  },

  /** دمج تقرير المخزون: يحدّث الكمية وسعر الجملة للموجود، ويضيف الجديد مصنّفاً تلقائياً. الأصناف غير الموجودة في التقرير لا تتغير. */
  async import(req) {
    const rows = Array.isArray((req.body || {}).rows) ? req.body.rows : [];
    if (!rows.length) throw new HttpError(400, "التقرير فاضي");
    if (rows.length > 20000) throw new HttpError(400, "التقرير كبير جداً، قسّمه");
    const merged = new Map();
    for (const r of rows) {
      const p = clean(r.part_no, 40).toUpperCase().replace(/\s+/g, "");
      if (!/^[0-9A-Z-]{5,40}$/.test(p)) continue;
      const cur = merged.get(p) || { part_no: p, name: "", qty: 0, wholesale: 0 };
      cur.qty += Math.max(0, Math.floor(Number(r.qty) || 0));
      if (!cur.name && r.name) cur.name = clean(r.name, 200);
      const w = Number(r.wholesale) || 0;
      if (w > 0) cur.wholesale = w;
      merged.set(p, cur);
    }
    const all = [...merged.values()];
    const existing = new Set();
    for (let i = 0; i < all.length; i += 300) {
      const list = all.slice(i, i + 300).map((r) => `"${r.part_no}"`).join(",");
      const { data } = await db(`products?select=part_no&part_no=in.(${enc(list)})`);
      data.forEach((d) => existing.add(d.part_no));
    }
    const { data: cars } = await db("cars?select=name");
    const carNames = cars.map((c) => c.name);
    const now = new Date().toISOString();
    const upd1 = [], upd2 = [], fresh = [];
    for (const r of all) {
      if (existing.has(r.part_no)) {
        if (r.wholesale > 0) upd1.push({ part_no: r.part_no, qty: r.qty, wholesale: r.wholesale, updated_at: now });
        else upd2.push({ part_no: r.part_no, qty: r.qty, updated_at: now });
      } else if (r.name) {
        const [y_from, y_to] = yearsOf(r.name);
        fresh.push({
          part_no: r.part_no, name: r.name, qty: r.qty, wholesale: r.wholesale, type: typeOf(r.part_no),
          category: categoryOf(r.name), gen_code: genCodeOf(r.part_no), cars: carsOf(r.name, carNames),
          y_from, y_to, visible: true, updated_at: now,
        });
      }
    }
    const up = async (list) => {
      for (let i = 0; i < list.length; i += 500)
        await db("products?on_conflict=part_no", { method: "POST", body: list.slice(i, i + 500), prefer: "resolution=merge-duplicates,return=minimal" });
    };
    await up(upd1); await up(upd2); await up(fresh);
    return { updated: upd1.length + upd2.length, added: fresh.length, skipped: rows.length - all.length };
  },

  // ---------- الإعدادات ----------
  async settings_get() {
    const s = await getSettings();
    const { data: cars } = await db("cars?select=name,make&order=make,name");
    return { ...s, cars };
  },
  async settings_save(req) {
    const b = req.body || {};
    if (b.store) {
      const s = b.store;
      const store = {
        name: clean(s.name, 60) || "عزم المتحدة",
        whatsapp: String(s.whatsapp || "").replace(/\D/g, "").slice(0, 15),
        markup: Math.min(5, Math.max(0, Number(s.markup) || 0)),
        round_to: [1, 5, 10].includes(Number(s.round_to)) ? Number(s.round_to) : 1,
        vat_included: s.vat_included !== false,
        cod_enabled: !!s.cod_enabled,
        card_enabled: s.card_enabled !== false,
      };
      await db("settings?key=eq.store", { method: "PATCH", body: { value: store } });
    }
    if (b.shipping) {
      const s = b.shipping, cities = {};
      for (const [k, v] of Object.entries(s.cities || {})) { const c = clean(k, 40); if (c) cities[c] = Math.max(0, Number(v) || 0); }
      const shipping = {
        default_fee: Math.max(0, Number(s.default_fee) || 0),
        free_over: Math.max(0, Number(s.free_over) || 0),
        pickup_enabled: !!s.pickup_enabled,
        pickup_label: clean(s.pickup_label, 120) || "استلام من المحل",
        cities,
      };
      await db("settings?key=eq.shipping", { method: "PATCH", body: { value: shipping } });
    }
    return { ok: true };
  },
};

export default handler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const a = String((req.query || {}).a || "");
  const fn = Object.prototype.hasOwnProperty.call(actions, a) ? actions[a] : null;
  if (!fn) throw new HttpError(404, "عملية غير معروفة");
  if (a !== "login") requireAdmin(req);
  res.json(await fn(req));
});
