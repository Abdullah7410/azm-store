-- =====================================================================
-- عزم المتحدة — قاعدة بيانات المتجر
-- الصق هذا الملف كاملاً في Supabase → SQL Editor ثم اضغط Run (مرة واحدة)
-- =====================================================================

-- ---------- الأصناف ----------
create table if not exists public.products (
  part_no        text primary key,                 -- رقم القطعة مثل 58101-F2A00
  name           text not null,                    -- اسم القطعة بالعربي
  type           text not null default 'c' check (type in ('a','m','k','c')), -- وكالة/موبس/كوري/تجاري
  qty            integer not null default 0,       -- الكمية في المخزون
  wholesale      numeric(10,2) not null default 0, -- سعر الجملة (لا يظهر للزبون)
  price_override numeric(10,2),                    -- سعر بيع يدوي (اختياري، يتجاوز نسبة الربح)
  cars           text[] not null default '{}',     -- السيارات التي تركب عليها
  y_from         integer,                          -- من سنة
  y_to           integer,                          -- إلى سنة
  gen_code       text,                             -- رمز الجيل من رقم القطعة (مثل F2 أو AA)
  category       text not null default 'etc',      -- القسم
  image_url      text,                             -- رابط صورة القطعة
  visible        boolean not null default true,    -- ظاهر في المتجر
  updated_at     timestamptz not null default now()
);
create index if not exists products_cars_idx on public.products using gin (cars);
create index if not exists products_base_idx on public.products ((regexp_replace(part_no,'[A-Z]+$','')));

-- ---------- السيارات وأجيالها ----------
create table if not exists public.cars (
  name text primary key,          -- النترا
  make text not null              -- هونداي / كيا
);
create table if not exists public.generations (
  car    text not null references public.cars(name) on update cascade on delete cascade,
  code   text not null,           -- AA
  y_from integer not null,
  y_to   integer not null,
  weight integer not null default 0,
  primary key (car, code)
);

-- ---------- الإعدادات ----------
create table if not exists public.settings (
  key       text primary key,
  value     jsonb not null,
  is_public boolean not null default true
);
insert into public.settings (key, value, is_public) values
  ('store',    '{"name":"عزم المتحدة","whatsapp":"","markup":0.10,"round_to":1,"vat_included":true,"cod_enabled":true,"card_enabled":true}', true),
  ('shipping', '{"default_fee":35,"free_over":500,"pickup_enabled":true,"pickup_label":"استلام من المحل","cities":{"الرياض":25,"جدة":35,"الدمام":35,"مكة المكرمة":35,"المدينة المنورة":35,"الخبر":35,"القصيم":35,"أبها":40,"تبوك":40,"حائل":40,"جازان":45,"نجران":45}}', true)
on conflict (key) do nothing;

-- ---------- الطلبات ----------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity (start with 1001) unique,
  token          text not null default replace(gen_random_uuid()::text,'-',''), -- رمز سري ليتتبع الزبون طلبه
  status         text not null default 'pending_payment'
                 check (status in ('pending_payment','paid','cod','confirmed','processing','shipped','delivered','cancelled','refunded')),
  payment_method text not null check (payment_method in ('card','cod')),
  payment_id     text,
  customer_name  text not null,
  phone          text not null,
  city           text not null,
  address        text,
  delivery       text not null default 'ship' check (delivery in ('ship','pickup')),
  vin            text,
  vehicle        text,
  items          jsonb not null,           -- [{part_no,name,type,qty,unit_price}]
  subtotal       numeric(10,2) not null,
  shipping_fee   numeric(10,2) not null default 0,
  total          numeric(10,2) not null,
  carrier        text,
  tracking_no    text,
  tracking_url   text,
  admin_note     text,
  customer_note  text,
  stock_applied  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- خصم الكمية من المخزون مرة واحدة فقط لكل طلب
create or replace function public.apply_order_stock(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it jsonb; done boolean;
begin
  select stock_applied into done from orders where id = p_order for update;
  if done then return; end if;
  for it in select * from jsonb_array_elements((select items from orders where id = p_order)) loop
    update products set qty = greatest(0, qty - (it->>'qty')::int), updated_at = now()
     where part_no = it->>'part_no';
  end loop;
  update orders set stock_applied = true, updated_at = now() where id = p_order;
end $$;

-- إرجاع الكمية عند إلغاء طلب سبق خصمه
create or replace function public.restore_order_stock(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it jsonb; done boolean;
begin
  select stock_applied into done from orders where id = p_order for update;
  if not done then return; end if;
  for it in select * from jsonb_array_elements((select items from orders where id = p_order)) loop
    update products set qty = qty + (it->>'qty')::int, updated_at = now() where part_no = it->>'part_no';
  end loop;
  update orders set stock_applied = false, updated_at = now() where id = p_order;
end $$;

-- دوال المخزون تُستدعى من الخادم فقط
revoke execute on function public.apply_order_stock(uuid) from public, anon, authenticated;
revoke execute on function public.restore_order_stock(uuid) from public, anon, authenticated;

-- ---------- الحماية (Row Level Security) ----------
-- الزوار يقرؤون الأصناف الظاهرة والسيارات والإعدادات العامة فقط.
-- الطلبات وسعر الجملة لا تُقرأ إلا من الخادم بالمفتاح السري.
alter table public.products    enable row level security;
alter table public.cars        enable row level security;
alter table public.generations enable row level security;
alter table public.settings    enable row level security;
alter table public.orders      enable row level security;

drop policy if exists "public read cars" on public.cars;
create policy "public read cars" on public.cars for select to anon using (true);
drop policy if exists "public read generations" on public.generations;
create policy "public read generations" on public.generations for select to anon using (true);
drop policy if exists "public read public settings" on public.settings;
create policy "public read public settings" on public.settings for select to anon using (is_public);

-- الزوار لا يقرؤون جدول الأصناف مباشرة (فيه سعر الجملة)، بل العرض store_products أدناه
drop policy if exists "public read visible products" on public.products;
revoke all on public.products from anon, authenticated;
revoke all on public.orders from anon, authenticated;

-- عرض عام يحسب سعر البيع من نسبة الربح، بدون كشف سعر الجملة
create or replace view public.store_products with (security_invoker = false) as
select p.part_no, p.name, p.type,
       case when p.qty <= 0 then 0 when p.qty <= 2 then 1 else 2 end as stock,
       coalesce(p.price_override,
         case when p.wholesale > 0 then
           round(p.wholesale * (1 + coalesce((s.value->>'markup')::numeric, 0.10)))
         end) as price,
       p.cars, p.y_from, p.y_to, p.gen_code, p.category, p.image_url
from public.products p
cross join (select value from public.settings where key = 'store') s
where p.visible;
grant select on public.store_products to anon;

-- ---------- صور القطع ----------
insert into storage.buckets (id, name, public) values ('products','products', true)
on conflict (id) do nothing;
