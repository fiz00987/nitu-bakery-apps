# Nitu Baburchir Portfolio — bakery website

Public storefront: **https://nitu-portfolio.web.app/**

Static HTML/CSS/JavaScript, self-hosted Bengali/English fonts and optimized WebP
cake photos. No build step or application dependencies are required. Serve this
directory with a static HTTP server for local preview.

## Connected apps

- Single-cake ordering: https://nitusbakingplanv2-customer.web.app/
- Multi-cake ordering: https://nitusbakingplanv2-multi.web.app/
- Customer reviews: https://nitu-review.web.app/
- Facebook: https://www.facebook.com/nituscake/
- Messenger: https://m.me/nituscake
- Pickup map: https://maps.app.goo.gl/vAk44BoEWRbppBuz8

The storefront sends customers to the existing live forms for scheduling,
authentication, payments, and order submission. All prices are labelled as the
basic-design guide; the agreed quote is still supplied through the bakery inbox.

## Content sources

- Names and flavour IDs: `../customer-app/utils.js`.
- Recipes and availability: `../customer-app/flavours.txt`.
- Basic-design guide and minimum weights: `../customer-app/base price.txt`.
- Mini/medium sizes: `../customer-app/mini cake.txt` and `medium cake.txt`.
  Their price ranges differ from `base price.txt`, so smaller-cake prices are
  intentionally quote-based until the business updates those source files.
- Pickup address/map, delivery window, payment and advance rules:
  `../customer-app/index.html`, `app.js`, and `../customer-multi/app.js`.
- Contact number: `../customer-app/bank details.txt`.
- Review benefit: `../review-app/index.html` and the admin's one-use reward flow.
- Brand logo: `../admin-app/logo-white.png`; the header version recolours the
  original transparent pixels to match the storefront palette.
- Baking/art story: the public Facebook page description, indexed in public
  search results. No customer testimonials, ratings, or follower counts are used.

## Photo provenance

Public photographs bearing the bakery's Bengali watermark, collected from:
https://www.pinterest.com/yummycakectg/nitubaburchir-portpolios-cake/

The first two pins explicitly link the Nitu Facebook page:

- https://www.pinterest.com/pin/1134484962384553422/
- https://www.pinterest.com/pin/1134484962384553483/

Original image sources, downloaded at 736 px and converted to WebP:

| Local image | Source (`https://i.pinimg.com/736x/` + path) |
| --- | --- |
| blue-poetry.webp | 2b/59/5d/2b595d65727151ef180788f3e0b233f6.jpg |
| daisy-love.webp | 6b/fe/59/6bfe591f489928541c94b95a7d65c8ba.jpg |
| design-03.webp | 44/73/35/4473357f04626de71a465c0853659bc6.jpg |
| design-04.webp | 07/28/c3/0728c3b911486a30417de7408dcbb44a.jpg |
| design-05.webp | ef/22/d8/ef22d8a893636515cf139d9fad67da0c.jpg |
| design-06.webp | 38/77/fc/3877fc3281494f5d0e2e0a11298af840.jpg |
| design-07.webp | e4/a4/38/e4a4383efc5b594eb02344b36163ccf1.jpg |
| design-08.webp | c3/fa/df/c3fadf8482faca9d5efb98db7acbb29e.jpg |
| design-09.webp | 8e/87/5d/8e875d9c7369827116c322cf16fe8336.jpg |
| design-10.webp | 7f/c8/4e/7fc84e15b19fed3ba3955bba46d570c6.jpg |
| design-11.webp | 26/63/68/2663688a550b8559e4a86992405bcbd5.jpg |
| design-12.webp | 0c/e0/c0/0ce0c0eda0025401431185f566fce628.jpg |

Gallery captions describe visible designs; they do not infer flavours from photos.

## Interactions

- Bengali/English switching persists under `nitu-website-language`.
- Gallery categories, bilingual search, expandable collections, keyboard-enabled
  lightbox, real image downloads, and shared `?design=…` deep links.
- Favourites persist under `nitu-website-designs`; copied links can be pasted
  into the bakery inbox. No customer records are stored by this storefront.
- Fifteen-flavour menu with frosting categories and recipe/minimum-weight dialogs.
- Accessible native dialogs, FAQ disclosures, mobile navigation and order bar.
- Order, review, Messenger, telephone and map links point to the real services.

## Deployment

From the repository root:

```sh
firebase deploy --only hosting:website --project nitusbakingplanv2 --non-interactive
```

The `website` Hosting target is a dedicated sixth site in the existing project.
It has its own stable URL; existing app sites retain their normal destinations.

Run regression checks with `npm test`. Self-hosted font notices are in
`assets/FONT-LICENSES.txt`; font family sources are Google Fonts' OFL directories
for Hind Siliguri, Noto Serif Bengali, and Cormorant Garamond.
