// يرجع الزبون هنا من Moyasar بعد الدفع. نتحقق من الدفع مباشرة من Moyasar بالمفتاح السري قبل اعتماد الطلب.
import { handler, db, rpc, env, toHalalas, clean, HttpError } from "./_lib.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchPayment(paymentId) {
  const key = env("MOYASAR_SECRET_KEY");
  const r = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64") },
  });
  if (!r.ok) throw new HttpError(502, "تعذّر التحقق من الدفع");
  return r.json();
}

/** يطابق الدفع مع الطلب: الحالة paid والعملة SAR والمبلغ نفس مبلغ الطلب بالضبط */
export async function verifyAndApply(paymentId, orderIdHint) {
  const pay = await fetchPayment(paymentId);
  let filter = null;
  const meta = pay.metadata && pay.metadata.order_id;
  if (meta && UUID.test(meta)) filter = `id=eq.${meta}`;
  else if (orderIdHint && UUID.test(orderIdHint)) filter = `id=eq.${orderIdHint}`;
  else { const m = String(pay.description || "").match(/#(\d+)/); if (m) filter = `number=eq.${m[1]}`; }
  if (!filter) throw new HttpError(404, "ما قدرنا نربط الدفع بطلب");
  const { data } = await db(`orders?select=id,number,token,status,total,payment_method&${filter}&limit=1`);
  const order = data && data[0];
  if (!order) throw new HttpError(404, "الطلب غير موجود");
  const paid = pay.status === "paid" && pay.currency === "SAR" && pay.amount === toHalalas(order.total);
  const now = new Date().toISOString();
  if (order.status === "pending_payment") {
    if (paid) {
      await db(`orders?id=eq.${order.id}&status=eq.pending_payment`, { method: "PATCH", body: { status: "paid", payment_id: pay.id, updated_at: now } });
      await rpc("apply_order_stock", { p_order: order.id });
    } else {
      await db(`orders?id=eq.${order.id}`, { method: "PATCH", body: { payment_id: pay.id, updated_at: now } });
    }
  }
  return { order, paid: paid || order.status !== "pending_payment", message: pay.source && pay.source.message };
}

export default handler(async (req, res) => {
  const q = req.query || {};
  const paymentId = clean(q.id, 64);
  if (!UUID.test(paymentId)) throw new HttpError(400, "رابط الدفع غير صحيح");
  const { order, paid, message } = await verifyAndApply(paymentId, clean(q.o, 64));
  const params = new URLSearchParams({ n: String(order.number), t: order.token });
  if (!paid) { params.set("pay", "failed"); if (message) params.set("msg", String(message).slice(0, 120)); }
  res.redirect(302, `/order?${params}`);
});
