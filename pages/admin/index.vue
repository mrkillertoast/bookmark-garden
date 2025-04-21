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
async function submitNewUrl() {
  if (!newUrl.value.trim()) {
    submitMessage.value = { type: 'error', text: 'URL cannot be empty.' };
    return;
  }
  // Basic URL validation (optional, can be more robust)
  try {
    new URL(newUrl.value); // Check if it's a parseable URL
  } catch (_) {
    submitMessage.value = { type: 'error', text: 'Please enter a valid URL.' };
    return;
  }

  if (!FUNCTION_ID_ADD_BOOKMARK) {
    submitMessage.value = { type: 'error', text: 'Add Bookmark Function ID is not configured.' };
    return;
  }


  isSubmitting.value = true;
  submitMessage.value = null;


  try {

    console.log(`Calling function ${ FUNCTION_ID_ADD_BOOKMARK } with URL: ${ newUrl.value }`);
    const execution = await $appwrite.functions.createExecution(
        config.public.appwriteFunctionIdAddBookmark,
        JSON.stringify(`{
          url: newUrl.value,
        }`),
        true,
    )

    console.log('Function execution response:', execution);

    // Check function execution status/response if needed
    if (execution.status === 'completed') {
      // Consider parsing execution.responseBody if your function returns useful info
      submitMessage.value = { type: 'success', text: 'Bookmark added successfully and is pending validation.' };
      newUrl.value = ''; // Clear input on success
      // Refresh statistics after adding
      await fetchStatistics();
    } else {
      // Handle 'failed' status specifically
      let errorMsg = `Function execution finished with status: ${ execution.status }.`;
      if (execution.stderr) {
        errorMsg += ` Error details: ${ execution.stderr }`;
      }
      console.error('Appwrite function execution failed:', execution);
      submitMessage.value = { type: 'error', text: errorMsg };
    }

  } catch (e: any) {
    console.error('Failed to submit new URL:', e);
    let errorText = 'An unexpected error occurred.';
    if (e instanceof AppwriteException) {
      errorText = `Failed to add bookmark: ${ e.message } (Code: ${ e.code })`;
    } else if (e instanceof Error) {
      errorText = `Failed to add bookmark: ${ e.message }`;
    }
    submitMessage.value = { type: 'error', text: errorText };
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