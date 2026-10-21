/* لوحة تحكم عزم المتحدة */
(() => {
  const { ls, esc, fmt, toast, TL, STATUS, waLink } = AZM;
  const $ = (s, r = document) => r.querySelector(s);
  let TOKEN = sessionStorage.getItem("azm_admin") || "";
  let SETTINGS = {};

  async function call(action, { method = "GET", body, params = {} } = {}) {
    const q = new URLSearchParams({ a: action, ...params });
    const r = await fetch(`/api/admin?${q}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && action !== "login") { logout(data.error); throw new Error(data.error || "سجّل الدخول"); }
    if (!r.ok) throw new Error(data.error || "حدث خطأ");
    return data;
  }

  // ---------- الدخول ----------
  function logout(msg) {
    TOKEN = ""; sessionStorage.removeItem("azm_admin");
    $("#app").hidden = true; $("#login").hidden = false;
    if (msg) { $("#lerr").textContent = msg; $("#lerr").hidden = false; }
  }
  $("#lf").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#lerr").hidden = true;
    try {
      const { token } = await call("login", { method: "POST", body: { password: $("#pw").value } });
      TOKEN = token; sessionStorage.setItem("azm_admin", token); $("#pw").value = ""; start();
    } catch (x) { $("#lerr").textContent = x.message; $("#lerr").hidden = false; }
  });
  $("#logout").addEventListener("click", () => logout());

  // ---------- التنقل ----------
  const loaders = {};
  function go(tab) {
    document.querySelectorAll("#nav button").forEach((b) => { if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    document.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
    if (loaders[tab]) loaders[tab]();
    try { history.replaceState(null, "", "#" + tab); } catch (e) {}
  }
  $("#nav").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });

  // ---------- الرئيسية ----------
  const stChip = (s) => `<span class="st ${s}">${STATUS[s] || s}</span>`;
  const when = (d) => new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" });
  const orow = (o) => `<button class="orow" type="button" data-oid="${o.id}">
    <span class="num">#${o.number}</span>
    <span>${esc(o.customer_name)}<small>${esc(o.city)} · ${o.items.reduce((a, i) => a + i.qty, 0)} قطعة</small></span>
    <span class="hide-m"><small>${when(o.created_at)}</small><small>${o.payment_method === "cod" ? "عند الاستلام" : "إلكتروني"}</small></span>
    <span>${stChip(o.status)}</span><span class="amt">${fmt(o.total)} ر.س</span></button>`;
  let ORDERS = new Map();
  loaders.home = async () => {
    try {
      const [s, o] = await Promise.all([call("stats"), call("orders", { params: { status: "open" } })]);
      $("#kpis").innerHTML = [
        ["طلبات اليوم", s.today_orders, `${fmt(s.today_sales)} ر.س`],
        ["آخر 30 يوم", s.month_orders, `${fmt(s.month_sales)} ر.س`],
        ["تحتاج إجراء", s.open_orders, "مدفوعة أو عند الاستلام ولم تُشحن", s.open_orders > 0],
        ["أصناف نفدت", s.out_of_stock, "ظاهرة في المتجر وكميتها صفر", s.out_of_stock > 0],
      ].map(([l, v, sm, w]) => `<div class="kpi ${w ? "warn" : ""}"><span>${l}</span><b>${fmt(v)}</b><small>${sm}</small></div>`).join("");
      const max = Math.max(1, ...s.days.map((d) => d.sales));
      $("#bars").innerHTML = s.days.map((d) => `<div title="${d.date}: ${d.orders} طلب · ${fmt(d.sales)} ر.س"><em>${d.sales ? fmt(Math.round(d.sales)) : ""}</em><i style="height:${(d.sales / max) * 100}%"></i><small>${d.date.slice(8)}</small></div>`).join("");
      $("#chartCap").textContent = `${fmt(s.days.reduce((a, d) => a + d.sales, 0))} ر.س`;
      o.rows.forEach((x) => ORDERS.set(x.id, x));
      $("#homeOrders").innerHTML = o.rows.length ? `<div class="list">${o.rows.slice(0, 8).map(orow).join("")}</div>` : '<p class="muted">لا توجد طلبات مفتوحة.</p>';
      $("#openBadge").hidden = !s.open_orders; $("#openBadge").textContent = s.open_orders;
    } catch (e) { toast(e.message); }
  };

  // ---------- الطلبات ----------
  const OF = [["open", "تحتاج إجراء"], ["pending_payment", "بانتظار الدفع"], ["shipped", "مشحونة"], ["delivered", "مسلّمة"], ["cancelled", "ملغية"], ["", "الكل"]];
  let oState = { status: "open", q: "", page: 0 };
  $("#ofilter").innerHTML = OF.map(([k, l]) => `<button class="pill" type="button" data-of="${k}" aria-pressed="${k === oState.status}">${l}</button>`).join("");
  $("#ofilter").addEventListener("click", (e) => { const b = e.target.closest("[data-of]"); if (!b) return; oState = { ...oState, status: b.dataset.of, page: 0 }; document.querySelectorAll("[data-of]").forEach((x) => x.setAttribute("aria-pressed", x === b)); loaders.orders(); });
  let ot; $("#oq").addEventListener("input", () => { clearTimeout(ot); ot = setTimeout(() => { oState.q = $("#oq").value.trim(); oState.page = 0; loaders.orders(); }, 300); });
  loaders.orders = async () => {
    try {
      const r = await call("orders", { params: { status: oState.status, q: oState.q, page: oState.page } });
      r.rows.forEach((x) => ORDERS.set(x.id, x));
      $("#olist").innerHTML = r.rows.length ? r.rows.map(orow).join("") : '<p class="muted">لا توجد طلبات.</p>';
      pager("#opager", r, oState, loaders.orders);
    } catch (e) { toast(e.message); }
  };
  function pager(sel, r, state, reload) {
    const pages = Math.ceil(r.total / r.size);
    $(sel).innerHTML = pages > 1 ? `<button class="btn" type="button" data-p="-1" ${state.page ? "" : "disabled"}>السابق</button><span>صفحة ${state.page + 1} من ${pages} · ${fmt(r.total)}</span><button class="btn" type="button" data-p="1" ${state.page + 1 < pages ? "" : "disabled"}>التالي</button>` : `<span>${fmt(r.total)}</span>`;
    $(sel).onclick = (e) => { const b = e.target.closest("[data-p]"); if (!b) return; state.page += Number(b.dataset.p); reload(); };
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-oid]"); if (b) openOrder(ORDERS.get(b.dataset.oid)); });

  const FLOW = ["paid", "cod", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
  function openOrder(o) {
    if (!o) return;
    const store = SETTINGS.store || {};
    const msgs = {
      confirmed: `مرحباً ${o.customer_name}، تم تأكيد طلبك رقم ${o.number} من ${store.name || "عزم المتحدة"} ومطابقة القطع مع سيارتك. نجهّزه الآن.`,
      shipped: `مرحباً ${o.customer_name}، تم شحن طلبك رقم ${o.number}.` + (o.tracking_no ? ` شركة الشحن: ${o.carrier || ""} رقم التتبع: ${o.tracking_no}` : ""),
      ask: `مرحباً ${o.customer_name}، بخصوص طلبك رقم ${o.number} من ${store.name || "عزم المتحدة"}: `,
    };
    $("#dt").textContent = `طلب #${o.number}`;
    $("#dbody").innerHTML = `
      <div>${stChip(o.status)} <span class="muted">${when(o.created_at)}</span></div>
      <dl class="kv">
        <dt>الزبون</dt><dd>${esc(o.customer_name)}</dd>
        <dt>الجوال</dt><dd class="ltr mono">+${esc(o.phone)}</dd>
        <dt>الاستلام</dt><dd>${o.delivery === "pickup" ? "من المحل" : esc(o.city) + (o.address ? " — " + esc(o.address) : "")}</dd>
        <dt>السيارة</dt><dd>${esc(o.vehicle || "-")}</dd>
        <dt>رقم الهيكل</dt><dd>${o.vin ? `<span class="mono ltr">${esc(o.vin)}</span> <button class="linkb" type="button" data-copyv="${esc(o.vin)}">نسخ</button>` : "-"}</dd>
        <dt>الدفع</dt><dd>${o.payment_method === "cod" ? "عند الاستلام" : "إلكتروني"}${o.payment_id ? ` <small class="mono muted">${esc(o.payment_id)}</small>` : ""}</dd>
        ${o.customer_note ? `<dt>ملاحظة الزبون</dt><dd>${esc(o.customer_note)}</dd>` : ""}
      </dl>
      <div class="tbl-wrap"><table class="tbl"><tr><th>القطعة</th><th>الكمية</th><th>السعر</th></tr>
        ${o.items.map((i) => `<tr><td>${esc(i.name)}<br><small class="mono muted ltr">${esc(i.part_no)}</small> · <small>${TL[i.type] || ""}</small></td><td class="n">${i.qty}</td><td class="n">${fmt(i.unit_price * i.qty)}</td></tr>`).join("")}
        <tr><td>الشحن</td><td></td><td class="n">${fmt(o.shipping_fee)}</td></tr>
        <tr><td><b>الإجمالي</b></td><td></td><td class="n"><b>${fmt(o.total)} ر.س</b></td></tr></table></div>
      <div><h3 style="font-size:15px;margin-bottom:8px">تغيير الحالة</h3><div class="stbtns" id="stb">${FLOW.map((s) => `<button type="button" data-st="${s}" aria-pressed="${o.status === s}">${STATUS[s]}</button>`).join("")}</div>
        <p class="muted" style="margin:6px 0 0;font-size:12.5px">الإلغاء أو الاسترجاع يعيد الكمية للمخزون تلقائياً.</p></div>
      <div class="form2">
        <div class="row2"><label class="fld">شركة الشحن<input id="o_car" value="${esc(o.carrier || "")}" placeholder="سمسا، أرامكس، البريد السعودي…"></label><label class="fld">رقم التتبع<input id="o_trk" value="${esc(o.tracking_no || "")}" dir="ltr"></label></div>
        <label class="fld">رابط التتبع (اختياري)<input id="o_url" value="${esc(o.tracking_url || "")}" dir="ltr"></label>
        <label class="fld">ملاحظة داخلية<textarea id="o_note" rows="2">${esc(o.admin_note || "")}</textarea></label>
        <button class="btn pri" type="button" id="o_save">حفظ</button>
      </div>
      <div><h3 style="font-size:15px;margin-bottom:8px">رسالة للزبون على واتساب</h3><div class="pills">
        <a class="pill" target="_blank" rel="noopener" href="${waLink(o.phone, msgs.confirmed)}" style="text-decoration:none;color:inherit">تأكيد الطلب</a>
        <a class="pill" target="_blank" rel="noopener" href="${waLink(o.phone, msgs.shipped)}" style="text-decoration:none;color:inherit">تم الشحن</a>
        <a class="pill" target="_blank" rel="noopener" href="${waLink(o.phone, msgs.ask)}" style="text-decoration:none;color:inherit">رسالة حرة</a></div></div>`;
    openDrawer();
    let newStatus = null;
    $("#stb").onclick = (e) => { const b = e.target.closest("[data-st]"); if (!b) return; newStatus = b.dataset.st; document.querySelectorAll("#stb button").forEach((x) => x.setAttribute("aria-pressed", x === b)); };
    $("#o_save").onclick = async () => {
      try {
        await call("order_update", { method: "POST", body: { id: o.id, ...(newStatus && newStatus !== o.status ? { status: newStatus } : {}), carrier: $("#o_car").value, tracking_no: $("#o_trk").value, tracking_url: $("#o_url").value, admin_note: $("#o_note").value } });
        toast("تم الحفظ"); closeDrawer(); loaders.orders(); loaders.home();
      } catch (x) { toast(x.message); }
    };
  }
  document.addEventListener("click", (e) => { const c = e.target.closest("[data-copyv]"); if (c) { navigator.clipboard?.writeText(c.dataset.copyv).then(() => toast("تم النسخ"), () => {}); } });

  // ---------- الأصناف ----------
  let pState = { q: "", filter: "", category: "", page: 0 }, CATN = {}, PROD = new Map();
  let pt; $("#pq").addEventListener("input", () => { clearTimeout(pt); pt = setTimeout(() => { pState.q = $("#pq").value.trim(); pState.page = 0; loaders.products(); }, 300); });
  $("#pfilter").addEventListener("change", () => { pState.filter = $("#pfilter").value; pState.page = 0; loaders.products(); });
  $("#pcat").addEventListener("change", () => { pState.category = $("#pcat").value; pState.page = 0; loaders.products(); });
  loaders.products = async () => {
    try {
      const r = await call("products", { params: pState });
      CATN = r.categories;
      if ($("#pcat").options.length < 2) $("#pcat").innerHTML += Object.entries(CATN).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
      r.rows.forEach((p) => PROD.set(p.part_no, p));
      $("#pcount").textContent = `${fmt(r.total)} صنف`;
      $("#ptbl").innerHTML = `<tr><th></th><th>الصنف</th><th>الرقم</th><th>النوع</th><th>الكمية</th><th>الجملة</th><th>سعر البيع</th><th>الظهور</th></tr>` +
        r.rows.map((p) => `<tr class="click" data-pno="${esc(p.part_no)}"><td>${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}</td>
          <td>${esc(p.name)}<br><small class="muted">${esc(CATN[p.category] || "")}${p.cars.length ? " · " + esc(p.cars.join("، ")) : ""}</small></td>
          <td class="n ltr">${esc(p.part_no)}</td><td>${TL[p.type]}</td><td class="n" style="color:${p.qty > 0 ? "inherit" : "var(--no)"}">${p.qty}</td>
          <td class="n">${fmt(p.wholesale)}</td><td class="n">${p.sell_price ? fmt(p.sell_price) : '<span style="color:var(--no)">—</span>'}${p.price_override != null ? " ✎" : ""}</td>
          <td>${p.visible ? "ظاهر" : '<span class="muted">مخفي</span>'}</td></tr>`).join("");
      pager("#ppager", r, pState, loaders.products);
    } catch (e) { toast(e.message); }
  };
  $("#ptbl").addEventListener("click", (e) => { const tr = e.target.closest("[data-pno]"); if (tr) openProduct(PROD.get(tr.dataset.pno)); });
  $("#newProd").addEventListener("click", () => openProduct(null));

  function openProduct(p) {
    const isNew = !p;
    p = p || { part_no: "", name: "", type: "a", qty: 0, wholesale: 0, price_override: null, cars: [], y_from: null, y_to: null, gen_code: "", category: "etc", visible: true, image_url: "" };
    const cars = (SETTINGS.cars || []).map((c) => c.name);
    $("#dt").textContent = isNew ? "صنف جديد" : p.name;
    $("#dbody").innerHTML = `<form class="form2" id="pf">
      ${isNew ? "" : `<div class="imgbox">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : '<span class="noimg"></span>'}<label class="btn">رفع صورة<input type="file" id="pimg" accept="image/*" hidden></label></div>`}
      <div class="row2"><label class="fld">رقم القطعة<input id="f_no" value="${esc(p.part_no)}" dir="ltr" ${isNew ? "" : "readonly"} required></label>
       <label class="fld">النوع<select id="f_ty">${Object.entries(TL).map(([k, v]) => `<option value="${k}" ${p.type === k ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <label class="fld">اسم القطعة<input id="f_nm" value="${esc(p.name)}" required></label>
      <div class="row2"><label class="fld">الكمية<input id="f_qty" type="number" min="0" value="${p.qty}"></label>
       <label class="fld">سعر الجملة<input id="f_wh" type="number" min="0" step="0.01" value="${p.wholesale}"></label></div>
      <label class="fld">سعر بيع يدوي (اختياري)<input id="f_po" type="number" min="0" step="0.01" value="${p.price_override ?? ""}"><small>اتركه فاضي ليُحسب من نسبة الربح (${Math.round((SETTINGS.store?.markup ?? 0.1) * 100)}%)</small></label>
      <label class="fld">السيارات<input id="f_cars" value="${esc(p.cars.join("، "))}" list="carlist"><small>افصل بفاصلة. الأسماء المعروفة: ${esc(cars.join("، "))}</small></label>
      <div class="row2"><label class="fld">من سنة<input id="f_y1" type="number" value="${p.y_from ?? ""}"></label><label class="fld">إلى سنة<input id="f_y2" type="number" value="${p.y_to ?? ""}"></label></div>
      <div class="row2"><label class="fld">رمز الجيل<input id="f_gen" value="${esc(p.gen_code || "")}" dir="ltr" maxlength="4"><small>من رقم القطعة: 58101-<b>F2</b>A00</small></label>
       <label class="fld">القسم<select id="f_cat">${Object.entries(CATN).map(([k, v]) => `<option value="${k}" ${p.category === k ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <label class="sw"><input type="checkbox" id="f_vis" ${p.visible ? "checked" : ""}>ظاهر في المتجر</label>
      <button class="btn pri" type="submit">${isNew ? "إضافة" : "حفظ"}</button></form>`;
    openDrawer();
    $("#pf").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await call("product_save", { method: "POST", body: {
          create: isNew, part_no: $("#f_no").value, name: $("#f_nm").value, type: $("#f_ty").value, qty: $("#f_qty").value,
          wholesale: $("#f_wh").value, price_override: $("#f_po").value, cars: $("#f_cars").value, y_from: $("#f_y1").value,
          y_to: $("#f_y2").value, gen_code: $("#f_gen").value, category: $("#f_cat").value, visible: $("#f_vis").checked } });
        toast("تم الحفظ"); closeDrawer(); loaders.products();
      } catch (x) { toast(x.message); }
    };
    const fi = $("#pimg");
    if (fi) fi.onchange = async () => {
      const f = fi.files[0]; if (!f) return;
      try { toast("جاري رفع الصورة…"); const data = await shrink(f); const r = await call("product_image", { method: "POST", body: { part_no: p.part_no, data } }); p.image_url = r.url; toast("تم رفع الصورة"); openProduct(p); loaders.products(); }
      catch (x) { toast(x.message); }
    };
  }
  /** تصغير الصورة في المتصفح قبل الرفع (أقصى عرض 1200 بكسل) */
  function shrink(file) {
    return new Promise((ok, no) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1200 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => no(new Error("تعذّر قراءة الصورة"));
      img.src = url;
    });
  }

  // ---------- رفع التقرير ----------
  let SHEET = null;
  function loadXLSX() {
    return new Promise((ok, no) => { if (window.XLSX) return ok(); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = () => no(new Error("تعذّر تحميل قارئ Excel")); document.head.appendChild(s); });
  }
  const guess = (heads, words) => heads.findIndex((h) => words.some((w) => String(h).includes(w)));
  $("#file").addEventListener("change", async () => {
    const f = $("#file").files[0]; if (!f) return;
    $("#ires").innerHTML = "";
    try {
      await loadXLSX();
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      // صف العناوين: أول صف فيه كلمة رقم أو اسم أو كمية
      let hi = rows.findIndex((r) => r.some((c) => /رقم|اسم|الصنف|كمية|الكمية|part|name|qty/i.test(String(c))));
      if (hi < 0) hi = 0;
      const heads = rows[hi].map((h, i) => String(h || `عمود ${i + 1}`));
      SHEET = { heads, data: rows.slice(hi + 1).filter((r) => r.some((c) => String(c).trim())) };
      const opts = heads.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join("");
      const pick = (id, words, fallback = -1) => { const el = $(id); el.innerHTML = '<option value="-1">— لا يوجد —</option>' + opts; const g = guess(heads, words); el.value = String(g >= 0 ? g : fallback); };
      pick("#cPart", ["رقم القطعة", "رقم الصنف", "الرقم", "part", "Part", "رقم"]);
      pick("#cName", ["اسم الصنف", "اسم", "الصنف", "البيان", "name", "Name"]);
      pick("#cQty", ["الكمية", "كمية", "qty", "Qty", "الرصيد"]);
      pick("#cVal", ["القيمة", "سعر الجملة", "السعر", "price", "Price", "التكلفة"]);
      $("#map").hidden = false; preview();
    } catch (x) { $("#ires").innerHTML = `<p class="err">${esc(x.message)}</p>`; }
  });
  ["#cPart", "#cName", "#cQty", "#cVal"].forEach((s) => $(s).addEventListener("change", preview));
  const num = (v) => Number(String(v).replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[^\d.\-]/g, "")) || 0;
  function mapped() {
    const ip = +$("#cPart").value, iname = +$("#cName").value, iq = +$("#cQty").value, iv = +$("#cVal").value;
    return SHEET.data.map((r) => ({ part_no: ip >= 0 ? String(r[ip]).trim() : "", name: iname >= 0 ? String(r[iname]).trim() : "", qty: iq >= 0 ? num(r[iq]) : 0, wholesale: iv >= 0 ? num(r[iv]) : 0 })).filter((r) => r.part_no);
  }
  function preview() {
    const m = mapped();
    $("#prev").innerHTML = "<tr><th>رقم القطعة</th><th>الاسم</th><th>الكمية</th><th>سعر الجملة</th></tr>" + m.slice(0, 8).map((r) => `<tr><td class="n ltr">${esc(r.part_no)}</td><td>${esc(r.name)}</td><td class="n">${r.qty}</td><td class="n">${fmt(r.wholesale)}</td></tr>`).join("");
    $("#icount").textContent = `${fmt(m.length)} سطر في التقرير. تأكد أن الأعمدة صحيحة قبل الدمج.`;
  }
  $("#doImport").addEventListener("click", async () => {
    const m = mapped(); if (!m.length) return toast("ما فيه أسطر بأرقام قطع");
    const b = $("#doImport"); b.disabled = true; b.textContent = "جاري الدمج…";
    try {
      const r = await call("import", { method: "POST", body: { rows: m } });
      $("#ires").innerHTML = `<div class="ok-box">تم الدمج: حدّثنا <b>${fmt(r.updated)}</b> صنف، وأضفنا <b>${fmt(r.added)}</b> صنف جديد.${r.skipped ? ` تجاهلنا ${fmt(r.skipped)} سطر مكرر أو بدون رقم صحيح.` : ""} راجع الأصناف الجديدة من صفحة «الأصناف» للتأكد من القسم والسيارات.</div>`;
    } catch (x) { $("#ires").innerHTML = `<p class="err">${esc(x.message)}</p>`; }
    b.disabled = false; b.textContent = "دمج التقرير مع المخزون";
  });

  // ---------- الإعدادات ----------
  loaders.settings = async () => {
    try {
      SETTINGS = await call("settings_get");
      const s = SETTINGS.store || {}, h = SETTINGS.shipping || {};
      $("#s_name").value = s.name || ""; $("#s_wa").value = s.whatsapp || ""; $("#s_markup").value = Math.round((s.markup ?? 0.1) * 1000) / 10;
      $("#s_round").value = String(s.round_to || 1); $("#s_vat").checked = s.vat_included !== false; $("#s_card").checked = s.card_enabled !== false; $("#s_cod").checked = !!s.cod_enabled;
      $("#h_def").value = h.default_fee ?? 0; $("#h_free").value = h.free_over ?? 0; $("#h_pick").checked = !!h.pickup_enabled; $("#h_plbl").value = h.pickup_label || "";
      $("#cities").innerHTML = Object.entries(h.cities || {}).map(([c, f]) => cityRow(c, f)).join("");
    } catch (e) { toast(e.message); }
  };
  const cityRow = (c = "", f = "") => `<div><input value="${esc(c)}" placeholder="المدينة" aria-label="المدينة"><input type="number" min="0" value="${f}" aria-label="الرسوم"><button type="button" data-rm aria-label="حذف">✕</button></div>`;
  $("#addCity").addEventListener("click", () => $("#cities").insertAdjacentHTML("beforeend", cityRow()));
  $("#cities").addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) e.target.closest("div").remove(); });
  $("#sf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cities = {};
    document.querySelectorAll("#cities > div").forEach((d) => { const [a, b] = d.querySelectorAll("input"); if (a.value.trim()) cities[a.value.trim()] = Number(b.value) || 0; });
    try {
      await call("settings_save", { method: "POST", body: {
        store: { name: $("#s_name").value, whatsapp: $("#s_wa").value, markup: (Number($("#s_markup").value) || 0) / 100, round_to: Number($("#s_round").value), vat_included: $("#s_vat").checked, card_enabled: $("#s_card").checked, cod_enabled: $("#s_cod").checked },
        shipping: { default_fee: $("#h_def").value, free_over: $("#h_free").value, pickup_enabled: $("#h_pick").checked, pickup_label: $("#h_plbl").value, cities } } });
      toast("تم حفظ الإعدادات"); loaders.settings();
    } catch (x) { toast(x.message); }
  });

  // ---------- النافذة الجانبية ----------
  function openDrawer() { $("#drawer").hidden = false; $("#scrim").hidden = false; }
  function closeDrawer() { $("#drawer").hidden = true; $("#scrim").hidden = true; }
  $("#scrim").addEventListener("click", closeDrawer);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeDrawer(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  // ---------- البداية ----------
  async function start() {
    $("#login").hidden = true; $("#app").hidden = false;
    try { SETTINGS = await call("settings_get"); $("#sn").textContent = SETTINGS.store?.name || "عزم المتحدة"; } catch (e) { return; }
    const tab = (location.hash || "#home").slice(1);
    go(["home", "orders", "products", "import", "settings"].includes(tab) ? tab : "home");
  }
  if (TOKEN) start(); else logout();
})();
