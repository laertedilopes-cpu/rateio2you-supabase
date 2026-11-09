-- =========================================================
-- rateio2you — dados iniciais (catálogo de exemplo)
-- ---------------------------------------------------------
-- Rode DEPOIS de 01-schema.sql e 02-storage.sql.
-- Pode rodar mais de uma vez: nada é duplicado nem sobrescrito.
-- =========================================================

-- Configurações iniciais (só preenche se ainda estiver vazio).
-- OBS: o Postgres aceita no máximo 100 argumentos por jsonb_build_object,
-- por isso as configurações foram divididas em 3 blocos unidos com "||".
update public.settings
set data =
  jsonb_build_object(
    'siteName', 'rateio2you',
    'brandMark', '2',
    'brandLogo', '',
    'brandHighlight', '2',
    'brandSub', 'Compras coletivas · China → Brasil',
    'pageTitle', 'rateio2you — compras coletivas',
    'metaDescription', 'rateio2you — organização de compras coletivas para membros aprovados. Catálogo por lote, caixas de 10 unidades, sinal e pagamento via Pix.',
    'contactEmail', '',
    'contactWhatsapp', '',
    'contactInstagram', '',
    'announceLeft', 'Compras coletivas privadas · envio para todo o Brasil',
    'announceRight', 'Pagamento exclusivo via Pix',
    'footerTagline', 'Organização de compras coletivas para membros aprovados. Um único Pix para cada etapa da reserva.',
    'footerNote', 'rateio2you · uso restrito ao grupo · valores em BRL',
    'footerDemo', 'Pagamento protegido via Pix · Banco Inter',
    'authTag', 'Grupo fechado · acesso aprovado',
    'authHeadline1', 'Compre junto.',
    'authHeadline2', 'Pague menos.',
    'authLead', 'Um só lugar para organizar reservas, fechar caixas de {caixa} unidades e pagar tudo com Pix — do sinal ao saldo final.',
    'authBenefits', jsonb_build_array(
      'Catálogo por lote e caixa compartilhada',
      'Sinal de {sinal} por {unidade}, descontado do total',
      'Frete calculado pela região do seu CEP',
      'Acompanhamento do envio e da entrega'
    )
  )
  ||
  jsonb_build_object(
    'loginTitle', 'Entrar no grupo',
    'loginLead', 'Use o e-mail cadastrado no rateio e sua senha de acesso.',
    'signupTitle', 'Criar conta',
    'signupLead', 'Seu cadastro é salvo na nuvem. O organizador libera o acesso depois da conferência dos dados.',
    'autoApproveUsers', false,
    'guideTitle', 'Do cadastro à entrega, sem surpresa',
    'guideLead', 'Entenda como o {site} organiza reservas, caixas de {caixa} unidades, sinal e saldo final — e o que esperar em cada etapa.',
    'privacyTitle', 'Política de Privacidade',
    'privacyUpdated', 'Última atualização: novembro de 2026',
    'privacyIntro', 'Esta política explica como o {site} trata os dados pessoais dos participantes do grupo fechado de compras coletivas, em conformidade com a Lei nº 13.709/2018 (LGPD).',
    'termsTitle', 'Termos de Serviço',
    'termsUpdated', 'Última atualização: novembro de 2026',
    'termsIntro', 'Estes termos regulam o uso do {site}, ferramenta de organização de compras coletivas destinada aos membros aprovados do grupo.',
    'pixProvider', 'inter',
    'pixKey', '',
    'pixMerchant', 'RATEIO2YOU',
    'pixCity', 'SAO PAULO',
    'sinalEnabled', true,
    'sinalPorVial', 20,
    'boxSize', 10
  )
  ||
  jsonb_build_object(
    'unitLabel', 'unidade',
    'unitLabelPlural', 'unidades',
    'specsLabel', 'Modelo',
    'shippingEnabled', true,
    'shipping', jsonb_build_object(
      'Sudeste', 39.90,
      'Sul', 49.90,
      'Centro-Oeste', 59.90,
      'Nordeste', 69.90,
      'Norte', 79.90
    ),
    'storePrimary', '#2b211b',
    'storeAccent', '#a65b3c',
    'bannerImage', '',
    'bannerTitle', '',
    'bannerSubtitle', '',
    'demoMode', false
  )
where id = 1 and (data = '{}'::jsonb or data is null);

-- Lote de exemplo
insert into public.lots (id, brand, monogram, title, tag, description, open, accent, closes_at, note, sort_order)
values (
  'lote-smartwatch',
  'Smartwatch Store',
  'SW',
  '01 · Rateio · Smartwatch',
  'Estoque EUA',
  'Compra coletiva com fechamento de caixa a cada 10 unidades.',
  true,
  '#5580d7',
  now() + interval '9 days',
  'Reservas abertas · fechamento em 9 dias',
  0
)
on conflict (id) do nothing;

-- Produtos do catálogo
insert into public.products
  (id, lot_id, name, brand, specs, sku, price, box_filled, closed_boxes, stock_qty, max_per_order, tag, description, image, active, sort_order)
values
  (
    'p-watch-series-9', 'lote-smartwatch', 'Apple Watch Series 9', 'Apple', '45 mm · GPS', 'APL-S9-45',
    3299, 4, 0, 30, 10, 'Mais vendido',
    'Caixa de alumínio, tela Retina sempre ativa, GPS e resistência à água. Lacrado, com nota e garantia de 12 meses.',
    'assets/img/products/watch-series-9.svg', true, 0
  ),
  (
    'p-galaxy-watch-6', 'lote-smartwatch', 'Samsung Galaxy Watch 6', 'Samsung', '44 mm · Bluetooth', 'SAM-GW6-44',
    1899, 7, 1, 24, 10, 'Quase fechando',
    'Tela Super AMOLED, monitor de sono e frequência cardíaca, bateria de longa duração. Lacrado, com nota e garantia de 12 meses.',
    'assets/img/products/galaxy-watch-6.svg', true, 1
  ),
  (
    'p-watch-s3', 'lote-smartwatch', 'Xiaomi Watch S3', 'Xiaomi', '46 mm · Bluetooth', 'XIA-S3-46',
    899, 2, 0, 40, 10, 'Box novo',
    'Tela AMOLED, GPS integrado, mais de 100 modos esportivos e até 15 dias de bateria. Lacrado, com nota e garantia de 12 meses.',
    'assets/img/products/watch-s3.svg', true, 2
  )
on conflict (id) do nothing;

-- Pronta entrega
insert into public.stock_items (id, name, brand, specs, price, qty, lot, description, image, active, sort_order)
values
  (
    's-watch-series-9', 'Apple Watch Series 9', 'Apple', '45 mm · GPS', 3399, 3, 'Smartwatch Store',
    'Pronta entrega no Brasil, lacrado e com garantia de 12 meses.',
    'assets/img/products/watch-series-9.svg', true, 0
  ),
  (
    's-watch-s3', 'Xiaomi Watch S3', 'Xiaomi', '46 mm · Bluetooth', 949, 4, 'Smartwatch Store',
    'Pronta entrega no Brasil, lacrado e com garantia de 12 meses.',
    'assets/img/products/watch-s3.svg', true, 1
  )
on conflict (id) do nothing;

-- Leilões
insert into public.auctions
  (id, title, origin, description, specs, start_bid, increment, ends_at, image, active)
values
  (
    'auc1', 'Apple Watch Series 9 · 45 mm', 'Item de saldo não pago · lote Smartwatch',
    'Lacrado, com nota e garantia de 12 meses.', '45 mm · GPS', 2490, 50,
    now() + interval '3 hours', 'assets/img/products/watch-series-9.svg', true
  ),
  (
    'auc2', 'Samsung Galaxy Watch 6 · 44 mm', 'Item de saldo não pago · lote Smartwatch',
    'Lacrado, com nota e garantia de 12 meses.', '44 mm · Bluetooth', 1390, 30,
    now() + interval '1 day', 'assets/img/products/galaxy-watch-6.svg', true
  )
on conflict (id) do nothing;

-- =========================================================
-- IMPORTANTE: criar o administrador
-- ---------------------------------------------------------
-- 1. Vá em Authentication → Users → Add user e crie seu login
--    (ex.: laertedilopes@gmail.com). Confirme o e-mail se pedir.
-- 2. Volte ao SQL Editor e rode o comando abaixo trocando o e-mail:
--
--    update public.profiles
--       set role = 'admin', status = 'ativo'
--     where email = 'laertedilopes@gmail.com';
--
-- Pronto: entre em admin.html com esse e-mail e senha.
-- =========================================================
