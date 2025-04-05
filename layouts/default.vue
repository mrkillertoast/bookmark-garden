<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'; // Import watch
import { classificationHierarchy } from '~/utils/classificationHierarchy';
import { Button } from '@/components/ui/button';
import { useSelectedL1Id, useSelectedL2Id } from "~/composables/useFilters";
import { useAuth } from '~/composables/useAuth';

const { isLoggedIn, currentUser, logout } = useAuth();

// Filter state
const selectedL1Id = useSelectedL1Id()
const selectedL2Id = useSelectedL2Id()
const expandedL1Id = ref<string | null>(null); // Local state for expansion

onMounted(() => {
  //fetchCurrentUser();
  expandedL1Id.value = selectedL1Id.value;
});

async function handleLogout() {
  await logout();
}

watch(selectedL1Id, (newVal) => {
  expandedL1Id.value = newVal;
  if (selectedL2Id.value !== null) {
    selectedL2Id.value = null;
  }
});

function selectL1(categoryId: string) {
  selectedL1Id.value = selectedL1Id.value === categoryId ? null : categoryId;
}

function selectL2(subCategoryId: string) {
  if (selectedL1Id.value !== null) {
    selectedL2Id.value = selectedL2Id.value === subCategoryId ? null : subCategoryId;
  }
}

function clearClassificationFilters() {
  selectedL1Id.value = null;
  selectedL2Id.value = null;
  console.log("Cleared classification filters");
}

</script>

<
<template>
  <div class="flex h-screen bg-background text-foreground">
    <aside class="w-64 border-r border-border flex flex-col md:block">
      <div class="p-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Categories</h2>
      </div>

      <div class="flex-grow overflow-y-auto px-4">
        <nav class="space-y-1">
          <Button
              variant="ghost"
              class="w-full justify-start"
              :class="{ 'bg-accent text-accent-foreground': selectedL1Id === null }"
              @click="clearClassificationFilters()"
          >
            All Categories
          </Button>
          <div v-for="l1Category in classificationHierarchy" :key="l1Category.id">
            <Button
                variant="ghost"
                class="w-full justify-start"
                :class="{ 'bg-accent text-accent-foreground': expandedL1Id === l1Category.id }"
                @click="selectL1(l1Category.id)"
            >
              {{ l1Category.name }}
              <Icon
                  name="lucide:chevron-right"
                  class="ml-auto h-4 w-4 transition-transform"
                  :class="{ 'rotate-90': expandedL1Id === l1Category.id }"
              />
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
                  class="w-full justify-start py-1.5 text-muted-foreground hover:text-foreground"
                  @click="selectL2(l2Category.id)"
                  :class="{ 'bg-accent text-accent-foreground': selectedL2Id === l2Category.id }"
              >
                {{ l2Category.name }}
              </Button>
            </div>
          </div>
        </nav>
      </div>

      <div class="p-4 mt-auto pt-4 border-t border-border flex-shrink-0">
        <div v-if="isLoggedIn()">
          <p class="text-sm text-muted-foreground mb-2 truncate">Logged in as {{ currentUser?.name }}</p>
          <Button variant="outline" class="w-full justify-start" @click="handleLogout">
            <Icon name="lucide:log-out" class="mr-2 h-4 w-4"/>
            Logout
          </Button>
        </div>
        <div v-else>
          <NuxtLink to="/login">
            <Button variant="outline" class="w-full justify-start">
              <Icon name="lucide:log-in" class="mr-2 h-4 w-4"/>
              Admin Login
            </Button>
          </NuxtLink>
        </div>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto p-6">
      <slot/>
    </main>
  </div>
</template>