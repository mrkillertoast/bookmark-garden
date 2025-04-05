<script setup lang="ts">
import { ref, watch } from 'vue'; // Import watch
import { classificationHierarchy } from '~/utils/classificationHierarchy';
import { Button } from '@/components/ui/button';
import { useSelectedL1Id, useSelectedL2Id } from "~/composable/useFilters";

// Use useState for shared filter state
const selectedL1Id = useSelectedL1Id()
const selectedL2Id = useSelectedL2Id()

// Local state for sidebar expansion visual state (can be derived or separate)
const expandedL1Id = ref<string | null>(null);

watch(selectedL1Id, (newVal) => {
  // Keep expanded state in sync OR sync page filter state with expanded state
  expandedL1Id.value = newVal;
  // If L1 is deselected/changed, always reset L2
  if (selectedL2Id.value !== null) {
    selectedL2Id.value = null;
  }
});

function selectL1(categoryId: string) {
  // Update shared state for filtering
  selectedL1Id.value = selectedL1Id.value === categoryId ? null : categoryId;
  // L2 is automatically reset by the watcher now
  console.log("Updated shared L1 filter:", selectedL1Id.value);
}

function selectL2(subCategoryId: string) {
  // Set L2 only if an L1 is selected
  if (selectedL1Id.value !== null) {
    // Toggle L2 selection? Or just select? Let's just select for now.
    selectedL2Id.value = selectedL2Id.value === subCategoryId ? null : subCategoryId;
    console.log("Updated shared L2 filter:", selectedL2Id.value);
  }
}

// Add a function to clear filters (e.g., if an "All" button is added)
function clearClassificationFilters() {
  selectedL1Id.value = null;
  selectedL2Id.value = null;
  console.log("Cleared classification filters");
}

</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <aside class="w-64 border-r border-border p-4 hidden md:block overflow-y-auto">
      <h2 class="text-lg font-semibold mb-4 px-3">Categories</h2>
      <nav class="space-y-1">
        <Button
            variant="ghost"
            class="w-full justify-start px-3 py-2"
            :class="{ 'bg-accent text-accent-foreground': selectedL1Id === null }"
            @click="clearClassificationFilters()"
        >
          All Categories
        </Button>

        <div v-for="l1Category in classificationHierarchy" :key="l1Category.id">
          <Button
              variant="ghost"
              class="w-full justify-start px-3 py-2"
              :class="{ 'bg-accent text-accent-foreground': expandedL1Id === l1Category.id }"
              @click="selectL1(l1Category.id)"
          >
            {{ l1Category.name }}
            <Icon
                name="lucide:chevron-right"
                class="ml-auto h-4 w-4 transition-transform"
                :class="{ 'rotate-90': expandedL1Id === l1Category.id }"/>
          </Button>
          <div
              v-if="expandedL1Id === l1Category.id && l1Category.subCategories.length > 0"
              class="ml-4 mt-1 space-y-1 border-l border-border pl-4"
          >
            <Button
                v-for="l2Category in l1Category.subCategories"
                :key="l2Category.id"
                variant="ghost"
                size="sm"
                class="w-full justify-start px-3 py-1.5 text-muted-foreground hover:text-foreground"
                @click="selectL2(l2Category.id)"
                :class="{ 'bg-accent text-accent-foreground': selectedL2Id === l2Category.id }">
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