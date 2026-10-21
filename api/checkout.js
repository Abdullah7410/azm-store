// إنشاء الطلب: الخادم يعيد حساب الأسعار من قاعدة البيانات، فلا يقدر الزبون يغيّر السعر من المتصفح
import { handler, db, rpc, getSettings, sellPrice, shippingFee, clean, normPhone, HttpError } from "./_lib.js";

export default handler(async (req, res) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const b = req.body || {};
  const name = clean(b.name, 80), city = clean(b.city, 60), address = clean(b.address, 300);
  const phone = normPhone(b.phone);
  const delivery = b.delivery === "pickup" ? "pickup" : "ship";
  const method = b.payment_method === "cod" ? "cod" : "card";
  const vin = clean(b.vin, 17).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (name.length < 2) throw new HttpError(400, "اكتب الاسم");
  if (!phone) throw new HttpError(400, "رقم الجوال غير صحيح. اكتبه بالشكل 05XXXXXXXX");
  if (!city) throw new HttpError(400, "اختر المدينة");
  if (delivery === "ship" && address.length < 5) throw new HttpError(400, "اكتب عنوان التوصيل");
  if (vin && vin.length !== 17) throw new HttpError(400, "رقم الهيكل لازم يكون 17 خانة");

  const cart = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  const want = new Map();
  for (const it of cart) {
    const p = clean(it.part_no, 40), q = Math.floor(Number(it.qty));
    if (p && q >= 1 && q <= 50) want.set(p, (want.get(p) || 0) + q);
  }
  if (!want.size) throw new HttpError(400, "السلة فاضية");

  const settings = await getSettings();
  const store = settings.store || {}, shipping = settings.shipping || {};
  if (method === "cod" && !store.cod_enabled) throw new HttpError(400, "الدفع عند الاستلام غير متاح حالياً");
  if (method === "card" && store.card_enabled === false) throw new HttpError(400, "الدفع بالبطاقة غير متاح حالياً");
  if (delivery === "pickup" && !shipping.pickup_enabled) throw new HttpError(400, "الاستلام من المحل غير متاح");

  const list = [...want.keys()].map((p) => `"${p.replace(/"/g, "")}"`).join(",");
  const { data: rows } = await db(`products?select=part_no,name,type,qty,wholesale,price_override,visible&part_no=in.(${encodeURIComponent(list)})`);
  const byNo = new Map((rows || []).map((r) => [r.part_no, r]));
  const items = [];
  const problems = [];
  for (const [p, q] of want) {
    const r = byNo.get(p);
    const price = r ? sellPrice(r, store) : 0;
    if (!r || !r.visible) { problems.push(`${p}: غير موجودة`); continue; }
    if (!price) { problems.push(`${r.name}: سعرها يحتاج تأكيد، اطلبها على واتساب`); continue; }
    if (r.qty < q) { problems.push(`${r.name}: المتوفر ${Math.max(0, r.qty)} فقط`); continue; }
    items.push({ part_no: r.part_no, name: r.name, type: r.type, qty: q, unit_price: price });
  }
  if (problems.length) throw new HttpError(409, "راجع السلة: " + problems.join(" · "));

  const subtotal = items.reduce((a, i) => a + i.unit_price * i.qty, 0);
  const fee = shippingFee(city, delivery, subtotal, shipping);
  const total = subtotal + fee;
  if (method === "card" && total < 1) throw new HttpError(400, "قيمة الطلب غير صحيحة");

  const { data } = await db("orders", {
    method: "POST",
    prefer: "return=representation",
    body: {
      status: method === "cod" ? "cod" : "pending_payment",
      payment_method: method,
      customer_name: name, phone, city, address: delivery === "ship" ? address : null, delivery,
      vin: vin || null, vehicle: clean(b.vehicle, 80) || null,
      customer_note: clean(b.note, 500) || null,
      items, subtotal, shipping_fee: fee, total,
    },
  });
  const order = data[0];
  // الدفع عند الاستلام: نحجز الكمية مباشرة. البطاقة: نحجزها بعد نجاح الدفع.
  if (method === "cod") await rpc("apply_order_stock", { p_order: order.id });
  res.json({ id: order.id, number: order.number, token: order.token, total: order.total, method });
});
