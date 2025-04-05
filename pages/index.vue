<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

definePageMeta({
  layout: 'default'
})

const activeTab = ref('all')
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Bookmark Garden
        </h1>
        <p class="text-muted-foreground">
          Organize and access your favorite websites
        </p>
      </div>
      <div>
        <Button>
          <Icon name="lucide:plus" class="mr-2 h-4 w-4"/>
          Add Bookmark
        </Button>
      </div>
    </div>

    <div class="flex justify-between items-center mb-6 gap-4">
      <div class="relative flex-grow max-w-xs">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input
            type="search"
            placeholder="Search bookmarks..."
            class="w-full pl-9"/>
      </div>

      <div class="flex items-center gap-2">
        <Tabs v-model="activeTab" default-value="all">
          <TabsList>
            <TabsTrigger value="all">
              All Bookmarks
            </TabsTrigger>
            <TabsTrigger value="recent">
              Recently Added
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="icon">
          <Icon name="lucide:list-filter" class="h-4 w-4"/>
        </Button>
      </div>
    </div>

    <div>
      <p class="text-sm text-gray-500">Bookmark Grid placeholder</p>
      <p class="text-sm text-gray-500 mt-2">Selected Tab: {{ activeTab }}</p>
    </div>

  </div>
</template>

<style scoped>
/* Page-specific styles if needed */
</style>