<script setup lang="ts">
import { ref } from 'vue';
import { ID } from 'appwrite'; // Appwrite helper for unique IDs
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { IBookmark } from '~/types'; // Use your bookmark type

// Apply auth middleware and admin layout
definePageMeta({
  middleware: 'auth',
});

const { $appwrite } = useNuxtApp();
const config = useRuntimeConfig();

// Form state
const title = ref('');
const url = ref('');
const description = ref('');
const imageUrl = ref('');
const classificationInput = ref(''); // Simple comma-separated input for now
const isLoading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// --- Appwrite Config ---
const DATABASE_ID = config.public.appwriteDatabaseId
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId; // e.g., 'bookmarks'

async function handleSubmit() {
  isLoading.value = true;
  error.value = null;
  successMessage.value = null;

  // Basic validation
  if (!title.value || !url.value || !description.value || !classificationInput.value) {
    error.value = "Please fill in Title, URL, Description, and Classifications.";
    isLoading.value = false;
    return;
  }

  // Prepare data for Appwrite
  // Convert comma-separated string to array, trim whitespace
  const classificationIds = classificationInput.value
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== ''); // Remove empty strings

  if (classificationIds.length === 0) {
    error.value = "Please enter at least one valid Classification ID.";
    isLoading.value = false;
    return;
  }

  const bookmarkData: Omit<IBookmark, 'id' | 'createdAt' | 'isFavorite'> & { classificationIds: string[]; imageUrl?: string; } = {
    title: title.value,
    url: url.value,
    description: description.value,
    classificationIds: classificationIds,
    // Only include imageUrl if it's provided
    ...(imageUrl.value && { imageUrl: imageUrl.value }),
    // isFavorite defaults to false in Appwrite attribute setup
    // Add status: 'pending' if implementing verification later
  };


  try {
    const response = await $appwrite.databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        ID.unique(), // Generate a unique ID
        bookmarkData
    );

    console.log('Bookmark created successfully:', response);
    successMessage.value = `Bookmark "${response.title}" created successfully! (ID: ${response.$id})`;

    // Clear form
    title.value = '';
    url.value = '';
    description.value = '';
    imageUrl.value = '';
    classificationInput.value = '';

  } catch (e: any) {
    console.error('Failed to create bookmark:', e);
    error.value = e.message || 'An unknown error occurred.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">
      Create New Bookmark
    </h1>

    <form class="space-y-4 max-w-2xl" @submit.prevent="handleSubmit">
      <Alert v-if="error" variant="destructive">
        <Icon name="lucide:alert-triangle" class="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Alert v-if="successMessage" variant="success">
        <Icon name="lucide:check-circle" class="h-4 w-4" />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>{{ successMessage }}</AlertDescription>
      </Alert>


      <div>
        <Label for="title">Title</Label>
        <Input id="title" v-model="title" required :disabled="isLoading" />
      </div>

      <div>
        <Label for="url">URL</Label>
        <Input id="url" v-model="url" type="url" required :disabled="isLoading" placeholder="https://example.com"/>
      </div>

      <div>
        <Label for="description">Description</Label>
        <Textarea id="description" v-model="description" required :disabled="isLoading" />
      </div>

      <div>
        <Label for="imageUrl">Image URL (Optional)</Label>
        <Input id="imageUrl" v-model="imageUrl" type="url" :disabled="isLoading" placeholder="https://example.com/image.png"/>
      </div>

      <div>
        <Label for="classifications">Classification IDs (comma-separated)</Label>
        <Input id="classifications" v-model="classificationInput" required :disabled="isLoading" placeholder="e.g., dev,frontend,react" />
        <p class="text-xs text-muted-foreground mt-1">Enter the IDs from your hierarchy (e.g., dev, frontend, react). Improve this input later.</p>
      </div>


      <Button type="submit" :disabled="isLoading">
        <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
        {{ isLoading ? 'Creating...' : 'Create Bookmark' }}
      </Button>
    </form>
  </div>
</template>