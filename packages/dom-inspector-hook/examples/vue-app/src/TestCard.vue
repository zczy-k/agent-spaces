<template>
  <div style="border: 1px solid #ccc; padding: 16px; margin: 16px 0; border-radius: 8px">
    <h2>{{ title }}</h2>
    <slot />
  </div>
</template>

<script setup>
defineProps({ title: String })
</script>
