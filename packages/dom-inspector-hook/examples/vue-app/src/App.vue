<template>
  <div style="padding: 40px">
    <h1>Vue Inspector Hook Test</h1>
    <p>按 Alt+Shift 点击元素，触发 capture POST</p>

    <TestCard title="Card A">
      <p>Card A content</p>
    </TestCard>

    <TestCard title="Card B">
      <button @click="count++">Clicked {{ count }} times</button>
    </TestCard>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TestCard from './TestCard.vue'

const count = ref(0)
</script>
