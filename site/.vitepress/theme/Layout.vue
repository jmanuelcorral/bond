<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRoute, useData, withBase } from "vitepress";
import DefaultTheme from "vitepress/theme";
import QuickInstall from "./components/QuickInstall.vue";

const { Layout } = DefaultTheme;
const route = useRoute();
const { frontmatter } = useData();

const hero = computed(() => frontmatter.value?.hero || null);
const heroText = computed(() => hero.value?.text);
const heroTagline = computed(() => hero.value?.tagline);

let ticking = false;

function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      checkScroll();
      ticking = false;
    });
    ticking = true;
  }
}

function checkScroll() {
  if (typeof window === "undefined") return;

  const heroEl = document.querySelector(".VPHero");
  const heroLogo = document.querySelector(".hero-brand-logo") as HTMLElement | null;

  if (!heroEl) {
    document.documentElement.classList.remove("has-hero-at-top");
    if (heroLogo) {
      heroLogo.style.transform = "";
      heroLogo.style.opacity = "";
    }
    return;
  }

  const sy = window.scrollY;

  // Navbar logo visibility: hidden when at hero top, docked and visible once scrolled
  if (sy < 80) {
    document.documentElement.classList.add("has-hero-at-top");
  } else {
    document.documentElement.classList.remove("has-hero-at-top");
  }

  // Hero logo shrinks and moves upward as the user scrolls down
  if (heroLogo) {
    if (sy <= 0) {
      heroLogo.style.transform = "";
      heroLogo.style.opacity = "";
    } else if (sy < 200) {
      const p = sy / 200;
      const scale = 1 - p * 0.25;
      const opacity = 1 - p * 0.6;
      heroLogo.style.transform = `scale(${scale.toFixed(3)}) translateY(-${(sy * 0.15).toFixed(1)}px)`;
      heroLogo.style.opacity = opacity.toFixed(3);
    } else {
      heroLogo.style.transform = "scale(0.75) translateY(-30px)";
      heroLogo.style.opacity = "0.4";
    }
  }
}

onMounted(() => {
  nextTick(() => {
    checkScroll();
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", checkScroll, { passive: true });
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", checkScroll);
    document.documentElement.classList.remove("has-hero-at-top");
  }
});

watch(
  () => route.path,
  () => {
    nextTick(() => {
      setTimeout(checkScroll, 50);
    });
  }
);
</script>

<template>
  <Layout>
    <template #home-hero-info>
      <h1 class="heading">
        <div class="hero-logo-box">
          <img
            :src="withBase('/logo-dark.png')"
            class="hero-brand-logo dark-only"
            alt="bond"
          />
          <img
            :src="withBase('/logo-light.png')"
            class="hero-brand-logo light-only"
            alt="bond"
          />
        </div>
        <span v-if="heroText" class="text">{{ heroText }}</span>
      </h1>
      <p v-if="heroTagline" class="tagline">{{ heroTagline }}</p>
    </template>

    <template #home-hero-actions-after>
      <QuickInstall />
    </template>
  </Layout>
</template>
