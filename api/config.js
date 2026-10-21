// إعدادات عامة يحتاجها المتصفح (مفاتيح عامة فقط، لا أسرار)
import { handler, env } from "./_lib.js";

export default handler(async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    supabaseUrl: env("SUPABASE_URL").replace(/\/$/, ""),
    supabaseAnonKey: env("SUPABASE_ANON_KEY"),
    moyasarPublishableKey: process.env.MOYASAR_PUBLISHABLE_KEY || "",
    applePay: process.env.MOYASAR_APPLE_PAY === "1",
  });
});
