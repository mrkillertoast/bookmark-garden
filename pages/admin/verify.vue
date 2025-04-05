<script setup lang="ts">
import { ref } from 'vue';
import { useAsyncData } from '#app';
import { Query, ID } from 'appwrite'; // Import Query
import type { Models } from 'appwrite';
import type { IBookmark } from '~/types';
// ** Remember the path change for imports **
import { getClassificationNames } from '~/utils/classificationHierarchy';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// TODO: Import Dialog components later for editing
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// Apply auth middleware and admin layout
definePageMeta({
  middleware: 'auth',
});

const { $appwrite } = useNuxtApp();

// --- Runtime Config ---
const config = useRuntimeConfig();

// --- Appwrite Config --- (Ensure these are correct)
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteCollectionId;

// --- Fetch Pending Bookmarks ---
const { data: pendingBookmarks, pending, error: fetchError, refresh } = useAsyncData<IBookmark[]>(
    'pending-bookmarks', // Unique key
    async () => {
      try {
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_BOOKMARKS,
            [
              Query.equal('status', 'pending') // Filter by status
              // Optional: Add sorting, e.g., Query.orderAsc('$createdAt')
            ]
        );
        // Map to IBookmark interface
        return response.documents.map(doc => ({
          id: doc.$id,
          title: doc.title,
          description: doc.description,
          url: doc.url,
          imageUrl: doc.imageUrl,
          classificationIds: doc.classificationIds || [],
          isFavorite: doc.isFavorite ?? false,
          createdAt: doc.$createdAt,
          status: doc.status // Include status if needed in UI
        } as IBookmark));
      } catch (err) {
        console.error("Error fetching pending bookmarks:", err);
        return [];
      }
    }, {
      default: () => [] as IBookmark[]
    }
);

const actionError = ref<string | null>(null);
const actionLoading = ref<string | null>(null); // Store ID of bookmark being acted upon

// --- Actions ---

async function approveBookmark(bookmarkId: string | number) {
  actionLoading.value = bookmarkId as string;
  actionError.value = null;
  console.log(`Approving bookmark ${ bookmarkId }`);
  try {
    await $appwrite.databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        bookmarkId as string,
        { status: 'verified' } // Update status
    );
    // Refresh the list after approval
    await refresh();
    // Optional: Show success toast
  } catch (err: any) {
    console.error(`Error approving bookmark ${ bookmarkId }:`, err);
    actionError.value = `Failed to approve ${ bookmarkId }: ${ err.message }`;
    // Optional: Show error toast
  } finally {
    actionLoading.value = null;
  }
}

async function rejectBookmark(bookmarkId: string | number) {
  if (!confirm(`Are you sure you want to reject and delete bookmark ${ bookmarkId }?`)) {
    return;
  }
  actionLoading.value = bookmarkId as string;
  actionError.value = null;
  console.log(`Rejecting bookmark ${ bookmarkId }`);
  try {
    await $appwrite.databases.deleteDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        bookmarkId as string
    );
    // Refresh the list after rejection
    await refresh();
    // Optional: Show success toast
  } catch (err: any) {
    console.error(`Error rejecting bookmark ${ bookmarkId }:`, err);
    actionError.value = `Failed to reject ${ bookmarkId }: ${ err.message }`;
    // Optional: Show error toast
  } finally {
    actionLoading.value = null;
  }
}

function editClassifications(bookmark: IBookmark) {
  // TODO: Implement Dialog logic
  // 1. Open a Dialog
  // 2. Populate Dialog form with current bookmark details (title, desc, classifications)
  // 3. Allow editing classifications (using comma-sep input or better)
  // 4. On Dialog save, call updateDocument with new classifications AND status: 'verified'
  alert(`Edit classifications for "${ bookmark.title }" (ID: ${ bookmark.id }) - Not implemented yet.`);
}

</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">
      Verify Pending Bookmarks
    </h1>

    <Alert v-if="actionError" variant="destructive" class="mb-4">
      <Icon name="lucide:alert-triangle" class="h-4 w-4"/>
      <AlertTitle>Action Error</AlertTitle>
      <AlertDescription>{{ actionError }}</AlertDescription>
    </Alert>

    <div v-if="pending" class="space-y-4">
      <p>Loading pending bookmarks...</p>
      <Skeleton class="h-20 w-full" v-for="n in 3" :key="`sk-${n}`"/>
    </div>

    <div v-else-if="fetchError" class="text-center text-destructive py-10">
      <p>Error loading pending bookmarks:</p>
      <p class="text-sm">{{ fetchError.message }}</p>
      <Button variant="outline" size="sm" @click="refresh()" class="mt-4">Retry</Button>
    </div>

    <div v-else-if="!pendingBookmarks || pendingBookmarks.length === 0" class="text-center text-muted-foreground py-10">
      <p>No bookmarks currently pending verification.</p>
    </div>

    <div v-else class="space-y-4">
      <Card v-for="bookmark in pendingBookmarks" :key="bookmark.id">
        <CardHeader>
          <CardTitle>{{ bookmark.title }}</CardTitle>
          <CardDescription>
            <NuxtLink :to="bookmark.url" target="_blank" class="hover:underline text-blue-600 break-all">
              {{ bookmark.url }}
              <Icon name="lucide:external-link" class="inline h-3 w-3 ml-1"/>
            </NuxtLink>
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <p class="text-sm">{{ bookmark.description }}</p>
          <div class="flex flex-wrap gap-1">
            <Badge variant="secondary">Current Tags:</Badge>
            <Badge v-for="name in getClassificationNames(bookmark.classificationIds)" :key="name" variant="outline">
              {{ name }}
            </Badge>
            <span v-if="bookmark.classificationIds.length === 0"
                  class="text-sm text-muted-foreground italic">None</span>
          </div>
        </CardContent>
        <CardFooter class="flex justify-end gap-2">
          <Button
              variant="destructive"
              size="sm"
              @click="rejectBookmark(bookmark.id)"
              :disabled="actionLoading === bookmark.id"
          >
            <Icon v-if="actionLoading === bookmark.id" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
            Reject
          </Button>
          <Button
              variant="outline"
              size="sm"
              @click="editClassifications(bookmark)"
              :disabled="actionLoading === bookmark.id"
          >
            <Icon v-if="actionLoading === bookmark.id" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
            Edit & Approve
          </Button>
          <Button
              variant="default"
              size="sm"
              @click="approveBookmark(bookmark.id)"
              :disabled="actionLoading === bookmark.id"
          >
            <Icon v-if="actionLoading === bookmark.id" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
            Approve
          </Button>
        </CardFooter>
      </Card>
    </div>

  </div>
</template>