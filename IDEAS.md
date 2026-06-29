# Portfolio backlog

Functions / checkout apps run on Shopify infra (cheapest to operate). Storefront
widgets are listed for later when the core grows a Theme App Extension path.

## Tier 1 — Shopify Functions (start here; little/no backend)

### Discounts (`cart.lines.discounts.generate.run`)
1. **Volume / quantity discount** — % off at qty thresholds. *(built: apps/volume-discount, preset discount-qty)*
2. **Spend-more-save-more** — % off at cart-subtotal thresholds. *(built: apps/spend-save, preset discount-spend)*
3. **Bundle discount (N different products).** *(built: apps/bundle-discount, preset bundle)*
4. **BOGO / buy-X-get-Y.** *(built: apps/bogo, preset bogo)*
5. Tiered loyalty discount by customer tag/segment.
6. **First-order discount (new customers only).** *(built: apps/first-order-discount, preset first-order)*
7. Bulk-pricing for B2B / wholesale tags.
8. Free gift with purchase (auto-add via discount + cart transform).
9. Clearance / collection-specific auto discount.
10. Frequency/subscription-style stacked discount.

### Cart & checkout validation (`cart.validations.generate.run`)
11. **Minimum order amount enforcement.** *(built: apps/order-limits, preset cart-min-max)*
12. **Maximum order quantity / anti-scalping limit.** *(built: apps/order-limits — Pro tier)*
13. **Per-product purchase limits.** *(built: apps/product-limits, preset per-product-limit)*
14. **Block/allow checkout by country.** *(built: apps/country-block, preset country-block; allowlist mode on Pro)*
15. Require minimum quantity for specific products.
16. PO-box / region checkout blocking.

### Free shipping (`cart.delivery-options.discounts.generate.run`)
16b. **Free shipping over a threshold.** *(built: apps/free-shipping, preset free-shipping; second tier on Pro)*

### Delivery customization (`purchase.delivery-customization.run`)
17. **Hide express shipping below a threshold.** *(built: apps/hide-delivery, preset delivery-hide; also hides by country on Pro)*
18. **Rename/reorder shipping methods.** *(built: apps/rename-shipping, preset rename-shipping)*
19. Hide shipping methods for heavy/oversized items.
20. Local-pickup-only for certain products.

### Payment customization (`purchase.payment-customization.run`)
21. **Hide COD / a method by cart total.** *(built: apps/hide-payment, preset payment-hide)*
22. **Hide specific gateways for certain countries.** *(built: apps/hide-payment — Pro tier)*
23. Reorder payment methods to push preferred gateway.

## Tier 2 — Checkout UI extensions (needs core extension support)
24. Cart upsell / add-on offer.
25. Gift-message field at checkout.
26. Delivery-date picker.
27. Trust badges / guarantees block at checkout.
28. Custom thank-you-page offer.

## Tier 3 — Theme App Extensions (storefront; future core path)
29. Free-shipping progress bar.
30. Countdown / scarcity timer.
31. Stock counter / low-stock urgency.
32. Recently viewed products.
33. Size-chart popup.
34. Announcement bar.
35. Back-in-stock notify.

## Pricing default (from @factory/core/billing)
- Starter $4.99/mo — single rule/tier.
- Pro $9.99/mo — unlimited rules/tiers, scheduling, segments.
- 7-day trial on both.

Each app gates its "more than one of X" behind Pro — the upgrade prompt is the
core monetization lever and is already wired in the template.
