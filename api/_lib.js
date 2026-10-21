// أدوات مشتركة لدوال الخادم. الملف يبدأ بـ _ فلا يصير رابطاً مستقلاً في Vercel.
import crypto from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function env(name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `الإعداد ${name} غير مضبوط في Vercel`);
  return v;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** طلب إلى قاعدة البيانات Supabase بالمفتاح السري (من الخادم فقط) */
export async function db(path, { method = "GET", body, prefer, headers = {} } = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new HttpError(500, "إعدادات Supabase غير مضبوطة");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    console.error("Supabase error", res.status, path, text);
    throw new HttpError(502, "تعذّر الاتصال بقاعدة البيانات");
  }
  return { data, headers: res.headers };
}

export async function rpc(fn, args) {
  return (await db(`rpc/${fn}`, { method: "POST", body: args })).data;
}

/** رفع ملف إلى التخزين (صور القطع) */
export async function storageUpload(bucket, path, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": contentType, "x-upsert": "true" },
    body: buffer,
  });
  if (!res.ok) { console.error("storage", res.status, await res.text()); throw new HttpError(502, "تعذّر رفع الصورة"); }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}

export async function getSettings() {
  const { data } = await db("settings?select=key,value");
  const out = {};
  for (const r of data || []) out[r.key] = r.value;
  return out;
}

export function sellPrice(p, store) {
  if (p.price_override != null && Number(p.price_override) > 0) return Number(p.price_override);
  const w = Number(p.wholesale) || 0;
  if (w <= 0) return 0;
  const markup = Number(store?.markup ?? 0.10);
  const step = Number(store?.round_to) > 0 ? Number(store.round_to) : 1;
  return Math.max(1, Math.round((w * (1 + markup)) / step) * step);
}

export function shippingFee(city, delivery, subtotal, shipping) {
  if (delivery === "pickup") return 0;
  const s = shipping || {};
  if (s.free_over && subtotal >= Number(s.free_over)) return 0;
  const fee = s.cities && s.cities[city] != null ? s.cities[city] : s.default_fee;
  return Number(fee) || 0;
}

/** تحويل الريال إلى هللة (Moyasar يتعامل بالهللة) */
export const toHalalas = (sar) => Math.round(Number(sar) * 100);

// ---------- صلاحيات المدير ----------
function sign(payload) {
  const secret = env("ADMIN_SECRET");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}
export function makeAdminToken(hours = 12) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + hours * 3600e3 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function requireAdmin(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new HttpError(401, "سجّل الدخول أولاً");
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)))
    throw new HttpError(401, "انتهت الجلسة، سجّل الدخول من جديد");
  const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (Date.now() > exp) throw new HttpError(401, "انتهت الجلسة، سجّل الدخول من جديد");
}
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** غلاف موحّد لكل دالة: يرجع الأخطاء برسالة عربية واضحة */
export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.status(status).json({ error: e instanceof HttpError ? e.message : "حدث خطأ غير متوقع، حاول مرة ثانية" });
    }
  };
}

export const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
export const normPhone = (v) => {
  let d = String(v || "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  if (d.startsWith("966")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^5\d{8}$/.test(d) ? "966" + d : "";
};
export const PUBLIC_ORDER_FIELDS =
  "id,number,status,payment_method,customer_name,city,delivery,vehicle,items,subtotal,shipping_fee,total,carrier,tracking_no,tracking_url,created_at,updated_at";
