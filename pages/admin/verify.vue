<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { ID, Query, AppwriteException } from 'appwrite';
import { useNuxtApp, useAsyncData, useRuntimeConfig, refreshNuxtData } from '#app';
import { useClassificationStore } from '~/stores/classifications';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import VerifyCard from '~/components/VerifyCard.vue'; // Import VerifyCard
import type { LlmClassificationStatus, ClassificationStatus } from '~/components/VerifyCard.vue'; // Import status types
import type { IBookmark, IClassification } from '~/types';

// --- Helper Types --- (Ensure these match your actual data structures)
interface ParsedLlmClassification {
  level1TagName: string | null;
  level2TagName: string | null;
  level3TagNames: string[];
}

// Keep if manual suggestions are possible, otherwise remove
// interface ParsedSuggestedNewTag { ... }

// Combined bookmark type used in this page
type BookmarkWithParsedData = Omit<IBookmark, 'level1Id' | 'level2Ids' | 'level3Ids'> & // Omit original fields if they change type/structure after appwrite fetch
    Models.Document & // Include Appwrite document fields like $id, $createdAt etc.
    {
      // Explicitly define fields expected from Appwrite document not in IBookmark base
      status: 'pending' | 'approved' | 'rejected';
      llmClassification?: string | null; // JSON string from Appwrite
      suggestedNewTags?: string | null; // JSON string from Appwrite (if used)
      // Add parsed versions
      parsedLlmClassification?: ParsedLlmClassification | null;
      // parsedSuggestedNewTags?: ParsedSuggestedNewTag[]; // If used
      // Fields to be populated after approval (match IBookmark definition)
      level1Id?: string | null;
      level2Ids?: string[] | null; // Array
      level3Ids?: string[] | null; // Array
    };


// --- Page Meta ---
definePageMeta({
  middleware: 'auth',
});

// --- Composables ---
const { $appwrite } = useNuxtApp();
const config = useRuntimeConfig();
const classificationStore = useClassificationStore();

// --- State ---
const pendingBookmarks = ref<BookmarkWithParsedData[]>([]);
const bookmarksError = ref<string | null>(null); // For fetch errors
const approvalState = ref<Record<string, { approving: boolean; error: string | null }>>({}); // Track approval per bookmark

// --- Appwrite Config ---
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId;
const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId;

// --- Data Fetching ---

// Fetch Classifications via Store
onMounted(async () => {
  console.log('Verify page mounted, ensuring classifications are fetched.');
  if (!classificationStore.hasLoaded) {
    await classificationStore.fetchClassifications();
  }
});

// Fetch Pending Bookmarks
const {
  pending: isLoadingBookmarks,
  error: fetchBookmarksError,
  refresh: refreshBookmarks,
  data: pendingBookmarksData
} = useAsyncData<BookmarkWithParsedData[]>(
    'pendingBookmarks',
    async () => {
      console.log('Fetching pending bookmarks...');
      approvalState.value = {}; // Reset approval states on refresh
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
        console.log(`Fetched ${ response.documents.length } raw pending bookmarks.`);

        return response.documents.map((doc): BookmarkWithParsedData => {
          const bookmark = doc as BookmarkWithParsedData; // Cast to include status etc.
          let parsedLlm: ParsedLlmClassification | null = null;

          if (bookmark.llmClassification) {
            try {
              const parsed = JSON.parse(bookmark.llmClassification);
              // Basic validation
              if (parsed && typeof parsed === 'object' && Array.isArray(parsed.level3TagNames)) {
                parsedLlm = {
                  level1TagName: parsed.level1TagName || null,
                  level2TagName: parsed.level2TagName || null,
                  level3TagNames: parsed.level3TagNames || [],
                };
              } else {
                console.warn(`Invalid structure in llmClassification for bookmark ${ bookmark.$id }`);
              }
            } catch (e) {
              console.error(`JSON Parse error for llmClassification in bookmark ${ bookmark.$id }:`, e);
            }
          }
          // Keep the original Appwrite document structure + add parsed data
          return { ...bookmark, parsedLlmClassification: parsedLlm };
        });
      } catch (e: any) {
        console.error('Failed to fetch pending bookmarks:', e);
        throw new Error(`Could not load pending bookmarks: ${ e.message || 'Unknown error' }`); // Throw to let useAsyncData handle error state
      }
    }, {
      server: false, // Fetch client-side
      default: () => [], // Default value while loading or on error
      watch: [ () => classificationStore.hasLoaded ] // Re-fetch if classifications load state changes (optional, refresh might be better)
    }
);

// Update local state from useAsyncData
watch(pendingBookmarksData, (newData) => {
  pendingBookmarks.value = newData || [];
  if (newData) bookmarksError.value = null; // Clear fetch error on success
}, { immediate: true });

watch(fetchBookmarksError, (newError) => {
  if (newError) {
    bookmarksError.value = newError.message || 'An error occurred loading bookmarks.';
  } else {
    bookmarksError.value = null; // Clear error if fetch succeeds later
  }
}, { immediate: true });

// --- Methods ---

/**
 * Sets the approval state for a specific bookmark.
 */
function setApprovalStatus(bookmarkId: string, approving: boolean, error: string | null = null) {
  approvalState.value[ bookmarkId ] = { approving, error };
}

/**
 * Creates a new classification tag if it doesn't exist.
 * IMPORTANT: This function now relies on the store being up-to-date.
 * It checks the store *before* attempting creation.
 */
async function findOrCreateTag(
    name: string,
    level: 1 | 2 | 3,
    parentIds: string[] = [] // Parent IDs required for L2/L3
): Promise<string | null> { // Returns the ID of the tag (existing or new) or null on error
  console.log(`findOrCreateTag called: Name=${ name }, Level=${ level }, ParentIDs=${ parentIds.join(',') }`);

  // 1. Check if tag already exists (use the store's finder)
  const existingTag = classificationStore.findClassificationByNameAndLevel(name, level);

  if (existingTag) {
    // 2. If exists, verify parentage if applicable (L2/L3)
    if (level > 1) {
      const requiredParentId = parentIds[ 0 ]; // Assume single parent for now based on structure
      if (!requiredParentId) {
        console.error(`Cannot verify parentage for existing L${ level } tag "${ name }" (${ existingTag.$id }): Required parent ID is missing.`);
        // This indicates a logic error in how handleApproveBookmark calls this
        return null; // Critical error
      }
      // Check if the *existing* tag already has the *required* parent
      if (existingTag.parentIds?.includes(requiredParentId)) {
        console.log(`Existing L${ level } tag "${ name }" (${ existingTag.$id }) found with correct parent ${ requiredParentId }. Using existing.`);
        return existingTag.$id;
      } else {
        // THIS IS THE HIERARCHY CONFLICT CASE DETECTED EARLIER
        // VerifyCard should prevent calling approve if this case occurs for an *existing* tag.
        // If we reach here, it implies L1 or L2 was *newly created* in this approval cycle,
        // and now we are creating a child under it. The *existing* tag with the same name/level
        // belongs elsewhere. We MUST create a *new* tag.
        console.warn(`Existing L${ level } tag "${ name }" (${ existingTag.$id }) found, but under different parent(s) (${ existingTag.parentIds?.join(',') }). Required parent: ${ requiredParentId }. Creating NEW tag.`);
        // Fall through to creation logic below.
      }
    } else {
      // L1 tag exists, no parent check needed.
      console.log(`Existing L1 tag "${ name }" (${ existingTag.$id }) found. Using existing.`);
      return existingTag.$id;
    }
  }

  // 3. If tag doesn't exist (or exists under wrong parent), create it
  console.log(`Tag "${ name }" (L${ level }) not found or has wrong parent. Creating new tag...`);
  try {
    const newTagDoc = await $appwrite.databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID_CLASSIFICATIONS,
        ID.unique(),
        {
          name: name,
          level: level,
          // Ensure parentIds is always an array, even if empty for L1
          parentIds: level > 1 ? parentIds.filter(id => id) : [], // Filter out potential undefined/null IDs
        }
    );
    console.log(`Successfully created L${ level } tag "${ name }" with ID: ${ newTagDoc.$id }`);
    // IMPORTANT: Refresh the store IMMEDIATELY so subsequent findOrCreateTag calls see the new tag
    await classificationStore.fetchClassifications(true); // Force refresh
    return newTagDoc.$id;
  } catch (e: any) {
    console.error(`Failed to create L${ level } tag "${ name }":`, e);
    // Throw specific error to be caught in handleApproveBookmark
    throw new Error(`Failed to create L${ level } tag "${ name }": ${ e.message }`);
  }
}


/**
 * Handles the approval of a bookmark based on the validated LLM status.
 */
async function handleApproveBookmark(bookmark: BookmarkWithParsedData, status: LlmClassificationStatus) {
  const bookmarkId = bookmark.$id;
  if (!bookmarkId) {
    console.error('Cannot approve bookmark: Missing ID.');
    return;
  }

  console.log(`--- Approving Bookmark ${ bookmarkId } ---`);
  setApprovalStatus(bookmarkId, true, null);

  // Double check hierarchy validity (defense-in-depth)
  if (!status.isValidOverallHierarchy) {
    console.error(`Approval aborted for ${ bookmarkId }: Hierarchy invalid (checked again in handler).`);
    setApprovalStatus(bookmarkId, false, "Hierarchy conflict detected.");
    return;
  }
  if (!status.level1) {
    console.error(`Approval aborted for ${ bookmarkId }: Missing L1 classification status.`);
    setApprovalStatus(bookmarkId, false, "L1 classification missing.");
    return;
  }


  let finalL1Id: string | null = null;
  let finalL2Id: string | null = null; // Single L2 based on LLM suggestion structure
  const finalL3Ids: string[] = [];

  try {
    // --- Process Level 1 ---
    console.log(`Processing L1: ${ status.level1.name } (${ status.level1.status })`);
    finalL1Id = await findOrCreateTag(status.level1.name, 1, []);
    if (!finalL1Id) throw new Error(`Failed to find or create L1 tag "${ status.level1.name }"`);
    console.log(` > L1 ID: ${ finalL1Id }`);

    // --- Process Level 2 ---
    if (status.level2) {
      console.log(`Processing L2: ${ status.level2.name } (${ status.level2.status })`);
      // Parent ID for L2 is always the finalL1Id we just obtained/confirmed
      finalL2Id = await findOrCreateTag(status.level2.name, 2, [ finalL1Id ]);
      if (!finalL2Id) throw new Error(`Failed to find or create L2 tag "${ status.level2.name }"`);
      console.log(` > L2 ID: ${ finalL2Id }`);

      // --- Process Level 3 ---
      if (status.level3.length > 0) {
        console.log(`Processing L3 tags (${ status.level3.length })...`);
        // Parent ID for all L3 tags is the finalL2Id
        for (const l3TagStatus of status.level3) {
          console.log(`  Processing L3: ${ l3TagStatus.name } (${ l3TagStatus.status })`);
          const l3Id = await findOrCreateTag(l3TagStatus.name, 3, [ finalL2Id ]);
          if (!l3Id) throw new Error(`Failed to find or create L3 tag "${ l3TagStatus.name }"`);
          finalL3Ids.push(l3Id);
          console.log(`   > L3 ID: ${ l3Id }`);
        }
        console.log(` > Final L3 IDs: ${ finalL3Ids.join(', ') }`);
      }
    }

    // --- Update Bookmark Document ---
    console.log(`Updating bookmark ${ bookmarkId } status and classification IDs...`);
    const updateData: Partial<BookmarkWithParsedData> & { status: string } = {
      status: 'verified',
      level1Id: finalL1Id,
      level2Ids: finalL2Id ? [ finalL2Id ] : [], // Store as array even if single
      level3Ids: finalL3Ids,
      llmClassification: null, // Clear the suggestion once processed
      suggestedNewTags: null, // Clear this too if it exists/was used
    };

    await $appwrite.databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        bookmarkId,
        updateData
    );

    console.log(`--- Bookmark ${ bookmarkId } Approved Successfully ---`);
    setApprovalStatus(bookmarkId, false, null); // Clear loading state

    // Refresh the list of pending bookmarks
    await refreshBookmarks();

  } catch (error: any) {
    console.error(`Error approving bookmark ${ bookmarkId }:`, error);
    setApprovalStatus(bookmarkId, false, error.message || 'An unknown error occurred during approval.');
    // Note: Store might be in an inconsistent state if tag creation failed midway.
    // A more robust solution might involve transactions or cleanup logic.
  }
}

/**
 * Handles rejecting a bookmark.
 */
async function handleRejectBookmark(bookmarkId: string) {
  if (!bookmarkId) {
    console.error('Cannot reject bookmark: Missing ID.');
    return;
  }
  console.log(`--- Rejecting Bookmark ${ bookmarkId } ---`);
  setApprovalStatus(bookmarkId, true, null); // Use approving state for loading indication

  try {
    await $appwrite.databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        bookmarkId,
        { status: 'rejected' }
    );
    console.log(`--- Bookmark ${ bookmarkId } Rejected Successfully ---`);
    setApprovalStatus(bookmarkId, false, null);
    await refreshBookmarks(); // Refresh the list
  } catch (error: any) {
    console.error(`Error rejecting bookmark ${ bookmarkId }:`, error);
    setApprovalStatus(bookmarkId, false, error.message || 'An unknown error occurred during rejection.');
  }
}

// Placeholder for potential manual edit flow trigger
function handleManualEditBookmark(bookmark: BookmarkWithParsedData) {
  console.log(`Manual edit triggered for bookmark: ${ bookmark.$id }`, bookmark);
  // Implement navigation or modal logic here
  alert(`Manual edit for "${ bookmark.title }" not implemented yet.`);
}

</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold mb-6">Verify Pending Bookmarks</h1>

    <!-- Loading Indicator -->
    <div v-if="isLoadingBookmarks" class="text-center py-10">
      <p>Loading pending bookmarks...</p>
    </div>


    <!-- Classification Store Error -->
    <Alert v-else-if="classificationStore.error && !classificationStore.isLoading" variant="destructive" class="mb-6">
      <AlertTitle>Error Loading Classifications</AlertTitle>
      <AlertDescription>
        Could not load classification tags needed for verification: {{ classificationStore.error }}
        <Button variant="outline" size="sm" class="ml-4" @click="classificationStore.fetchClassifications(true)">Retry
        </Button>
      </AlertDescription>
    </Alert>

    <!-- No Pending Bookmarks -->
    <div v-else-if="pendingBookmarks.length === 0" class="text-center py-10 text-muted-foreground">
      <p>No pending bookmarks found.</p>
    </div>

    <!-- Pending Bookmarks List -->
    <div class="space-y-6">
      <VerifyCard
          v-for="bookmark in pendingBookmarks"
          :key="bookmark.$id"
          :bookmark="bookmark"
          :is-approving="approvalState[bookmark.$id]?.approving ?? false"
          :approval-error="approvalState[bookmark.$id]?.error ?? null"
          :handle-approve="handleApproveBookmark"
          :handle-reject="handleRejectBookmark"
          :handle-manual-edit="handleManualEditBookmark"
      />
    </div>
  </div>
</template>
