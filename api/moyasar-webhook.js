// إشعار من Moyasar (احتياطي لو أغلق الزبون الصفحة قبل الرجوع). اضبطه في لوحة Moyasar على: https://موقعك/api/moyasar-webhook
import { handler, env, safeEqual, HttpError } from "./_lib.js";
import { verifyAndApply } from "./payment-callback.js";

export default handler(async (req, res) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const b = req.body || {};
  if (!safeEqual(b.secret_token || "", env("MOYASAR_WEBHOOK_SECRET"))) throw new HttpError(401, "unauthorized");
  const pay = b.data || {};
  const orderId = pay.metadata && pay.metadata.order_id;
  if (pay.id) await verifyAndApply(pay.id, orderId);
  res.json({ ok: true });
});
