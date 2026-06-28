# Portfolio backlog

Functions / checkout apps run on Shopify infra (cheapest to operate). Storefront
widgets are listed for later when the core grows a Theme App Extension path.

## Tier 1 — Shopify Functions (start here; little/no backend)

### Discounts (`cart.lines.discounts.generate.run`)
1. **Volume / quantity discount** — % off at qty thresholds. *(built: apps/volume-discount, preset discount-qty)*
2. **Spend-more-save-more** — % off at cart-subtotal thresholds. *(built: apps/spend-save, preset discount-spend)*
3. Bundle discount — buy X + Y together, get % off.
4. BOGO / buy-X-get-Y-free.
5. Tiered loyalty discount by customer tag/segment.
6. First-order discount (new customers only).
7. Bulk-pricing for B2B / wholesale tags.
8. Free gift with purchase (auto-add via discount + cart transform).
9. Clearance / collection-specific auto discount.
10. Frequency/subscription-style stacked discount.

### Cart & checkout validation (`cart.validations.generate.run`)
11. **Minimum order amount enforcement.** *(built: apps/order-limits, preset cart-min-max)*
12. **Maximum order quantity / anti-scalping limit.** *(built: apps/order-limits — Pro tier)*
13. Per-product purchase limits.
14. Block mixed domestic/international carts.
15. Require minimum quantity for specific products.
16. PO-box / region checkout blocking.

### Delivery customization (`cart.delivery-options.generate.run`)
17. Hide express shipping below a threshold.
18. Rename/reorder shipping methods by cart contents.
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
