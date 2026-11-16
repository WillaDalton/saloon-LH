<script setup lang="ts">
import { onMounted, ref } from 'vue'

const status = ref('Vérification de la connexion à l’API…')

onMounted(async () => {
  try {
    const response = await fetch('/api/health')
    status.value = response.ok ? 'API et base de données disponibles' : 'API ou base de données indisponible'
  } catch {
    status.value = 'API indisponible'
  }
})
</script>

<template>
  <main>
    <h1>Saloon LH</h1>
    <p>Gestion du saloon RP sur Last Horizon.</p>
    <p role="status">{{ status }}</p>
  </main>
</template>
