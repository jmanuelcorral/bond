// Tema de VitePress con los colores, layout y estilos de bond.
import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import "./style.css";

export default {
	extends: DefaultTheme,
	Layout,
};
