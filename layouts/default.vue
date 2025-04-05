<script setup lang="ts">

</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <aside class="w-64 border-r border-border p-4 hidden md:block">
      <h2 class="text-lg font-semibold mb-4">Categories</h2>
      <nav class="space-y-1">
        <NuxtLink to="#" class="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground">Development</NuxtLink>
        <NuxtLink to="#" class="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground">Design</NuxtLink>
        <NuxtLink to="#" class="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground">Productivity</NuxtLink>
        <NuxtLink to="#" class="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground">Learning</NuxtLink>
        <NuxtLink to="#" class="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground">Entertainment</NuxtLink>
      </nav>
    </aside>

    <main class="flex-1 overflow-y-auto p-6">
      <slot />
    </main>
  </div>
</template>

<style scoped>

</style>