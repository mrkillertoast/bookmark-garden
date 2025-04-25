<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { Query, AppwriteException } from 'appwrite';
import { Button } from '@/components/ui/button'; // Assuming shadcn-vue setup
import { Input } from '@/components/ui/input';   // Assuming shadcn-vue setup
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Assuming shadcn-vue setup

// --- Page Meta ---
// Add appropriate middleware if you have admin-specific auth
definePageMeta({
  middleware: 'auth', // Use 'auth' or your specific admin middleware
});

// --- Composables ---
const { $appwrite } = useNuxtApp();
const config = useRuntimeConfig();

// --- State ---
const totalBookmarks = ref<number | null>(null);
const pendingBookmarksCount = ref<number | null>(null);
const isLoadingStats = ref<boolean>(false);
const statsError = ref<string | null>(null);

const newUrl = ref<string>('');
const isSubmitting = ref<boolean>(false);
const submitMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);

// --- Appwrite Config ---
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId;
const FUNCTION_ID_ADD_BOOKMARK = config.public.appwriteFunctionIdAddBookmark; // Get from config

// --- Methods ---

/**
 * Fetches bookmark statistics (total and pending counts).
 */
async function fetchStatistics() {
  isLoadingStats.value = true;
  statsError.value = null;
  totalBookmarks.value = null;
  pendingBookmarksCount.value = null;

  if (!DATABASE_ID || !COLLECTION_ID_BOOKMARKS) {
    statsError.value = "Database configuration is missing.";
    isLoadingStats.value = false;
    return;
  }

  try {
    // Fetch total count
    const totalResponse = await $appwrite.databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        [ Query.limit(0) ] // Appwrite returns total count even with limit 0
    );
    totalBookmarks.value = totalResponse.total;

    // Fetch pending count
    const pendingResponse = await $appwrite.databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        [ Query.equal('status', 'pending'), Query.limit(0) ]
    );
    pendingBookmarksCount.value = pendingResponse.total;

  } catch (e: any) {
    console.error('Failed to fetch bookmark statistics:', e);
    statsError.value = `Could not load statistics: ${ e.message || 'Unknown error' }`;
  } finally {
    isLoadingStats.value = false;
  }
}

/**
 * Submits the new URL to the Appwrite function.
 */
/**
 * Submits the new URL using $fetch instead of Appwrite functions.
 */
async function submitNewUrl() {
  if (!newUrl.value.trim()) {
    submitMessage.value = { type: 'error', text: 'URL cannot be empty.' };
    return;
  }

  // Basic URL validation
  try {
    new URL(newUrl.value);
  } catch (_) {
    submitMessage.value = { type: 'error', text: 'Please enter a valid URL.' };
    return;
  }

  isSubmitting.value = true;
  submitMessage.value = null;

  try {
    console.log(`Submitting URL: ${ newUrl.value }`);

    // Use $fetch to call your API endpoint
    //const response = await $fetch('https://67f18694d1aa3e90f1bd.appwrite.global/', {
    const response = await $fetch('http://localhost:3000/', {
      method: 'POST',
      body: {
        url: newUrl.value
      }
    });

    console.log('API response:', response);

    if (response.success) {
      submitMessage.value = { type: 'success', text: 'Bookmark added successfully and is pending validation.' };
      newUrl.value = ''; // Clear input on success
      // Refresh statistics after adding
      await fetchStatistics();
    } else {
      submitMessage.value = { type: 'error', text: response.message || 'Failed to add bookmark' };
    }
  } catch (e: any) {
    console.error('Failed to submit new URL:', e);
    const errorText = e.message || 'An unexpected error occurred.';
    submitMessage.value = { type: 'error', text: `Failed to add bookmark: ${ errorText }` };
  } finally {
    isSubmitting.value = false;
  }
}

// --- Lifecycle Hooks ---
onMounted(() => {
  fetchStatistics();
});

</script>


<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Admin Overview</h1>

    <!-- Statistics Section -->
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Bookmark Statistics</h2>
      <div v-if="isLoadingStats" class="text-gray-500">Loading statistics...</div>
      <div v-else-if="statsError" class="mt-4">
        <Alert variant="destructive">
          <AlertTitle>Error Loading Stats</AlertTitle>
          <AlertDescription>
            {{ statsError }}
          </AlertDescription>
        </Alert>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 border rounded-lg shadow-sm">
          <h3 class="text-lg font-medium mb-2">Total Bookmarks</h3>
          <p class="text-4xl font-bold">{{ totalBookmarks ?? 'N/A' }}</p>
        </div>
        <div class="p-4 border rounded-lg shadow-sm">
          <h3 class="text-lg font-medium mb-2">Pending Validation</h3>
          <p class="text-4xl font-bold">{{ pendingBookmarksCount ?? 'N/A' }}</p>
        </div>
      </div>
    </section>

    <!-- Add Bookmark Section -->
    <section>
      <h2 class="text-2xl font-semibold mb-4">Add New Bookmark</h2>
      <div class="flex items-start space-x-4">
        <div class="flex-grow">
          <Input
              id="new-url"
              type="url"
              v-model="newUrl"
              placeholder="Enter URL (e.g., https://example.com)"
              :disabled="isSubmitting"
              class="w-full"
          />
        </div>
        <Button @click="submitNewUrl" :disabled="isSubmitting || !newUrl.trim()">
          <span v-if="isSubmitting">Adding...</span>
          <span v-else>Add Bookmark</span>
        </Button>
      </div>
      <div v-if="submitMessage" class="mt-4">
        <Alert :variant="submitMessage.type === 'success' ? 'default' : 'destructive'">
          <AlertTitle>{{ submitMessage.type === 'success' ? 'Success' : 'Error' }}</AlertTitle>
          <AlertDescription>
            {{ submitMessage.text }}
          </AlertDescription>
        </Alert>
      </div>
    </section>

  </div>
</template>