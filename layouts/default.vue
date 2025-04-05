<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import type { IClassification } from '~/types';
import { getLevel1Categories, getSubCategories } from '~/utils/classificationHelper';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Query } from "appwrite";

// --- Runtime Config ---
const config = useRuntimeConfig();

// --- Appwrite Config ---
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId;

// --- Global State ---
const { fetchCurrentUser, isLoggedIn, currentUser, logout } = useAuth();
const { $appwrite } = useNuxtApp();
// Filter state (remains the same, managed by useState)
const selectedL1Id = useState<string | null>('selectedL1Id', () => null);
const selectedL2Id = useState<string | null>('selectedL2Id', () => null);
// Global state for preloaded classifications
const classifications = useState<IClassification[] | null>('classifications', () => null);

// --- Fetch Classifications ---
const { pending: classificationsPending, error: classificationsError, refresh } = useAsyncData(
    'fetch-classifications',
    async () => {
      try {
        // Fetch ALL classifications - Appwrite default limit is 25, increase if needed
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_CLASSIFICATIONS,
            [
              Query.limit(1000)
            ]
        );
        // Store in the useState ref
        classifications.value = response.documents as unknown as IClassification[];
      } catch (err) {
        console.error("Error fetching classifications:", err);
        classifications.value = []; // Set empty on error
        return [];
      }
    }, { server: true } // Fetch on server if possible
);

// --- Sidebar Local State & Computeds ---
const expandedL1Id = ref<string | null>(null); // Local visual expansion state

// Computed property to get Level 1 categories from loaded state
const level1Items = computed(() => getLevel1Categories(classifications).sort((a, b) => a.name.localeCompare(b.name)));

// Computed property to get Level 2 subcategories for the EXPANDED L1 item
const level2Items = computed(() => {
  if (!expandedL1Id.value) return [];
  return getSubCategories(classifications, expandedL1Id.value).sort((a, b) => a.name.localeCompare(b.name));
});


// --- Handlers ---
onMounted(() => {
  fetchCurrentUser();
  expandedL1Id.value = selectedL1Id.value; // Sync expansion state on mount
});

watch(selectedL1Id, (newVal) => {
  expandedL1Id.value = newVal; // Keep expansion synced with filter selection
  if (selectedL2Id.value !== null) {
    selectedL2Id.value = null; // Reset L2 filter if L1 changes
  }
});

function selectL1(categoryId: string) {
  selectedL1Id.value = selectedL1Id.value === categoryId ? null : categoryId; // Update GLOBAL filter state
  // L2 filter is reset by the watcher
  console.log("Updated shared L1 filter:", selectedL1Id.value);
}

function selectL2(subCategoryId: string) {
  if (selectedL1Id.value !== null) { // Should only select L2 if L1 is active
    selectedL2Id.value = selectedL2Id.value === subCategoryId ? null : subCategoryId; // Update GLOBAL filter state
    console.log("Updated shared L2 filter:", selectedL2Id.value);
  }
}

function clearClassificationFilters() {
  selectedL1Id.value = null;
  selectedL2Id.value = null;
  console.log("Cleared classification filters");
}

async function handleLogout() {
  await logout();
}

</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <aside class="w-64 border-r border-border flex flex-col md:block">
      <div class="p-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Categories</h2>
      </div>

      <div class="flex-grow overflow-y-auto px-4">
        <div v-if="classificationsPending" class="space-y-2 py-2">
          <Skeleton v-for="n in 5" :key="n" class="h-8 w-full"/>
        </div>
        <div v-else-if="classificationsError" class="text-destructive p-2">
          Error loading categories.
        </div>
        <nav v-else class="space-y-1">
          <Button
              variant="ghost"
              class="w-full justify-start"
              :class="{ 'bg-accent text-accent-foreground': selectedL1Id === null }"
              @click="clearClassificationFilters()"
          >
            All Categories
          </Button>
          <div v-for="l1Category in level1Items" :key="l1Category.$id">
            <Button
                variant="ghost"
                class="w-full justify-start"
                :class="{ 'bg-accent text-accent-foreground': expandedL1Id === l1Category.$id }"
                @click="selectL1(l1Category.$id)"
            >
              {{ l1Category.name }}
              <Icon
                  name="lucide:chevron-right"
                  class="ml-auto h-4 w-4 transition-transform"
                  :class="{ 'rotate-90': expandedL1Id === l1Category.$id }"
              />
            </Button>
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