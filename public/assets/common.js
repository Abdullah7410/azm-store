/* أدوات مشتركة بين صفحات المتجر */
window.AZM = (() => {
  const ls = {
    get(k, f) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? f; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  let cfgP = null;
  const config = () => (cfgP ||= fetch("/api/config").then((r) => { if (!r.ok) throw new Error("config"); return r.json(); }));

  /** قراءة عامة من قاعدة البيانات (الأصناف المعروضة والسيارات والإعدادات فقط) */
  async function sb(path, range) {
    const c = await config();
    const r = await fetch(`${c.supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: c.supabaseAnonKey, Authorization: `Bearer ${c.supabaseAnonKey}`, ...(range ? { Range: range } : {}) },
    });
    if (!r.ok) throw new Error("تعذّر تحميل البيانات");
    return r.json();
  }
  async function sbAll(path, page = 1000) {
    const out = [];
    for (let i = 0; ; i += page) {
      const rows = await sb(path, `${i}-${i + page - 1}`);
      out.push(...rows);
      if (rows.length < page) return out;
    }
  }
  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "حدث خطأ، حاول مرة ثانية");
    return data;
  }
  async function settings() {
    const rows = await sb("settings?select=key,value");
    const o = {}; rows.forEach((r) => (o[r.key] = r.value)); return o;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  let tt;
  function toast(t) {
    let e = document.getElementById("toast");
    if (!e) { e = document.createElement("div"); e.id = "toast"; e.setAttribute("role", "status"); document.body.appendChild(e); }
    e.textContent = t; e.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("on"), 2200);
  }
  const TL = { a: "وكالة", m: "موبس", k: "كوري", c: "تجاري" };
  const STATUS = {
    pending_payment: "بانتظار الدفع", paid: "مدفوع", cod: "دفع عند الاستلام", confirmed: "تم التأكيد",
    processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي", refunded: "مسترجع",
  };
  const waLink = (num, text) => `https://wa.me/${String(num || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  return { ls, config, sb, sbAll, api, settings, esc, fmt, toast, TL, STATUS, waLink };
})();
