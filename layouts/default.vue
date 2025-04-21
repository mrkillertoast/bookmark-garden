<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useClassificationStore } from '~/stores/classifications';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// --- Global State ---
const { fetchCurrentUser, isLoggedIn, currentUser, logout } = useAuth();
// Get the store instance
const classificationStore = useClassificationStore();

// --- Filter state --- (remains the same, managed by useState)
const selectedL1Id = useState<string | null>('selectedL1Id', () => null);
const selectedL2Id = useState<string | null>('selectedL2Id', () => null);

// --- Fetch Classifications (Managed by the store now) ---
// We can trigger the load here if needed, but the store attempts to auto-load on client mount
onMounted(() => {
  fetchCurrentUser();
  // Ensure classifications are loaded (store handles preventing multiple loads)
  classificationStore.loadClassifications();
  expandedL1Id.value = selectedL1Id.value; // Sync expansion state on mount
});

// --- Sidebar Local State & Computeds ---
const expandedL1Id = ref<string | null>(null); // Local visual expansion state

// Get Level 1 categories from the store's classifications map
const level1Items = computed(() => {
  if (!classificationStore.hasLoaded) return [];
  return [ ...classificationStore.classifications.values() ]
      .filter(c => c.level === 1)
      .sort((a, b) => a.name.localeCompare(b.name));
});

// Get Level 2 subcategories for the EXPANDED L1 item using the store
const level2Items = computed(() => {
  if (!expandedL1Id.value || !classificationStore.hasLoaded) return [];
  const parentId = expandedL1Id.value;
  return [ ...classificationStore.classifications.values() ]
      .filter(c => c.level === 2 && c.parentIds?.includes(parentId))
      .sort((a, b) => a.name.localeCompare(b.name));
});

// --- Handlers ---
watch(selectedL1Id, (newVal) => {
  expandedL1Id.value = newVal; // Keep expansion synced with filter selection
  if (selectedL2Id.value !== null) {
    selectedL2Id.value = null; // Reset L2 filter if L1 changes
  }
});

function selectL1(categoryId: string) {
  selectedL1Id.value = selectedL1Id.value === categoryId ? null : categoryId; // Update GLOBAL filter state
}

function selectL2(subCategoryId: string) {
  if (selectedL1Id.value !== null) { // Should only select L2 if L1 is active
    selectedL2Id.value = selectedL2Id.value === subCategoryId ? null : subCategoryId; // Update GLOBAL filter state
  }
}

function clearClassificationFilters() {
  selectedL1Id.value = null;
  selectedL2Id.value = null;
}

async function handleLogout() {
  await logout();
}

// --- Derived Loading/Error States ---
const classificationsLoading = computed(() => classificationStore.isLoading);
// Simple error check: if not loading anymore but still haven't loaded successfully
const classificationsError = computed(() => !classificationStore.isLoading && !classificationStore.hasLoaded);

</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <aside class="w-64 border-r border-border flex flex-col md:block">
      <div class="p-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Categories</h2>
      </div>

      <div class="flex-grow overflow-y-auto px-4">
        <!-- Use store's loading state -->
        <div v-if="classificationsLoading" class="space-y-2 py-2">
          <Skeleton v-for="n in 5" :key="n" class="h-8 w-full"/>
        </div>
        <!-- Use derived error state -->
        <div v-else-if="classificationsError" class="text-destructive p-2">
          Error loading categories.
        </div>
        <!-- Use store data for rendering -->
        <nav v-else class="space-y-1">
          <Button
              variant="ghost"
              class="w-full justify-start"
              :class="{ 'bg-accent text-accent-foreground': selectedL1Id === null && selectedL2Id === null }"
              @click="clearClassificationFilters()"
          >
            All Categories
          </Button>
          <div v-for="l1Category in level1Items" :key="l1Category.$id">
            <Button
                variant="ghost"
                class="w-full justify-start"
                :class="{ 'bg-accent text-accent-foreground': selectedL1Id === l1Category.$id }"
                @click="selectL1(l1Category.$id)"
            >
              {{ l1Category.name }}
              <Icon
                  name="lucide:chevron-right"
                  class="ml-auto h-4 w-4 transition-transform"
                  :class="{ 'rotate-90': expandedL1Id === l1Category.$id }"
              />
            </Button>
            <!-- Use computed level2Items derived from store -->
            <div
                v-if="expandedL1Id === l1Category.$id && level2Items.length > 0"
                class="ml-4 mt-1 space-y-1 border-l border-border pl-4"
            >
              <Button
                  v-for="l2Category in level2Items"
                  :key="l2Category.$id"
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start py-1.5 text-muted-foreground hover:text-foreground"
                  @click="selectL2(l2Category.$id)"
                  :class="{ 'bg-accent text-accent-foreground': selectedL2Id === l2Category.$id }"
              >
                {{ l2Category.name }}
              </Button>
            </div>
          </div>
        </nav>
      </div>

      <!-- Footer remains the same -->
      <div class="p-4 mt-auto pt-4 border-t border-border flex-shrink-0">
        <!-- ... login/logout section ... -->
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