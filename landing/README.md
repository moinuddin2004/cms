<div align="center">

<img src="../docs/images/logo.svg" alt="" width="64" />

<h1>Landing site</h1>

<p><b>The public marketing website for the clinic management platform.</b></p>

<p>
<img src="https://img.shields.io/badge/Astro_7-161b22?style=for-the-badge&logo=astro&logoColor=FF5D01" alt="Astro 7" />
<img src="https://img.shields.io/badge/Tailwind_CSS_4-161b22?style=for-the-badge&logo=tailwindcss&logoColor=06B6D4" alt="Tailwind CSS 4" />
<img src="https://img.shields.io/badge/TypeScript-161b22?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" />
</p>

<p>
<a href="#quick-start"><b>Quick start</b></a> &nbsp;·&nbsp;
<a href="#pages"><b>Pages</b></a> &nbsp;·&nbsp;
<a href="#structure"><b>Structure</b></a> &nbsp;·&nbsp;
<a href="#scripts"><b>Scripts</b></a> &nbsp;·&nbsp;
<a href="#rules"><b>Rules</b></a>
</p>

<sub><a href="../README.md">← Back to the main README</a></sub>

</div>

<br />

## Quick start

**You need:** Node.js `>=22.23.4`.

| Step | Command |
| --- | --- |
| 1 · Install | `npm install` |
| 2 · Start | `npm run dev` |
| 3 · Open | Visit [http://localhost:4321](http://localhost:4321) |

The public site is configured with `https://clinicly.pk` as its canonical site URL. There are no app API credentials required for local development.

<br />

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Product overview, clinic workflows, features, proof points and FAQs |
| `/pricing` | Plans and pricing information |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| Unknown path | Custom 404 page |

The home page is assembled from reusable sections. Shared navigation, footer, layout and icons live in `src/components/`.

<br />

## Structure

```text
src/
├── pages/        Astro page routes
├── components/   Shared layout, navigation, footer and page sections
├── data/         Site copy and structured content
├── layouts/      Shared document layout
└── styles/       Global styles and design tokens
public/           Static assets
```

<br />

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Astro development server on port `4321` |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run astro -- --help` | Show Astro CLI commands |

<br />

## Build and preview

```bash
npm run build
npm run preview
```

The production build uses the configured canonical domain when generating canonical page URLs.

<br />

## Rules

| Rule | Use |
| --- | --- |
| Keep routes in `src/pages/` | Astro maps page files to public URLs |
| Reuse shared sections and layout | Keep navigation, typography and page structure consistent |
| Put repeatable content in `src/data/` | Avoid duplicating FAQ and site content across pages |
| Preserve accessible page structure | Use semantic landmarks, useful link names and visible focus |
| Keep metadata accurate | Page titles, descriptions and canonical URLs are public-facing |

For framework conventions, see the [Astro documentation](https://docs.astro.build/). The main application and API are documented in the [repository README](../README.md).
