<script setup lang="ts">
import { ThemeStore } from '@/stores'
import logoLight from '@/assets/logo/maitre-light.svg'
import logoDark from '@/assets/logo/maitre-dark.svg'
import { computed } from 'vue'
import { appConfig, DEFAULT_NAME, venueName } from '@/composables/useConfig'

/** `product`: always Chi Comanda (the landing page), otherwise the venue's name and logo. */
const props = withDefaults(defineProps<{ size?: number, product?: boolean }>(), { size: 200, product: false })
const themeStore = ThemeStore()
const name = computed(() => props.product ? DEFAULT_NAME : venueName.value)
const logo = computed(() => (!props.product && appConfig.value.logo) || (themeStore.theme === 'dark' ? logoDark : logoLight))
</script>

<template>
    <div class="brand-lockup">
        <img alt="" :src="logo" :width="size" :height="size" />
        <span class="brand-wordmark">{{ name }}</span>
        <span class="brand-rule" aria-hidden="true"><span></span></span>
    </div>
</template>

<style scoped>
.brand-lockup {
    display: grid;
    justify-items: center;
    gap: 12px;
}

.brand-wordmark {
    font-family: 'Federo', 'Futura', 'Century Gothic', sans-serif;
    font-size: 1.9rem;
    letter-spacing: .2em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
}

.brand-rule {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 160px;
}

.brand-rule::before,
.brand-rule::after {
    content: "";
    height: 1px;
    flex: 1;
    background: currentColor;
    opacity: .4;
}

.brand-rule span {
    width: 7px;
    height: 7px;
    background: #D29A3C;
    transform: rotate(45deg);
}
</style>
