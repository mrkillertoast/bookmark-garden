<script setup lang="ts">
import { useAuth } from '~/composables/useAuth';
import { Button } from '~/components/ui/button';
// You might want admin-specific navigation items here

const { logout, currentUser } = useAuth();

async function handleLogout() {
  await logout(); // Assumes logout redirects to /login
}
</script>

<template>
  <div class="flex flex-col min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div class="container mx-auto h-14 flex items-center justify-between px-4">
        <NuxtLink to="/admin" class="font-bold">
          Bookmark Admin
        </NuxtLink>
        <nav class="flex items-center gap-4">
          <NuxtLink to="/admin/create" class="text-sm hover:underline">Create</NuxtLink>
          <NuxtLink to="/admin/verify" class="text-sm hover:underline">Verify</NuxtLink> <NuxtLink to="/public" class="text-sm hover:underline" target="_blank">View Site</NuxtLink>
        </nav>
        <div v-if="currentUser" class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground hidden sm:inline">Welcome, {{ currentUser.name }}</span>
          <Button variant="outline" size="sm" @click="handleLogout">Logout</Button>
        </div>
      </div>
    </header>
    <main class="flex-1 container mx-auto p-4 md:p-6">
      <slot /> </main>
    <footer class="border-t py-2">
      <p class="text-center text-xs text-muted-foreground">Admin Panel</p>
    </footer>
  </div>
</template>