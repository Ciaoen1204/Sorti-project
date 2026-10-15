-- Read-only verification after setup-all.sql; all checks should say OK.
with expected(name) as (values
  ('profiles'), ('user_personas'), ('check_ins'), ('ai_analyses'), ('items'),
  ('listings'), ('cart_items'), ('orders'), ('order_items'), ('conversations'),
  ('messages'), ('ai_chat_messages')
)
select e.name as table_name,
  case when t.tablename is null then 'MISSING'
       when not t.rowsecurity then 'RLS DISABLED' else 'OK' end as result
from expected e left join pg_tables t on t.schemaname = 'public' and t.tablename = e.name
order by e.name;

select id, public from storage.buckets
where id in ('check-in-photos', 'analysis-photos', 'product-photos') order by id;

select case when to_regprocedure('public.create_orders_from_cart(uuid[],text,text,text)') is not null
  then 'OK' else 'MISSING' end as checkout_function;

select case when to_regprocedure('public.transition_market_order(uuid,text)') is not null
  then 'OK' else 'MISSING' end as order_workflow_function;

-- Verify joins and upsert conflict targets are represented in the schema.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in (
  'public.items'::regclass, 'public.cart_items'::regclass,
  'public.check_ins'::regclass, 'public.conversations'::regclass,
  'public.order_items'::regclass
) and contype in ('f', 'u') order by table_name, conname;
