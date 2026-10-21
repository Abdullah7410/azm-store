// تتبّع الطلب للزبون: إما برقم الطلب + الرمز السري (من رابط الطلب) أو رقم الطلب + الجوال
import { handler, db, clean, normPhone, PUBLIC_ORDER_FIELDS, HttpError } from "./_lib.js";

export default handler(async (req, res) => {
  const q = req.query || {};
  const number = Number(q.n);
  if (!Number.isInteger(number) || number < 1) throw new HttpError(400, "رقم الطلب غير صحيح");
  let filter = `number=eq.${number}`;
  if (q.t) filter += `&token=eq.${encodeURIComponent(clean(q.t, 64))}`;
  else {
    const phone = normPhone(q.phone);
    if (!phone) throw new HttpError(400, "اكتب رقم الجوال المستخدم في الطلب");
    filter += `&phone=eq.${phone}`;
  }
  const { data } = await db(`orders?select=${PUBLIC_ORDER_FIELDS},token&${filter}&limit=1`);
  if (!data || !data.length) throw new HttpError(404, "ما لقينا طلباً بهذه البيانات");
  res.setHeader("Cache-Control", "no-store");
  res.json(data[0]);
});
