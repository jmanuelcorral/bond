// Site de la documentación (GitHub Pages, https://josecorral.dev/bond/), en castellano
// (raíz) e inglés (/en/). Las páginas son los .md de docs/ y docs/en/, que siguen leyéndose igual
// en GitHub; prepare.mjs las copia a src/ antes de construir. Aquí solo la navegación y el
// estilo. Fuera: los planes (docs/plans/ y docs/plan-*.md), que son de trabajo interno.

import { defineConfig, type DefaultTheme } from "vitepress";

const REPO = "https://github.com/jmanuelcorral/bond";

/** Anclas como las de GitHub: los enlaces #sección de docs/ valen en los dos sitios. */
const slugify = (s: string) =>
	s
		.trim()
		.toLowerCase()
		.replace(/<[^>]*>/g, "")
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.replace(/\s/g, "-");

const es: DefaultTheme.Config = {
	nav: [
		{ text: "Empezar", link: "/getting-started" },
		{ text: "Referencia", link: "/reference" },
		{ text: "Cambios", link: `${REPO}/blob/main/CHANGELOG.md` },
		{ text: "Descargar", link: `${REPO}/releases/latest` },
	],
	sidebar: [
		{
			text: "Guía",
			items: [
				{ text: "Primeros pasos", link: "/getting-started" },
				{ text: "El puesto de trabajo", link: "/workstation" },
				{ text: "Problemas habituales", link: "/troubleshooting" },
			],
		},
		{
			text: "Referencia",
			items: [
				{ text: "Comandos y configuración", link: "/reference" },
				{ text: "Configuración por repo", link: "/reference#configuración-por-repo-bond-init-y-bond-sync" },
				{ text: "Catálogos del equipo", link: "/reference#catálogo-propio-bond-catalog" },
				{ text: "Skills del catálogo", link: "/reference#skills-del-catálogo" },
				{ text: "bond doctor", link: "/reference#bond-doctor" },
			],
		},
	],
	// workstation.md se publica desde docs/puesto.md (prepare.mjs). VitePress pasa esta función
	// al navegador tal cual: no puede usar variables de fuera (REPO), de ahí la URL escrita.
	editLink: {
		pattern: ({ filePath }) => `https://github.com/jmanuelcorral/bond/edit/main/docs/${filePath === "workstation.md" ? "puesto.md" : filePath}`,
		text: "Editar esta página en GitHub",
	},
	outline: { level: [2, 3], label: "En esta página" },
	docFooter: { prev: "Anterior", next: "Siguiente" },
	darkModeSwitchLabel: "Tema",
	lightModeSwitchTitle: "Cambiar a claro",
	darkModeSwitchTitle: "Cambiar a oscuro",
	sidebarMenuLabel: "Menú",
	returnToTopLabel: "Volver arriba",
	langMenuLabel: "Idioma",
	notFound: { title: "Esta página no existe", quote: "Puede que se haya movido.", linkText: "Ir al inicio" },
	footer: { message: "MIT · 007 · licence to code", copyright: "bond" },
};

const en: DefaultTheme.Config = {
	nav: [
		{ text: "Get started", link: "/en/getting-started" },
		{ text: "Reference", link: "/en/reference" },
		{ text: "Changelog", link: `${REPO}/blob/main/CHANGELOG.md` },
		{ text: "Download", link: `${REPO}/releases/latest` },
	],
	sidebar: [
		{
			text: "Guide",
			items: [
				{ text: "Getting started", link: "/en/getting-started" },
				{ text: "The workstation", link: "/en/workstation" },
				{ text: "Troubleshooting", link: "/en/troubleshooting" },
			],
		},
		{
			text: "Reference",
			items: [
				{ text: "Commands and configuration", link: "/en/reference" },
				{ text: "Per-repo config", link: "/en/reference#per-repo-configuration-bond-init-and-bond-sync" },
				{ text: "Team catalogs", link: "/en/reference#your-own-catalog-bond-catalog" },
				{ text: "Catalog skills", link: "/en/reference#catalog-skills" },
				{ text: "bond doctor", link: "/en/reference#bond-doctor" },
			],
		},
	],
	editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: "Edit this page on GitHub" },
	outline: { level: [2, 3], label: "On this page" },
	footer: { message: "MIT · 007 · licence to code", copyright: "bond" },
};

export default defineConfig({
	title: "bond",
	base: "/bond/",
	srcDir: "src",
	outDir: "./dist",
	cleanUrls: true,
	head: [["link", { rel: "icon", href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%231f2fa8'/><text x='16' y='23' font-family='monospace' font-size='18' font-weight='700' text-anchor='middle' fill='%23ff3ec9'>B</text></svg>" }]],
	markdown: { anchor: { slugify } },
	locales: {
		root: {
			label: "Español",
			lang: "es",
			description: "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr",
			themeConfig: es,
		},
		en: {
			label: "English",
			lang: "en",
			link: "/en/",
			description: "A CLI to work with several coding agents (pi, Claude Code, Codex, Copilot...) in Herdr",
			themeConfig: en,
		},
	},
	themeConfig: {
		socialLinks: [{ icon: "github", link: REPO }],
		search: {
			provider: "local",
			options: {
				locales: {
					root: {
						translations: {
							button: { buttonText: "Buscar", buttonAriaLabel: "Buscar" },
							modal: {
								noResultsText: "Sin resultados para",
								resetButtonTitle: "Borrar la búsqueda",
								footer: { selectText: "elegir", navigateText: "moverse", closeText: "cerrar" },
							},
						},
					},
				},
			},
		},
	},
});
