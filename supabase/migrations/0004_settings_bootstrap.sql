-- =====================================================================
-- VELOX EXPRESS — settings bootstrap
--
-- WHAT IS IN HERE: only the business facts supplied in the brief
-- (name, proprietor, location, phone, brand colours) plus neutral UI
-- copy for structural page sections.
--
-- WHAT IS DELIBERATELY NOT IN HERE: prices, offers, banners, orders,
-- riders, customers, expenses, reviews, delivery counts, ratings, UPI
-- IDs, QR codes. Those stay empty until the owner enters them, and the
-- app shows an empty state instead of a made-up number.
--
-- Every value below is editable from Admin → Settings.
-- =====================================================================

insert into settings (key, value) values
('brand', jsonb_build_object(
  'websiteName',      'Velox Express',
  'brandName',        'VELOX EXPRESS',
  'tagline',          'Fast. Safe. Reliable.',
  'brandDescription', 'Local courier and parcel delivery.',
  'logoUrl',          '',
  'logoLightUrl',     '',
  'logoDarkUrl',      '',
  'footerLogoUrl',    '',
  'faviconUrl',       '',
  'appIconUrl',       '',
  'browserTitle',     'Velox Express — Courier & Parcel Delivery'
)),

('contact', jsonb_build_object(
  'businessName',  'Velox Express',
  'proprietor',    'Dildar Alam',
  'phone',         '8294266187',
  'whatsapp',      '8294266187',
  'countryCode',   '91',
  'email',         '',
  'addressLine1',  '',
  'addressLine2',  '',
  'city',          'Katihar',
  'state',         'Bihar',
  'pinCode',       '',
  'mapsUrl',       '',
  'businessHoursNote', ''
)),

('social', jsonb_build_object(
  'facebook', '', 'instagram', '', 'youtube', '', 'x', '', 'linkedin', ''
)),

-- Hex values here are converted to RGB channels and written to CSS
-- custom properties at boot, so changing them takes effect without a
-- rebuild and without touching any component.
('theme', jsonb_build_object(
  'primary',       '#0A1F44',
  'primaryDark',   '#06142E',
  'primaryLight',  '#1A3A70',
  'accent',        '#FFC42E',
  'accentDark',    '#E0A616',
  'secondary',     '#1A3A70',
  'background',    '#F6F8FB',
  'surface',       '#FFFFFF',
  'text',          '#0F1A2D',
  'textMuted',     '#64728A',
  'border',        '#E0E5EE',
  'buttonRadius',  '12'
)),

('navigation', jsonb_build_object(
  'items', jsonb_build_array(
    jsonb_build_object('label','Home',           'path','/',               'visible',true,'order',1),
    jsonb_build_object('label','Services',       'path','/services',       'visible',true,'order',2),
    jsonb_build_object('label','Rate calculator','path','/rate-calculator','visible',true,'order',3),
    jsonb_build_object('label','Track order',    'path','/track',          'visible',true,'order',4),
    jsonb_build_object('label','Business',       'path','/business',       'visible',true,'order',5),
    jsonb_build_object('label','Offers',         'path','/offers',         'visible',true,'order',6),
    jsonb_build_object('label','About',          'path','/about',          'visible',true,'order',7),
    jsonb_build_object('label','Contact',        'path','/contact',        'visible',true,'order',8)
  ),
  'ctaLabel', 'Book a pickup',
  'ctaPath',  '/book'
)),

('header', jsonb_build_object(
  'showAnnouncement', false,
  'announcementText', '',
  'announcementLink', '',
  'showCallButton',   true,
  'showWhatsappButton', true,
  'sticky',           true
)),

('footer', jsonb_build_object(
  'description', '',
  'copyright',   '',
  'showSocial',  true,
  'sections', jsonb_build_array(
    jsonb_build_object('title','Company','links', jsonb_build_array(
      jsonb_build_object('label','About','path','/about'),
      jsonb_build_object('label','Services','path','/services'),
      jsonb_build_object('label','Business','path','/business')
    )),
    jsonb_build_object('title','Help','links', jsonb_build_array(
      jsonb_build_object('label','Track order','path','/track'),
      jsonb_build_object('label','FAQ','path','/faq'),
      jsonb_build_object('label','Safety & rules','path','/safety'),
      jsonb_build_object('label','Contact','path','/contact')
    )),
    jsonb_build_object('title','Legal','links', jsonb_build_array(
      jsonb_build_object('label','Privacy policy','path','/privacy'),
      jsonb_build_object('label','Terms & conditions','path','/terms')
    ))
  )
)),

('seo', jsonb_build_object(
  'title',           'Velox Express — Courier & Parcel Delivery',
  'metaDescription', '',
  'ogImageUrl',      '',
  'keywords',        '',
  'canonicalUrl',    ''
)),

('pwa', jsonb_build_object(
  'appName',         'Velox Express',
  'shortName',       'Velox',
  'themeColor',      '#0A1F44',
  'backgroundColor', '#FFFFFF',
  'iconUrl',         '',
  'display',         'standalone'
)),

('booking', jsonb_build_object(
  'parcelTypes', jsonb_build_array(
    'Document','Package','Electronics','Clothing','Food','Medicine','Other'
  ),
  'maxWeightKg',        0,
  'minLeadTimeHours',   0,
  'maxAdvanceDays',     7,
  'requireReceiverPhone', true,
  'unavailableMessage',
    'Pricing is currently unavailable. Please contact Velox Express.'
)),

('payments', jsonb_build_object(
  'upiId',              '',
  'upiDisplayName',     '',
  'qrImageUrl',         '',
  'instructions',       '',
  'onlineEnabled',      false,
  'cashEnabled',        true,
  'payLaterEnabled',    false,
  'gatewayEnabled',     false
))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Working hours: one row per weekday so the admin screen has something
-- to edit. Times are NULL — the owner sets them. The site shows
-- "Hours not set yet" rather than inventing an opening time.
-- ---------------------------------------------------------------------
insert into working_hours (day_of_week, is_open, opens_at, closes_at)
select d, true, null, null from generate_series(0, 6) d
on conflict (day_of_week) do nothing;

-- ---------------------------------------------------------------------
-- Homepage section scaffold. Titles describe how the service works,
-- which is product mechanics rather than a business claim. All of it is
-- editable, reorderable and can be switched off in Admin → Website.
-- Sections with no content render nothing.
-- ---------------------------------------------------------------------
insert into content_sections (page, section_key, title, subtitle, description, display_order, is_active) values
('home','hero','Parcels across Katihar, handled properly.',
 'Fast. Safe. Reliable.',
 'Book a pickup in under a minute. Track it until it reaches the door.', 1, true),
('home','trust','Why people send with us', null, null, 2, true),
('home','how_it_works','How it works', null,
 'Four steps from your door to theirs.', 3, true),
('home','services','What we deliver', null, null, 4, true),
('home','calculator','Check the price first',
 'No surprises at pickup.', null, 5, true),
('home','why_us','Built for local delivery', null, null, 6, true),
('home','offers','Current offers', null, null, 7, true),
('home','business','Sending parcels regularly?',
 'Business accounts get agreed rates and monthly billing.', null, 8, true),
('home','faq','Questions', null, null, 9, true),
('home','contact_cta','Ready to send something?', null, null, 10, true),
('about','intro','About Velox Express', null, null, 1, true),
('business','intro','Business accounts', null, null, 1, true),
('contact','intro','Get in touch', null, null, 1, true),
('safety','intro','Safety & rules', null,
 'What we can carry, how to pack it, and what happens if something goes wrong.', 1, true),
('privacy','intro','Privacy policy', null, null, 1, true),
('terms','intro','Terms & conditions', null, null, 1, true)
on conflict (page, section_key) do nothing;
