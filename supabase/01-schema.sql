-- =========================================================
-- rateio2you — esquema do banco (Supabase / PostgreSQL)
-- ---------------------------------------------------------
-- COMO USAR:
-- 1. Abra o projeto no Supabase.
-- 2. Menu lateral → SQL Editor → New query.
-- 3. Cole TODO este arquivo e clique em "Run".
-- 4. Depois rode também 02-storage.sql e 03-seed.sql.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1. PERFIS (clientes + administrador)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'membro' check (role in ('membro', 'admin')),
  status text not null default 'pendente' check (status in ('pendente', 'ativo', 'bloqueado')),
  cpf text not null default '',
  whatsapp text not null default '',
  phone2 text not null default '',
  credit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. ENDEREÇOS
-- ---------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Endereço',
  cep text not null default '',
  street text not null default '',
  number text not null default '',
  complement text not null default '',
  district text not null default '',
  city text not null default '',
  state text not null default '',
  notes text not null default '',
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses(user_id);
create unique index if not exists addresses_one_principal_idx
  on public.addresses(user_id) where principal is true;

-- ---------------------------------------------------------
-- 3. LOTES (compras coletivas abertas)
-- ---------------------------------------------------------
create table if not exists public.lots (
  id text primary key,
  brand text not null default '',
  monogram text not null default 'R2Y',
  title text not null default '',
  tag text not null default '',
  description text not null default '',
  open boolean not null default true,
  accent text not null default '#5580d7',
  closes_at timestamptz,
  note text not null default '',
  image text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. PRODUTOS DO CATÁLOGO (por lote)
-- ---------------------------------------------------------
create table if not exists public.products (
  id text primary key,
  lot_id text references public.lots(id) on delete cascade,
  name text not null default '',
  brand text not null default '',
  specs text not null default '',
  sku text not null default '',
  price numeric(12,2) not null default 0,
  box_filled integer not null default 0,
  closed_boxes integer not null default 0,
  stock_qty integer not null default 0,
  max_per_order integer not null default 0,
  tag text not null default '',
  description text not null default '',
  image text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_lot_idx on public.products(lot_id);

-- ---------------------------------------------------------
-- 5. PRONTA ENTREGA
-- ---------------------------------------------------------
create table if not exists public.stock_items (
  id text primary key,
  name text not null default '',
  brand text not null default '',
  specs text not null default '',
  price numeric(12,2) not null default 0,
  qty integer not null default 0,
  lot text not null default '',
  description text not null default '',
  image text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 6. LEILÃO E LANCES
-- ---------------------------------------------------------
create table if not exists public.auctions (
  id text primary key,
  title text not null default '',
  origin text not null default '',
  description text not null default '',
  specs text not null default '',
  start_bid numeric(12,2) not null default 0,
  increment numeric(12,2) not null default 0,
  ends_at timestamptz,
  top_bid numeric(12,2),
  image text not null default '',
  active boolean not null default true,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id text not null references public.auctions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists bids_auction_idx on public.bids(auction_id, amount desc);

-- ---------------------------------------------------------
-- 7. PEDIDOS
-- ---------------------------------------------------------
create table if not exists public.orders (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'rateio' check (type in ('rateio', 'estoque', 'leilao')),
  lot_id text,
  lot_title text not null default '',
  auction_id text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  sinal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  status text not null default 'aguardando_pagamento',
  address text not null default '',
  events jsonb not null default '[]'::jsonb,
  tracking text not null default '',
  stock_applied boolean not null default false,
  payment_method text not null default 'pix',
  pix_txid text,
  pix_copia_cola text,
  pix_expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status);

-- ---------------------------------------------------------
-- 8. PAGAMENTOS PIX
-- ---------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  txid text not null unique,
  kind text not null default 'total' check (kind in ('sinal', 'total', 'saldo')),
  amount numeric(12,2) not null default 0,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'expirado', 'cancelado')),
  provider text not null default 'inter',
  copia_cola text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_txid_idx on public.payments(txid);

-- ---------------------------------------------------------
-- 9. CONFIGURAÇÕES DA LOJA (linha única id = 1)
-- ---------------------------------------------------------
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.settings (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- 10. FUNÇÕES AUXILIARES
-- ---------------------------------------------------------

-- Verifica se o usuário logado é administrador ativo.
-- SECURITY DEFINER evita recursão nas políticas de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'ativo'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Atualiza updated_at automaticamente.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Cria o perfil quando alguém se cadastra no Supabase Auth.
-- Se a opção "autoApproveUsers" estiver ligada, já entra como ativo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_approve boolean := false;
begin
  select coalesce((data->>'autoApproveUsers')::boolean, false)
    into auto_approve
    from public.settings
    where id = 1;

  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    'membro',
    case when auto_approve then 'ativo' else 'pendente' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que um membro comum altere o próprio cargo, status ou crédito.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Funções internas (auto_approve_me) ligam esta chave na transação
  -- para poderem alterar o status do próprio cadastro.
  if coalesce(current_setting('rateio2you.bypass_profile_guard', true), '') = 'on' then
    return new;
  end if;

  -- auth.uid() nulo = SQL Editor / service_role (uso administrativo).
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.credit is distinct from old.credit
       or new.email is distinct from old.email then
      raise exception 'Você não tem permissão para alterar estes campos.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Aprova o próprio cadastro quando o organizador ligou a opção.
create or replace function public.auto_approve_me()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_approve boolean := false;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  select coalesce((data->>'autoApproveUsers')::boolean, false)
    into auto_approve
    from public.settings
    where id = 1;

  if auto_approve then
    perform set_config('rateio2you.bypass_profile_guard', 'on', true);
    update public.profiles
      set status = 'ativo', updated_at = now()
      where id = auth.uid() and status = 'pendente';
    perform set_config('rateio2you.bypass_profile_guard', 'off', true);
  end if;
end;
$$;

grant execute on function public.auto_approve_me() to authenticated;

-- ---------------------------------------------------------
-- 11. LANCES: VALIDAÇÃO E ATUALIZAÇÃO DO TOPO
-- ---------------------------------------------------------
create or replace function public.validate_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.auctions;
  current_top numeric(12,2);
begin
  select * into a from public.auctions where id = new.auction_id for update;
  if not found then
    raise exception 'Leilão não encontrado.';
  end if;
  if a.active is false then
    raise exception 'Este leilão está desativado.';
  end if;
  if a.ends_at is not null and a.ends_at <= now() then
    raise exception 'Este leilão já foi encerrado.';
  end if;

  select coalesce(max(amount), a.start_bid)
    into current_top
    from public.bids
    where auction_id = new.auction_id;

  if new.amount < current_top + a.increment then
    raise exception 'O lance mínimo é %', to_char(current_top + a.increment, 'FM999999990D00');
  end if;

  return new;
end;
$$;

drop trigger if exists bids_validate on public.bids;
create trigger bids_validate
  before insert on public.bids
  for each row execute function public.validate_bid();

create or replace function public.apply_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.auctions
    set top_bid = greatest(coalesce(top_bid, 0), new.amount), updated_at = now()
    where id = new.auction_id;
  return new;
end;
$$;

drop trigger if exists bids_apply on public.bids;
create trigger bids_apply
  after insert on public.bids
  for each row execute function public.apply_bid();

-- ---------------------------------------------------------
-- 12. PAGAMENTO: BAIXA DE ESTOQUE, STATUS E ARREMATE
-- ---------------------------------------------------------
create or replace function public.apply_payment(
  p_order_id text,
  p_kind text,
  p_amount numeric,
  p_txid text,
  p_paid_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  msg text;
  it jsonb;
  st text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  -- Idempotência: não repete a baixa se o pagamento já foi aplicado.
  if p_kind = 'sinal' and o.status in ('sinal_pago', 'saldo_liberado', 'pago', 'entregue') then
    return;
  end if;
  if p_kind in ('total', 'saldo') and o.status in ('pago', 'entregue') then
    return;
  end if;

  if p_kind = 'sinal' then
    st := case when o.balance <= 0 then 'pago' else 'sinal_pago' end;
    msg := format('Sinal de R$ %s confirmado via Pix.', to_char(coalesce(p_amount, o.sinal), 'FM999999990D00'));
    update public.orders
      set status = st,
          paid_at = coalesce(paid_at, p_paid_at),
          events = coalesce(events, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object('at', now(), 'text', msg)
          ),
          updated_at = now()
      where id = o.id;
    return;
  end if;

  if p_kind in ('total', 'saldo') then
    msg := case
      when p_kind = 'saldo' then format('Saldo final de R$ %s confirmado via Pix.', to_char(coalesce(p_amount, o.balance), 'FM999999990D00'))
      else format('Pagamento de R$ %s confirmado via Pix.', to_char(coalesce(p_amount, o.total), 'FM999999990D00'))
    end;

    update public.orders
      set status = 'pago',
          balance = 0,
          paid_at = coalesce(paid_at, p_paid_at),
          events = coalesce(events, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object('at', now(), 'text', msg)
          ),
          updated_at = now()
      where id = o.id;

    -- Pronta entrega: baixa o estoque uma única vez.
    if o.type = 'estoque' and o.stock_applied is false then
      update public.stock_items s
        set qty = greatest(0, s.qty - coalesce((i.item->>'qty')::int, 0)),
            updated_at = now()
        from jsonb_array_elements(o.items) as i(item)
        where s.id = i.item->>'productId';

      update public.orders set stock_applied = true, updated_at = now() where id = o.id;
    end if;

    -- Leilão: marca o arremate como pago.
    if o.type = 'leilao' and o.auction_id is not null then
      update public.auctions
        set paid_at = coalesce(paid_at, p_paid_at),
            paid_by = o.user_id,
            updated_at = now()
        where id = o.auction_id;
    end if;
  end if;
end;
$$;

-- Chamado pelo site quando o Pix automático ainda não está ligado.
-- O cliente avisa que pagou; o organizador confere no painel.
create or replace function public.notify_manual_payment(p_order_id text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  v_amount numeric(12,2);
  v_txid text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  select * into o from public.orders
    where id = p_order_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  v_amount := case p_kind
    when 'sinal' then o.sinal
    when 'saldo' then o.balance
    else o.total
  end;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Este pagamento não está disponível.';
  end if;

  if exists (
    select 1 from public.payments
    where order_id = o.id and kind = p_kind and status = 'pendente'
  ) then
    return;
  end if;

  v_txid := 'manual-' || o.id || '-' || p_kind || '-' || extract(epoch from now())::bigint;

  insert into public.payments (order_id, txid, kind, amount, status, provider)
  values (o.id, v_txid, p_kind, v_amount, 'pendente', 'manual');

  update public.orders
    set status = 'aguardando_confirmacao',
        events = coalesce(events, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('at', now(), 'text', 'Cliente avisou que pagou via Pix. Aguardando conferência do organizador.')
        ),
        updated_at = now()
    where id = o.id;
end;
$$;

grant execute on function public.notify_manual_payment(text, text) to authenticated;

-- Usado pela API da Vercel quando o Inter confirma o recebimento.
-- Só o service_role pode chamar.
create or replace function public.confirm_pix_payment(p_txid text, p_paid_at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where txid = p_txid for update;
  if not found then
    raise exception 'Cobrança Pix não encontrada: %', p_txid;
  end if;
  if pay.status = 'pago' then
    return;
  end if;

  update public.payments
    set status = 'pago', paid_at = p_paid_at, updated_at = now()
    where id = pay.id;

  perform public.apply_payment(pay.order_id, pay.kind, pay.amount, pay.txid, p_paid_at);
end;
$$;

revoke all on function public.confirm_pix_payment(text, timestamptz) from public;
revoke all on function public.confirm_pix_payment(text, timestamptz) from anon, authenticated;
grant execute on function public.confirm_pix_payment(text, timestamptz) to service_role;

-- Confirmação manual feita pelo organizador no painel admin.
create or replace function public.admin_confirm_payment(
  p_order_id text,
  p_kind text,
  p_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  pay public.payments;
  v_amount numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  v_amount := coalesce(p_amount, case p_kind
    when 'sinal' then o.sinal
    when 'saldo' then o.balance
    else o.total
  end);

  select * into pay from public.payments
    where order_id = p_order_id and kind = p_kind
    order by created_at desc limit 1
    for update;

  if not found then
    insert into public.payments (order_id, txid, kind, amount, status, provider, paid_at)
    values (
      p_order_id,
      'admin-' || p_order_id || '-' || p_kind || '-' || extract(epoch from now())::bigint,
      p_kind, v_amount, 'pago', 'manual', now()
    )
    returning * into pay;
  else
    update public.payments
      set status = 'pago', amount = coalesce(p_amount, amount), paid_at = now(), updated_at = now()
      where id = pay.id
      returning * into pay;
  end if;

  perform public.apply_payment(p_order_id, p_kind, pay.amount, pay.txid, now());
end;
$$;

grant execute on function public.admin_confirm_payment(text, text, numeric) to authenticated;

-- Libera o saldo final depois que o box fecha.
create or replace function public.admin_release_balance(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  update public.orders
    set status = 'saldo_liberado',
        balance = greatest(0, total - sinal),
        events = coalesce(events, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('at', now(), 'text', 'Box fechado. Saldo final liberado para pagamento.')
        ),
        updated_at = now()
    where id = o.id;
end;
$$;

grant execute on function public.admin_release_balance(text) to authenticated;

-- ---------------------------------------------------------
-- 13. TRIGGERS DE updated_at
-- ---------------------------------------------------------
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists addresses_touch on public.addresses;
create trigger addresses_touch before update on public.addresses
  for each row execute function public.touch_updated_at();

drop trigger if exists lots_touch on public.lots;
create trigger lots_touch before update on public.lots
  for each row execute function public.touch_updated_at();

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists stock_items_touch on public.stock_items;
create trigger stock_items_touch before update on public.stock_items
  for each row execute function public.touch_updated_at();

drop trigger if exists auctions_touch on public.auctions;
create trigger auctions_touch before update on public.auctions
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.lots enable row level security;
alter table public.products enable row level security;
alter table public.stock_items enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

-- Remove políticas antigas (permite rodar este arquivo mais de uma vez).
drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles admin all" on public.profiles;

create policy "profiles select own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles admin all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Endereços
drop policy if exists "addresses select own" on public.addresses;
drop policy if exists "addresses insert own" on public.addresses;
drop policy if exists "addresses update own" on public.addresses;
drop policy if exists "addresses delete own" on public.addresses;
drop policy if exists "addresses admin all" on public.addresses;

create policy "addresses select own" on public.addresses
  for select to authenticated using (user_id = auth.uid());
create policy "addresses insert own" on public.addresses
  for insert to authenticated with check (user_id = auth.uid());
create policy "addresses update own" on public.addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "addresses delete own" on public.addresses
  for delete to authenticated using (user_id = auth.uid());
create policy "addresses admin all" on public.addresses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Catálogo: membros logados leem; admin gerencia.
drop policy if exists "lots read" on public.lots;
drop policy if exists "lots admin all" on public.lots;
create policy "lots read" on public.lots
  for select to authenticated using (true);
create policy "lots admin all" on public.lots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products read" on public.products;
drop policy if exists "products admin all" on public.products;
create policy "products read" on public.products
  for select to authenticated using (true);
create policy "products admin all" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "stock read" on public.stock_items;
drop policy if exists "stock admin all" on public.stock_items;
create policy "stock read" on public.stock_items
  for select to authenticated using (true);
create policy "stock admin all" on public.stock_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "auctions read" on public.auctions;
drop policy if exists "auctions admin all" on public.auctions;
create policy "auctions read" on public.auctions
  for select to authenticated using (true);
create policy "auctions admin all" on public.auctions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lances
drop policy if exists "bids read" on public.bids;
drop policy if exists "bids insert own" on public.bids;
drop policy if exists "bids admin all" on public.bids;
create policy "bids read" on public.bids
  for select to authenticated using (true);
create policy "bids insert own" on public.bids
  for insert to authenticated with check (user_id = auth.uid());
create policy "bids admin all" on public.bids
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedidos
drop policy if exists "orders select own" on public.orders;
drop policy if exists "orders insert own" on public.orders;
drop policy if exists "orders admin all" on public.orders;
create policy "orders select own" on public.orders
  for select to authenticated using (user_id = auth.uid());
create policy "orders insert own" on public.orders
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status in ('aguardando_sinal', 'aguardando_pagamento')
    and stock_applied = false
    and paid_at is null
  );
create policy "orders admin all" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pagamentos: cliente vê os do próprio pedido; admin vê todos.
drop policy if exists "payments select own" on public.payments;
drop policy if exists "payments admin all" on public.payments;
create policy "payments select own" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = payments.order_id and o.user_id = auth.uid()
  ));
create policy "payments admin all" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Configurações: leitura livre (a tela de login precisa do tema),
-- gravação apenas pelo administrador.
drop policy if exists "settings read" on public.settings;
drop policy if exists "settings admin write" on public.settings;
create policy "settings read" on public.settings
  for select to anon, authenticated using (true);
create policy "settings admin write" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- 15. TEMPO REAL (Realtime)
-- ---------------------------------------------------------
alter table public.profiles replica identity full;
alter table public.addresses replica identity full;
alter table public.lots replica identity full;
alter table public.products replica identity full;
alter table public.stock_items replica identity full;
alter table public.auctions replica identity full;
alter table public.bids replica identity full;
alter table public.orders replica identity full;
alter table public.payments replica identity full;
alter table public.settings replica identity full;

do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'addresses', 'lots', 'products', 'stock_items',
    'auctions', 'bids', 'orders', 'payments', 'settings'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array tables loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 16. PERMISSÕES BÁSICAS
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.settings to anon;
grant select on public.lots, public.products, public.stock_items, public.auctions to anon;
grant usage, select on all sequences in schema public to authenticated;
