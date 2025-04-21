<script setup lang="ts">
import { ref, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BookmarkCard from '@/components/BookmarkCard.vue';
import type { IBookmark } from '~/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Query } from "appwrite";
import { useClassificationStore } from "~/stores/classifications";

// --- Load Pinia Store ---
const classificationStore = useClassificationStore()

onBeforeMount(() => {
  classificationStore.loadClassifications()
});


// Filter/State Management (remains the same)
const selectedL1Id = useState<string | null>('selectedL1Id', () => null);
const selectedL2Id = useState<string | null>('selectedL2Id', () => null);
const searchQuery = ref('');
const showFavoritesOnly = ref(false);

// --- Runtime Config ---
const config = useRuntimeConfig();

// --- Appwrite Config --- (Ensure these are correct)
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId;

// --- Fetch Bookmarks using useAsyncData ---
const { $appwrite } = useNuxtApp();
const { data: bookmarks, pending, error: fetchError, refresh } = useAsyncData<IBookmark[]>(
    'bookmarks-list', // Unique key for the fetch
    async () => {
      console.log('Fetching bookmarks from Appwrite...');
      try {
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_BOOKMARKS,
            [
              Query.equal('status', 'verified')
            ]
        );

        return response.documents.map(doc => ({
          id: doc.$id,
          title: doc.title,
          description: doc.description,
          url: doc.url,
          imageUrl: doc.imageUrl, // Optional field
          level1Id: doc.level1Id || null,
          level2Id: doc.level2Id || null,
          level3Id: doc.level3Ids || [],
          // Ensure classificationIds is handled if you transition fully
          // classificationIds: doc.classificationIds || [],
          isFavorite: doc.isFavorite ?? false, // Default if null/undefined
          createdAt: doc.$createdAt,
        } as IBookmark));
      } catch (err: unknown) {
        console.error('Error fetching bookmarks:', err);
        // Handle error appropriately, maybe return [] or throw
        return []; // Return empty array on error for now
      }
    }, {
      // Optional: Default value while loading
      default: () => [] as IBookmark[],
    }
);

// Function to handle toggling favorite status (remains the same)
async function handleToggleFavorite(bookmarkId: number | string) {
  const bookmark = bookmarks.value?.find(b => b.id === bookmarkId);
  if (!bookmark) return;

  const originalFavoriteStatus = bookmark.isFavorite;
  const newFavoriteStatus = !bookmark.isFavorite;

  bookmark.isFavorite = newFavoriteStatus;
  console.log(`Optimistically toggled favorite for ${ bookmarkId } to ${ newFavoriteStatus }`);

  try {
    console.log(`Attempting to update bookmark ${ bookmarkId } favorite status to ${ newFavoriteStatus } in Appwrite...`);
    await $appwrite.databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        bookmarkId as string,
        { isFavorite: newFavoriteStatus }
    );
    console.log(`Successfully updated favorite status for ${ bookmarkId }`);

  } catch (err: unknown) {
    console.error(`Error updating favorite status for ${ bookmarkId }:`, err);
    bookmark.isFavorite = originalFavoriteStatus;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    alert(`Error updating favorite: ${ errorMessage }`);
  }
}


// --- Filtering Logic ---
const filteredBookmarks = computed<IBookmark[]>(() => {
  if (!bookmarks.value) {
    return [];
  }

  let items = bookmarks.value;
  const lowerSearch = searchQuery.value?.toLowerCase() || '';

  if (showFavoritesOnly.value) {
    items = items.filter(bookmark => bookmark.isFavorite);
  }

  // Update filtering to use potentially new classificationIds if applicable
  if (selectedL1Id.value) {
    items = items.filter(bookmark =>
        // Check if you have a combined `classificationIds` field
        // (bookmark.classificationIds && bookmark.classificationIds.includes(selectedL1Id.value!)) ||
        bookmark.level1Id === selectedL1Id.value
    );
  }

  if (selectedL2Id.value) {
    items = items.filter(bookmark =>
        // (bookmark.classificationIds && bookmark.classificationIds.includes(selectedL2Id.value!)) ||
        bookmark.level2Id === selectedL2Id.value
    );
  }

  if (lowerSearch) {
    items = items.filter(bookmark => {
      // Use the store's method to get classification names
      const tagNames = classificationStore.getClassificationNames([
        ...(bookmark.level1Id ? [ bookmark.level1Id ] : []),
        ...(bookmark.level2Id ? [ bookmark.level2Id ] : []),
        ...(bookmark.level3Id || [])
        // ...(bookmark.classificationIds || []) // Include if using combined field
      ]);

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
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Bookmark Garden</h1>
        <p class="text-muted-foreground">Organize and access your favorite websites</p>
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
            v-model="searchQuery"
            type="search"
            placeholder="Search bookmarks..."
            class="w-full pl-9"
        />
      </div>
      <!-- Add Favorite filter toggle if needed -->
      <Button variant="outline" @click="showFavoritesOnly = !showFavoritesOnly">
        <Icon :name="showFavoritesOnly ? 'lucide:star' : 'lucide:star-off'" class="mr-2 h-4 w-4"/>
        {{ showFavoritesOnly ? 'All' : 'Favorites' }}
      </Button>
    </div>

    <!-- Skeleton Loading State -->
    <div v-if="pending || classificationStore.isLoading"
         class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
          :classification-names="classificationStore.getClassificationNames([ // Use store method
                   ...(bookmark.level1Id? [ bookmark.level1Id ] : []),
                 ...(bookmark.level2Id? [ bookmark.level2Id ] : []),
                  ...(bookmark.level3Id || [])
                 // ...(bookmark.classificationIds || []) // Use if applicable
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
