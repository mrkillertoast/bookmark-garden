<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ID, Query } from 'appwrite';
import { useNuxtApp, useState, useAsyncData, refreshNuxtData } from '#app';

// Import Shadcn-Vue components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { IBookmark, IClassification } from '~/types';

// Helper types for parsed data
interface ParsedLlmClassification {
  level1TagName: string | null;
  level2TagName: string | null;
  level3TagNames: string[]; // Array of names
}
interface ParsedSuggestedNewTag {
  newName: string;
  intendedLevel: 1 | 2 | 3;
  intendedParentName: string | null;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'error';
  verificationMessage?: string;
  createdTagId?: string;
}
type BookmarkWithParsedData = IBookmark & {
  parsedLlmClassification?: ParsedLlmClassification | null;
  parsedSuggestedNewTags?: ParsedSuggestedNewTag[];
};


// --- Page Meta ---
definePageMeta({
  middleware: 'auth',
  // layout: 'admin'
});

// --- Composables ---
const { $appwrite } = useNuxtApp();
const config = useRuntimeConfig();

// --- State ---
const classifications = useState<IClassification[] | null>('classifications', () => null);
const pendingBookmarks = ref<BookmarkWithParsedData[]>([]);
const isLoadingClassifications = ref(false); // Keep separate loading for classifications
const errorBookmarks = ref<string | null>(null); // Local error state
const errorClassifications = ref<string | null>(null);
// Keep other state variables
const isVerifyingTags = ref(false);
const selectedBookmarkForTagVerification = ref<BookmarkWithParsedData | null>(null);
const tagVerificationError = ref<string | null>(null);
const tagVerificationSuccess = ref<string | null>(null);
const editingSuggestionIndex = ref<number | null>(null);
const modifiedTagName = ref('');
const modifiedParentId = ref<string | undefined>(undefined);
const isApprovingBookmark = ref(false);
const bookmarkApprovalError = ref<string | null>(null);

// --- Appwrite Config ---
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId;
const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId;

// --- Data Fetching ---

// Fetch Classifications (Keep existing function)
async function fetchClassifications() {
  if (!classifications.value) {
    isLoadingClassifications.value = true;
    errorClassifications.value = null;
    try {
      console.log('Fetching classifications for verification page...');
      const MAX_FETCH_LIMIT = 100;
      let allTags: IClassification[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_CLASSIFICATIONS,
            [Query.limit(MAX_FETCH_LIMIT), Query.offset(offset), Query.orderAsc('name')]
        );
        const fetchedCount = response.documents.length;
        if (fetchedCount > 0) {
          allTags = allTags.concat(response.documents as IClassification[]);
        }
        if (fetchedCount < MAX_FETCH_LIMIT) {
          hasMore = false;
        } else {
          offset += MAX_FETCH_LIMIT;
        }
      }
      classifications.value = allTags;
      console.log(`Fetched ${allTags.length} classifications.`);
    } catch (e: any) {
      console.error('Failed to fetch classifications:', e);
      errorClassifications.value = 'Could not load classifications. Please try again later.';
    } finally {
      isLoadingClassifications.value = false;
    }
  } else {
    console.log('Classifications already loaded from state.');
    isLoadingClassifications.value = false;
  }
}

// Fetch Pending Bookmarks - REFACTORED useAsyncData call (No top-level await)
const { pending: isLoadingBookmarks, data: fetchedBookmarksData, error: fetchBookmarksError, refresh: refreshBookmarks } = useAsyncData(
    'pendingBookmarks', // Unique key
    async () => { // The handler function
      console.log('Executing useAsyncData handler for pendingBookmarks');
      // Reset local error state at the start of the fetch attempt
      errorBookmarks.value = null;
      try {
        const response = await $appwrite.databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID_BOOKMARKS,
            [
              Query.equal('status', 'pending'),
              Query.limit(50),
              Query.orderDesc('$createdAt')
            ]
        );
        console.log(`Fetched ${response.documents.length} raw pending bookmarks.`);

        // Parse JSON strings
        return response.documents.map((doc): BookmarkWithParsedData => {
          const bookmark = doc as IBookmark;
          let parsedLlmClassification: ParsedLlmClassification | null = null;
          let parsedSuggestedNewTags: ParsedSuggestedNewTag[] = [];

          // Parse llmClassification
          if (bookmark.llmClassification) {
            try {
              parsedLlmClassification = JSON.parse(bookmark.llmClassification);
              if (!parsedLlmClassification || typeof parsedLlmClassification !== 'object' || !Array.isArray(parsedLlmClassification.level3TagNames)) {
                console.error(`Invalid structure llmClassification ${bookmark.$id}`);
                parsedLlmClassification = null;
              }
            } catch (e) { console.error(`Parse error llmClassification ${bookmark.$id}:`, e); }
          }
          // Parse suggestedNewTags
          if (bookmark.suggestedNewTags) {
            try {
              const suggestions = JSON.parse(bookmark.suggestedNewTags);
              if (Array.isArray(suggestions)) {
                parsedSuggestedNewTags = suggestions.map((tag: any) => ({ ...tag, verificationStatus: 'pending' }));
              } else { console.error(`suggestedNewTags not array ${bookmark.$id}`); }
            } catch (e) { console.error(`Parse error suggestedNewTags ${bookmark.$id}:`, e); }
          }
          return { ...bookmark, parsedLlmClassification, parsedSuggestedNewTags };
        });
      } catch (e: any) {
        console.error('Failed to fetch pending bookmarks inside useAsyncData handler:', e);
        // Set the local error ref directly here for immediate feedback in UI
        errorBookmarks.value = `Could not load pending bookmarks: ${e.message}`;
        // Return empty array on error so 'data' ref is not null/undefined
        return [];
      }
    }, {
      watch: [classifications] // Keep watch for now, consider removing if causing issues
      // server: true // Default is true, can be explicit
    }
); // REMOVED await here

// Watch the data ref returned by useAsyncData and update the local pendingBookmarks ref
watch(fetchedBookmarksData, (newData) => {
  console.log('fetchedBookmarksData watcher updating pendingBookmarks');
  pendingBookmarks.value = newData || [];
  // Clear the local error if data loads successfully
  if (newData) {
    errorBookmarks.value = null;
  }
}, { immediate: true });

// Watch the error ref from useAsyncData to potentially update local error state
// This might be redundant if the catch block already sets errorBookmarks.value
watch(fetchBookmarksError, (newError) => {
  if (newError) {
    console.error('Error detected by fetchBookmarksError watcher:', newError);
    // Update local error state if it wasn't already set in the catch block
    if (!errorBookmarks.value) {
      errorBookmarks.value = newError.message || 'An error occurred loading bookmarks via useAsyncData error ref.';
    }
  }
  // We could clear the error here if the fetch succeeds later,
  // but the data watcher already does that.
  // else { errorBookmarks.value = null; }
}, { immediate: true });


// --- Computed Properties ---
// (Keep computed properties: availableLevel1Tags, availableLevel2Tags, parentTagOptions)
const availableLevel1Tags = computed(() => classifications.value?.filter(t => t.level === 1) || []);
const availableLevel2Tags = computed(() => classifications.value?.filter(t => t.level === 2) || []);
const parentTagOptions = computed(() => {
  if (editingSuggestionIndex.value === null || !selectedBookmarkForTagVerification.value?.parsedSuggestedNewTags) return [];
  const suggestion = selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[editingSuggestionIndex.value];
  if (!suggestion || suggestion.intendedLevel === 1) return [];
  if (suggestion.intendedLevel === 2) return availableLevel1Tags.value;
  if (suggestion.intendedLevel === 3) return availableLevel2Tags.value;
  return [];
});


// --- Methods ---
// (Keep methods: openTagVerificationDialog, startEditingSuggestion, cancelEditingSuggestion, etc.)
// --- Placeholder API Call Functions ---
// (Keep placeholder functions: apiApproveNewTag, apiRejectNewTag, apiApproveBookmark)
// IMPORTANT: Ensure apiApproveNewTag updates classifications.value or calls a refresh
async function apiApproveNewTag(bookmarkId: string, suggestionIndex: number, tagDetails: { name: string, level: number, parentId: string | null }): Promise<{ success: boolean; message?: string; createdTag?: IClassification }> {
  console.log('Calling API: apiApproveNewTag', { bookmarkId, suggestionIndex, tagDetails });
  isVerifyingTags.value = true;
  tagVerificationError.value = null;
  tagVerificationSuccess.value = null;
  await new Promise(resolve => setTimeout(resolve, 1000));
  const simulatedSuccess = Math.random() > 0.2;
  if (simulatedSuccess) {
    const newTagId = `new_tag_${Date.now()}`;
    const createdTag: IClassification = { ...tagDetails, $id: newTagId, $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() };
    console.log('Simulated API Success: Tag created', createdTag);
    // --- IMPORTANT: Update classifications state ---
    classifications.value = [...(classifications.value || []), createdTag];
    // ---
    if (selectedBookmarkForTagVerification.value?.parsedSuggestedNewTags) {
      selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].verificationStatus = 'approved';
      selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].createdTagId = newTagId;
      selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].verificationMessage = 'Approved & Created!';
    }
    tagVerificationSuccess.value = `Tag "${tagDetails.name}" approved successfully!`;
    isVerifyingTags.value = false;
    return { success: true, createdTag };
  } else {
    console.error('Simulated API Error: Failed to approve tag');
    const errorMessage = 'Failed to approve tag on server (Simulated).';
    if (selectedBookmarkForTagVerification.value?.parsedSuggestedNewTags) {
      selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].verificationStatus = 'error';
      selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].verificationMessage = errorMessage;
    }
    tagVerificationError.value = errorMessage;
    isVerifyingTags.value = false;
    return { success: false, message: errorMessage };
  }
}
async function apiRejectNewTag(bookmarkId: string, suggestionIndex: number): Promise<{ success: boolean; message?: string }> {
  console.log('Calling API: apiRejectNewTag', { bookmarkId, suggestionIndex });
  isVerifyingTags.value = true;
  tagVerificationError.value = null;
  tagVerificationSuccess.value = null;
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Simulated API Success: Tag rejected');
  if (selectedBookmarkForTagVerification.value?.parsedSuggestedNewTags) {
    selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].verificationStatus = 'rejected';
    selectedBookmarkForTagVerification.value.parsedSuggestedNewTags[suggestionIndex].verificationMessage = 'Rejected.';
  }
  tagVerificationSuccess.value = `Tag suggestion rejected.`;
  isVerifyingTags.value = false;
  return { success: true };
}
async function apiApproveBookmark(bookmarkId: string, primaryClassification: ParsedLlmClassification | null): Promise<{ success: boolean; message?: string }> {
  console.log('Calling API: apiApproveBookmark', { bookmarkId, primaryClassification });
  isApprovingBookmark.value = true;
  bookmarkApprovalError.value = null;
  await new Promise(resolve => setTimeout(resolve, 1500));
  const simulatedSuccess = Math.random() > 0.2;
  if (simulatedSuccess) {
    console.log('Simulated API Success: Bookmark approved');
    // Use the refresh function from useAsyncData to refetch bookmarks
    await refreshBookmarks();
    isApprovingBookmark.value = false;
    return { success: true };
  } else {
    console.error('Simulated API Error: Failed to approve bookmark');
    const errorMessage = 'Failed to approve bookmark on server (Simulated).';
    bookmarkApprovalError.value = errorMessage;
    isApprovingBookmark.value = false;
    return { success: false, message: errorMessage };
  }
}

// --- Event Handlers ---
// (Keep event handlers: openTagVerificationDialog, startEditingSuggestion, cancelEditingSuggestion, handleApproveSuggestion, handleRejectSuggestion, handleApproveBookmark)
function openTagVerificationDialog(bookmark: BookmarkWithParsedData) { /* ... */ }
function startEditingSuggestion(index: number) { /* ... */ }
function cancelEditingSuggestion() { /* ... */ }
async function handleApproveSuggestion(index: number, isModification: boolean = false) { /* ... */ }
async function handleRejectSuggestion(index: number) { /* ... */ }
async function handleApproveBookmark(bookmark: BookmarkWithParsedData) { /* ... */ }


// --- Lifecycle Hooks ---
onMounted(() => {
  fetchClassifications(); // Fetch classifications on mount
});

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Verify Pending Bookmarks</h1>

    <div v-if="isLoadingBookmarks || isLoadingClassifications" class="text-center py-10">
      <p>Loading data...</p>
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-primary mx-auto" />
    </div>
    <div v-else-if="errorBookmarks || errorClassifications" class="space-y-4">
      <Alert v-if="errorBookmarks" variant="destructive">
        <Icon name="lucide:alert-triangle" class="h-4 w-4" />
        <AlertTitle>Error Loading Bookmarks</AlertTitle>
        <AlertDescription>{{ errorBookmarks }}</AlertDescription>
      </Alert>
      <Alert v-if="errorClassifications" variant="destructive">
        <Icon name="lucide:alert-triangle" class="h-4 w-4" />
        <AlertTitle>Error Loading Classifications</AlertTitle>
        <AlertDescription>{{ errorClassifications }}</AlertDescription>
      </Alert>
    </div>
    <div v-else-if="pendingBookmarks.length === 0" class="text-center py-10 text-muted-foreground">
      <p>No pending bookmarks found.</p>
    </div>

    <div v-else class="space-y-6">
      <div v-for="(bookmark) in pendingBookmarks" :key="bookmark.$id" class="grid md:grid-cols-2">
        <VerifyCard 
        :bookmark="bookmark"
        :isApprovingBookmark="isApprovingBookmark"
        :bookmarkApprovalError="bookmarkApprovalError"
        :selectedBookmarkForTagVerification="selectedBookmarkForTagVerification"
        />
        <Alert v-if="bookmarkApprovalError && selectedBookmarkForTagVerification?.$id === bookmark.$id" variant="destructive" class="mt-2 text-xs mx-6 mb-4">
          <Icon name="lucide:alert-triangle" class="h-4 w-4" />
          <AlertDescription>{{ bookmarkApprovalError }}</AlertDescription>
        </Alert>
      </div>
    </div>

    <DialogContent v-if="selectedBookmarkForTagVerification" class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Verify Suggested Tags</DialogTitle>
        <DialogDescription>
          For bookmark: <a :href="selectedBookmarkForTagVerification.url" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline break-all ml-1">{{ selectedBookmarkForTagVerification.title || selectedBookmarkForTagVerification.url }}</a>
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="tagVerificationError" variant="destructive" class="my-2">
        <Icon name="lucide:alert-triangle" class="h-4 w-4" />
        <AlertDescription>{{ tagVerificationError }}</AlertDescription>
      </Alert>
      <Alert v-if="tagVerificationSuccess" variant="success" class="my-2">
        <Icon name="lucide:check-circle" class="h-4 w-4" />
        <AlertDescription>{{ tagVerificationSuccess }}</AlertDescription>
      </Alert>

      <div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">
        <div v-for="(suggestion, index) in selectedBookmarkForTagVerification.parsedSuggestedNewTags" :key="`verify-${selectedBookmarkForTagVerification.$id}-${index}`" class="p-3 border rounded bg-card">
          <div class="flex justify-between items-center mb-2">
            <p class="font-medium">Suggestion #{{ index + 1 }}</p>
            <Badge :variant="suggestion.verificationStatus === 'approved' ? 'success' : suggestion.verificationStatus === 'rejected' ? 'destructive' : suggestion.verificationStatus === 'error' ? 'destructive' : 'secondary'">
              {{ suggestion.verificationStatus || 'Pending' }}
              <Icon v-if="suggestion.verificationStatus === 'error'" name="lucide:alert-circle" class="ml-1 h-3 w-3"/>
            </Badge>
          </div>

          <div class="text-sm space-y-1 bg-muted/50 p-2 rounded mb-3">
            <p><strong>Suggested Name:</strong> {{ suggestion.newName }}</p>
            <p><strong>Intended Level:</strong> {{ suggestion.intendedLevel }}</p>
            <p><strong>Intended Parent:</strong> {{ suggestion.intendedParentName || 'None (Level 1)' }}</p>
            <p v-if="suggestion.verificationMessage" :class="{'text-red-600': suggestion.verificationStatus === 'error', 'text-green-600': suggestion.verificationStatus === 'approved', 'text-muted-foreground': suggestion.verificationStatus === 'rejected'}">
              <strong class="capitalize">{{ suggestion.verificationStatus }}:</strong> {{ suggestion.verificationMessage }}
            </p>
          </div>

          <div v-if="editingSuggestionIndex === index" class="space-y-3 border-t pt-3 mt-3">
            <h5 class="font-semibold text-sm">Modify Suggestion:</h5>
            <div>
              <Label :for="`tagName-${index}`" class="text-xs">Tag Name</Label>
              <Input :id="`tagName-${index}`" v-model="modifiedTagName" />
            </div>
            <div v-if="suggestion.intendedLevel > 1">
              <Label :for="`tagParent-${index}`" class="text-xs">Parent Tag (L{{ suggestion.intendedLevel - 1 }})</Label>
              <Select v-model="modifiedParentId">
                <SelectTrigger :id="`tagParent-${index}`">
                  <SelectValue placeholder="Select Parent Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Level {{ suggestion.intendedLevel - 1 }} Tags</SelectLabel>
                    <SelectItem v-for="tag in parentTagOptions" :key="tag.$id" :value="tag.$id">
                      {{ tag.name }}
                    </SelectItem>
                    <SelectItem v-if="!parentTagOptions.length" value="no-parents" disabled>
                      No suitable parent tags found.
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div class="flex justify-end space-x-2">
              <Button variant="ghost" size="sm" @click="cancelEditingSuggestion">Cancel</Button>
              <Button
                  size="sm"
                  @click="handleApproveSuggestion(index, true)"
                  :disabled="isVerifyingTags || !modifiedTagName || (suggestion.intendedLevel > 1 && !modifiedParentId)"
              >
                <Icon v-if="isVerifyingTags" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
                Save & Approve
              </Button>
            </div>
          </div>

          <div v-else-if="suggestion.verificationStatus === 'pending' || suggestion.verificationStatus === 'error'" class="flex justify-end space-x-2 mt-2">
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                      variant="outline" size="icon-sm"
                      @click="startEditingSuggestion(index)"
                      :disabled="isVerifyingTags"
                      class="h-7 w-7"
                  >
                    <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Edit before approving</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
                variant="destructive" size="sm"
                @click="handleRejectSuggestion(index)"
                :disabled="isVerifyingTags"
            >
              <Icon name="lucide:x" class="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button
                variant="success" size="sm"
                @click="handleApproveSuggestion(index, false)"
                :disabled="isVerifyingTags"
            >
              <Icon v-if="isVerifyingTags" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
              <Icon v-else name="lucide:check" class="mr-1 h-4 w-4" /> Approve As Is
            </Button>
          </div>

        </div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>

  </div>
</template>
