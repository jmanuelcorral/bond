<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useData } from 'vitepress'

const { lang } = useData()
const command = 'brew install jmanuelcorral/tap/bond'
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copyCommand() {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(command)
    } else {
      fallbackCopy(command)
    }
  } catch {
    fallbackCopy(command)
  }

  copied.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-9999px'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(ta)
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="quick-install-wrapper">
    <div
      class="quick-install-box"
      :class="{ 'is-copied': copied }"
      role="button"
      tabindex="0"
      :aria-label="(lang === 'en' ? 'Copy command: ' : 'Copiar comando: ') + command"
      @click="copyCommand"
      @keydown.enter.prevent="copyCommand"
      @keydown.space.prevent="copyCommand"
    >
      <div class="quick-install-content">
        <span class="quick-install-prompt" aria-hidden="true">$</span>
        <code class="quick-install-cmd">{{ command }}</code>
      </div>

      <button
        type="button"
        class="quick-install-btn"
        :class="{ 'is-copied': copied }"
        :title="copied ? (lang === 'en' ? 'Copied to clipboard!' : '¡Copiado!') : (lang === 'en' ? 'Copy to clipboard' : 'Copiar al portapapeles')"
        :aria-label="copied ? (lang === 'en' ? 'Copied' : 'Copiado') : (lang === 'en' ? 'Copy' : 'Copiar')"
      >
        <svg v-if="!copied" class="icon-copy" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <svg v-else class="icon-check" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span class="btn-label">{{ copied ? (lang === 'en' ? 'Copied' : 'Copiado') : (lang === 'en' ? 'Copy' : 'Copiar') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-install-wrapper {
  margin-top: 24px;
  width: 100%;
  max-width: 520px;
}

@media (max-width: 959px) {
  .quick-install-wrapper {
    margin-left: auto;
    margin-right: auto;
  }
}

.quick-install-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background-color: #0d1117;
  border: 1px solid var(--bond-c-border);
  border-radius: 10px;
  padding: 8px 10px 8px 14px;
  cursor: pointer;
  box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.25);
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
  user-select: none;
}

.quick-install-box:hover {
  border-color: #06b6d4;
  box-shadow: 0 6px 20px -4px rgba(6, 182, 212, 0.25);
}

.quick-install-box:focus-visible {
  outline: 2px solid #06b6d4;
  outline-offset: 2px;
}

.quick-install-box.is-copied {
  border-color: #10e5c2;
}

.quick-install-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.quick-install-prompt {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  font-weight: 700;
  color: #06b6d4;
  flex-shrink: 0;
}

.quick-install-cmd {
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  font-weight: 500;
  color: #e6edf3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: transparent;
  padding: 0;
}

.quick-install-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 150ms ease;
}

.quick-install-box:hover .quick-install-btn {
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.25);
}

.quick-install-btn.is-copied {
  background-color: rgba(16, 229, 194, 0.15);
  border-color: #10e5c2;
  color: #10e5c2;
}

.btn-label {
  line-height: 1;
}

@media (max-width: 639px) {
  .quick-install-box {
    padding: 8px 10px 8px 12px;
  }
  .quick-install-cmd {
    font-size: 12px;
  }
  .btn-label {
    display: none;
  }
}
</style>
