<script setup lang="ts">
import { ref, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BookmarkCard from '@/components/BookmarkCard.vue';
import type { IBookmark } from '~/types';
import { getClassificationNames } from '~/utils/classificationHierarchy';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading state

// Filter/State Management (remains the same)
const selectedL1Id = useState<string | null>('selectedL1Id', () => null);
const selectedL2Id = useState<string | null>('selectedL2Id', () => null);
const searchQuery = ref('');
const showFavoritesOnly = ref(false);

// --- Runtime Config ---
const config = useRuntimeConfig();

// --- Appwrite Config --- (Ensure these are correct)
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteCollectionId;

// --- Fetch Bookmarks using useAsyncData ---
const { $appwrite } = useNuxtApp();
const { data: bookmarks, pending, error: fetchError, refresh } = useAsyncData<IBookmark[]>(
    'bookmarks-list', // Unique key for the fetch
    async () => {
      console.log('Fetching bookmarks from Appwrite...');
      try {
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_BOOKMARKS
            // Add queries later if needed, e.g., [Query.orderDesc('$createdAt')]
        );
        console.log('Appwrite response:', response);
        // Map Appwrite documents to our IBookmark interface
        return response.documents.map(doc => ({
          id: doc.$id,
          title: doc.title,
          description: doc.description,
          url: doc.url,
          imageUrl: doc.imageUrl, // Optional field
          classificationIds: doc.classificationIds || [], // Ensure it's an array
          isFavorite: doc.isFavorite ?? false, // Default if null/undefined
          // Use Appwrite's metadata for dates if you didn't create specific attributes
          createdAt: doc.$createdAt,
          // Add other fields as needed
        } as IBookmark));
      } catch (err) {
        console.error('Error fetching bookmarks:', err);
        // Handle error appropriately, maybe return [] or throw
        return []; // Return empty array on error for now
      }
    }, {
      // Optional: Default value while loading
      default: () => [] as IBookmark[],
      // Optional: Pick only needed parts, or use transform
      // transform: (data) => data.map(...) // Alternative mapping location
      // Optional: Watch reactive sources to auto-refresh
      // watch: [searchQuery, selectedL1Id, ...] // BE CAREFUL: client-side filtering might be better
    }
);


// --- Toggle Favorite Handler (Updates Local State + Placeholder for Backend) ---
async function handleToggleFavorite(bookmarkId: number | string) {
  // Find in the current reactive data ref
  const bookmark = bookmarks.value?.find(b => b.id === bookmarkId);
  if (bookmark) {
    const newFavoriteStatus = !bookmark.isFavorite;
    bookmark.isFavorite = newFavoriteStatus; // Optimistic UI update
    console.log(`Optimistically toggled favorite for ${ bookmarkId } to ${ newFavoriteStatus }`);

    try {
      // TODO: Persist change to Appwrite
      console.log(`TODO: Update bookmark ${ bookmarkId } favorite status to ${ newFavoriteStatus } in Appwrite`);
      // Example (implement this later):
      // await $appwrite.databases.updateDocument(
      //     DATABASE_ID,
      //     COLLECTION_ID_BOOKMARKS,
      //     bookmarkId as string, // Ensure ID is string
      //     { isFavorite: newFavoriteStatus }
      // );
      // console.log(`Successfully updated favorite status for ${bookmarkId}`);
      // Optional: Call refresh() if you want to re-fetch all data after update,
      // but optimistic update is usually better UX.
    } catch (err) {
      console.error(`Error updating favorite status for ${ bookmarkId }:`, err);
      // Revert optimistic update on error
      bookmark.isFavorite = !newFavoriteStatus;
      // Show error message to user
    }
  }
}


// --- Filtering Logic (Now operates on the reactive 'bookmarks' data from useAsyncData) ---
const filteredBookmarks = computed<IBookmark[]>(() => {
  // If data is not yet loaded or empty, return empty array
  if (!bookmarks.value) {
    return [];
  }

  let items = bookmarks.value; // Use the fetched data
  const lowerSearch = searchQuery.value?.toLowerCase() || '';

  // Apply filters... (rest of the filtering logic remains the same)
  // 1. Filter by Favorites
  if (showFavoritesOnly.value) {
    items = items.filter(bookmark => bookmark.isFavorite);
  }
  // 2. Filter by Selected L1 Category
  if (selectedL1Id.value) {
    items = items.filter(bookmark => bookmark.classificationIds.includes(selectedL1Id.value!));
  }
  // 3. Filter by Selected L2 Category
  if (selectedL2Id.value) {
    items = items.filter(bookmark => bookmark.classificationIds.includes(selectedL2Id.value!));
  }
  // 4. Filter by Search Query
  if (lowerSearch) {
    items = items.filter(bookmark => {
      const tagNames = getClassificationNames(bookmark.classificationIds);
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
    </div>

    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <div v-for="n in 6" :key="n" class="space-y-3">
        <Skeleton class="h-[125px] w-full rounded-lg"/>
        <div class="space-y-2">
          <Skeleton class="h-4 w-[200px]"/>
          <Skeleton class="h-4 w-[150px]"/>
        </div>
        <Skeleton class="h-8 w-[80px] rounded-md"/>
      </div>
    </div>

    <div v-else-if="fetchError" class="text-center text-destructive py-10">
      <p>Error loading bookmarks:</p>
      <p class="text-sm">{{ fetchError.message }}</p>
      <Button variant="outline" size="sm" @click="refresh()" class="mt-4">Retry</Button>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <BookmarkCard
          v-for="bookmark in filteredBookmarks"
          :key="bookmark.id"
          :id="bookmark.id"
          :image-url="bookmark.imageUrl"
          :classification-names="getClassificationNames(bookmark.classificationIds)"
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

<style scoped>
/* Page-specific styles if needed */
</style>