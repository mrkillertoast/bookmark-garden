<script setup lang="ts">
import { ref, computed, onBeforeMount } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BookmarkCard from '@/components/BookmarkCard.vue';
// Make sure IBookmark includes level2Ids and level3Ids
import type { IBookmark } from '~/types';
import { useClassificationStore } from '~/stores/classifications';
import { Skeleton } from '@/components/ui/skeleton';
import { Query } from "appwrite";

const classificationStore = useClassificationStore();

onBeforeMount(() => {
  classificationStore.fetchClassifications();
});

const selectedL1Id = useState<string | null>('selectedL1Id', () => null);
const selectedL2Id = useState<string | null>('selectedL2Id', () => null);
const searchQuery = ref('');
const showFavoritesOnly = ref(false);

const config = useRuntimeConfig();
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId;

const { $appwrite } = useNuxtApp();
const { data: bookmarks, pending, error: fetchError, refresh } = useAsyncData<IBookmark[]>(
    'bookmarks-list',
    async () => {
      console.log('Fetching bookmarks from Appwrite...');
      try {
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_BOOKMARKS,
            [ Query.equal('status', 'verified'), Query.limit(5000) ] // Add limit
        );

        return response.documents.map(doc => ({
          id: doc.$id,
          title: doc.title,
          description: doc.description,
          url: doc.url,
          imageUrl: doc.imageUrl,
          level1Id: doc.level1Id || null,
          level2Ids: doc.level2Ids || [], // Map the new array field
          level3Ids: doc.level3Ids || doc.level3Id || [], // Handle potential old/new field name
          isFavorite: doc.isFavorite ?? false,
          createdAt: doc.$createdAt,
        } as IBookmark));
      } catch (err: unknown) {
        console.error('Error fetching bookmarks:', err);
        return [];
      }
    }, {
      default: () => [] as IBookmark[],
    }
);

// handleToggleFavorite function remains the same

// --- Filtering Logic ---
const filteredBookmarks = computed<IBookmark[]>(() => {
  if (!bookmarks.value || !classificationStore.hasLoaded) { // Ensure classifications are loaded
    return [];
  }

  let items = bookmarks.value;
  const lowerSearch = searchQuery.value?.toLowerCase() || '';

  // 1. Filter by Favorites
  if (showFavoritesOnly.value) {
    items = items.filter(bookmark => bookmark.isFavorite);
  }

  // 2. Filter by Selected L1 Category
  if (selectedL1Id.value) {
    const l1FilterId = selectedL1Id.value;
    items = items.filter(bookmark => {
        // Direct L1 match
        if (bookmark.level1Id === l1FilterId) return true;

        // Check if any L2 tag is a direct child of the selected L1
        if (bookmark.level2Ids?.some(l2Id => classificationStore.getParents(l2Id).some(parent => parent.$id === l1FilterId))) {
            return true;
        }

        // Check if any L3 tag descends from the selected L1 (more complex)
        if (bookmark.level3Ids?.some(l3Id => classificationStore.isDescendantOf(l3Id, l1FilterId))) {
            return true;
        }

        return false; // No match found
    });
  }

  // 3. Filter by Selected L2 Category
  if (selectedL2Id.value) {
    const l2FilterId = selectedL2Id.value;
    items = items.filter(bookmark =>
        // Check if the bookmark includes the selected L2 ID
        bookmark.level2Ids?.includes(l2FilterId) ||
        // Optional: Check if any L3 tag is a child of the selected L2
        bookmark.level3Ids?.some(l3Id => classificationStore.getParents(l3Id).some(parent => parent.$id === l2FilterId))
    );
  }

  // 4. Filter by Search Query
  if (lowerSearch) {
    items = items.filter(bookmark => {
      // Combine all relevant IDs for name lookup
      const allIds = [
        ...(bookmark.level1Id ? [bookmark.level1Id] : []),
        ...(bookmark.level2Ids || []),
        ...(bookmark.level3Ids || [])
      ];
      const tagNames = classificationStore.getClassificationNames(allIds);

      return bookmark.title.toLowerCase().includes(lowerSearch) ||
          bookmark.description.toLowerCase().includes(lowerSearch) ||
          tagNames.some(name => name.toLowerCase().includes(lowerSearch));
    });
  }

  return items;
});
</script>

<template>
  <div>
    <!-- Header/Search/Filters section remains mostly the same -->
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold tracking-tight">Bookmark Garden</h1>
            <p class="text-muted-foreground">Organize and access your favorite websites</p>
        </div>
        <div>
            <Button>
                <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
                Add Bookmark
            </Button>
        </div>
    </div>

    <div class="flex justify-between items-center mb-6 gap-4">
        <div class="relative flex-grow max-w-xs">
            <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                v-model="searchQuery"
                type="search"
                placeholder="Search bookmarks..."
                class="w-full pl-9"
            />
        </div>
        <Button variant="outline" @click="showFavoritesOnly = !showFavoritesOnly">
            <Icon :name="showFavoritesOnly ? 'lucide:star' : 'lucide:star-off'" class="mr-2 h-4 w-4" />
            {{ showFavoritesOnly ? 'All' : 'Favorites' }}
        </Button>
        <!-- Add L1/L2 Filter Dropdowns/Selectors here -->
        <!-- Example placeholder for L1 filter dropdown -->
        <!-- <Select v-model="selectedL1Id"> ... </Select> -->
        <!-- Example placeholder for L2 filter dropdown -->
        <!-- <Select v-model="selectedL2Id"> ... </Select> -->
    </div>


    <!-- Loading State -->
    <div v-if="pending || classificationStore.isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
       <div v-for="n in 6" :key="`skel-${n}`" class="space-y-3">
        <Skeleton class="h-[125px] w-full rounded-lg"/>
        <div class="space-y-2">
          <Skeleton class="h-4 w-[200px]"/>
          <Skeleton class="h-4 w-[150px]"/>
        </div>
        <Skeleton class="h-8 w-[80px] rounded-md"/>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="text-center text-destructive py-10">
      <p>Error loading bookmarks:</p>
      <p class="text-sm">{{ fetchError.message }}</p>
      <Button variant="outline" size="sm" @click="refresh()" class="mt-4">Retry</Button>
    </div>

    <!-- Content Display -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <BookmarkCard
          v-for="bookmark in filteredBookmarks"
          :key="bookmark.id"
          :id="bookmark.id"
          :image-url="bookmark.imageUrl"
          :classification-names="classificationStore.getClassificationNames([ // Combine all IDs
                   ...(bookmark.level1Id? [ bookmark.level1Id ] : []),
                   ...(bookmark.level2Ids || []),
                   ...(bookmark.level3Ids || [])
                ])"
          :title="bookmark.title"
          :description="bookmark.description"
          :url="bookmark.url"
          :is-favorite="bookmark.isFavorite ?? false"
          @toggle-favorite="handleToggleFavorite"
      />
      <p v-if="filteredBookmarks.length === 0" class="col-span-full text-center text-muted-foreground py-10">
        No bookmarks found matching your criteria.
      </p>
    </div>
  </div>
</template>