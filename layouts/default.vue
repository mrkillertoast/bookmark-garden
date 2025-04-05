<script setup lang="ts">
import { ref } from 'vue';
// Import the hierarchy data and helper functions
import { classificationHierarchy } from '~/utils/classificationHierarchy'; // Adjust path if needed
import { Button } from '@/components/ui/button'; // Use Button for interaction

const selectedL1Id = ref<string | null>(null); // Track selected L1 category ID
// State for selected L2 would likely live on the page or be shared via provide/inject or Pinia for filtering

// Function to handle L1 click
function selectL1(categoryId: string) {
  // Toggle selection: if clicked again, deselect; otherwise, select
  selectedL1Id.value = selectedL1Id.value === categoryId ? null : categoryId;
  // TODO: Emit event or update shared state to trigger filtering on the page
  console.log("Selected L1:", selectedL1Id.value);
}

// Function to handle L2 click (basic example)
function selectL2(subCategoryId: string) {
  // TODO: Emit event or update shared state to trigger filtering on the page
  console.log("Selected L2:", subCategoryId);
}
</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <aside class="w-64 border-r border-border p-4 hidden md:block overflow-y-auto">
      <h2 class="text-lg font-semibold mb-4 px-3">Categories</h2>
      <nav class="space-y-1">
        <div v-for="l1Category in classificationHierarchy" :key="l1Category.id">
          <Button
              variant="ghost"
              class="w-full justify-start px-3 py-2"
              :class="{ 'bg-accent text-accent-foreground': selectedL1Id === l1Category.id }"
              @click="selectL1(l1Category.id)"
          >
            {{ l1Category.name }}
            <Icon
                name="lucide:chevron-right"
                class="ml-auto h-4 w-4 transition-transform"
                :class="{ 'rotate-90': selectedL1Id === l1Category.id }"
            />
          </Button>

          <div
              v-if="selectedL1Id === l1Category.id && l1Category.subCategories.length > 0"
              class="ml-4 mt-1 space-y-1 border-l border-border pl-4"
          >
            <Button
                v-for="l2Category in l1Category.subCategories"
                :key="l2Category.id"
                variant="ghost"
                size="sm"
                class="w-full justify-start px-3 py-1.5 text-muted-foreground hover:text-foreground"
                @click="selectL2(l2Category.id)"

            >
              {{ l2Category.name }}
            </Button>
          </div>
        </div>
      </nav>
    </aside>

    <main class="flex-1 overflow-y-auto p-6">
      <slot/>
    </main>
  </div>
</template>

<style scoped>
</style>