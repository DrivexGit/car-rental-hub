# Design references — DriveX customer app

Approved direction from Zakeri (2026-10-01). Both screens were generated with the prompts below.

| File | Screen |
|---|---|
| `home-screen.jpg` | Home: greeting, promo carousel, pending invoice with "Pay now", Recent bookings, Offers for you |
| `support-screen.jpg` | Support: emergency hotline (3-call limit), WhatsApp support, UAE emergency numbers |

Visual rules taken from these screens:
- Deep green primary, warm off-white background, large bold headings and big readable text.
- Pale tinted cards (pink for alerts and invoices, green for WhatsApp).
- Tab bar: Home / Bookings / Support / FAQ / Profile.

**UX rule:** keep Kamyar's original flows, screens and navigation exactly (Figma `Jdu9YvVoaFqtiiDfNkA7h9`). Change only the UI.

---

## Prompt 1: redesign from an existing screenshot
Use when a screen already exists in Kamyar's Figma. Image A = current screen; B, C, D = brand and business references.

```
Act as a world-class UI redesign specialist.

Image A is the current UI.
Image B, C, D are business and brand references.
Use them to understand the business and redesign the interface.

Create a premium redesign of the current UI while preserving the core purpose and structure of the page.
Improve:
- layout
- hierarchy
- spacing
- typography
- color usage
- button styles
- card design
- section flow
- overall visual sophistication

The final output must be a static image of the redesigned UI, not code.

The result should feel:
- premium
- modern
- elegant
- clean
- highly professional
- tailored specifically to this business

Avoid generic template aesthetics.
Make it look custom, refined, and art-directed.
```

## Prompt 2: new screen from business images only
Use when no UI exists yet and you only have the logo, product and business photos.

```
Act as a senior UI designer and visual brand interpreter.

Use the provided business images and brand references to understand the business identity, audience, mood, and product offering.

Create a highly polished UI concept as a static image for this business.
The design should reflect the business visually and strategically.

Create a premium interface that feels:
- custom-designed
- brand-aligned
- elegant
- visually rich
- modern and highly professional

Use the business images to influence:
- color palette
- mood
- visual direction
- content hierarchy
- UI personality

Output a beautiful, realistic UI image only.
No code, no wireframe style, no low-fidelity design.
This should look like a finished premium product concept.
```

Tip: always attach `home-screen.jpg` and `support-screen.jpg` as extra references so every new screen matches them.
