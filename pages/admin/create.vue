<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { ID, Query } from 'appwrite'; // Import Query
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select' // Import Select components
import type { IBookmark, IClassification } from '~/types';
import { getLevel1Categories, getSubCategories } from "~/utils/classificationHelper";

// Apply auth middleware and admin layout
definePageMeta({
  middleware: 'auth',
  // layout: 'admin' // Uncomment if you have an admin layout
});

// --- Appwrite SDK & Config ---
const { $appwrite } = useNuxtApp();
const config = useRuntimeConfig();
const DATABASE_ID = config.public.appwriteDatabaseId;
const COLLECTION_ID_BOOKMARKS = config.public.appwriteBookmarksCollectionId;
const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId; // <<<--- ADD THIS ID

// --- State Management ---
const classifications = useState<IClassification[] | null>('classifications', () => null);
const isLoadingClassifications = ref(false);
const formError = ref<string | null>(null); // General form error
const tagError = ref<string | null>(null); // Error specific to tag creation
const successMessage = ref<string | null>(null);
const isLoading = ref(false); // Loading state for bookmark submission

// --- Form State ---
const title = ref('');
const url = ref('');
const description = ref('');
const imageUrl = ref('');

// Selected Tag IDs
const selectedLevel1TagId = ref<string | undefined>(undefined);
const selectedLevel2TagId = ref<string | undefined>(undefined);
const selectedLevel3TagId = ref<string | undefined>(undefined);

// State for adding new tags inline
const showAddLevel1 = ref(false);
const newLevel1TagName = ref('');
const isAddingLevel1 = ref(false);

const showAddLevel2 = ref(false);
const newLevel2TagName = ref('');
const isAddingLevel2 = ref(false);

const showAddLevel3 = ref(false);
const newLevel3TagName = ref('');
const isAddingLevel3 = ref(false);

// --- Computed Properties for Tag Dropdowns ---
const level1Items = computed(() => {
  if (!classifications.value) return [];
  return getLevel1Categories(classifications).sort((a, b) => a.name.localeCompare(b.name));
});

const level2Items = computed(() => {
  if (!selectedLevel1TagId.value || !classifications.value) return [];
  return getSubCategories(classifications, selectedLevel1TagId.value).sort((a, b) => a.name.localeCompare(b.name));
});

const level3Items = computed(() => {
  if (!selectedLevel2TagId.value || !classifications.value) return [];
  return getSubCategories(classifications, selectedLevel2TagId.value).sort((a, b) => a.name.localeCompare(b.name));
});

// --- Fetch Classifications (Safeguard) ---
async function fetchClassifications() {
  // Only fetch if state is empty
  if (classifications.value === null) {
    isLoadingClassifications.value = true;
    try {
      // Fetch all classifications - adjust limit if you have many
      const response = await $appwrite.databases.listDocuments(
          DATABASE_ID,
          COLLECTION_ID_CLASSIFICATIONS,
          [ Query.limit(500) ] // Adjust limit as needed
      );
      classifications.value = response.documents.map(doc => ({
        $id: doc.$id,
        name: doc.name,
        level: doc.level,
        parentId: doc.parentId,
        $createdAt: doc.$createdAt,
        $updatedAt: doc.$updatedAt,
      })) as IClassification[];

    } catch (e: any) {
      console.error('Failed to fetch classifications:', e);
      formError.value = 'Could not load classifications. Please try again later.';
    } finally {
      isLoadingClassifications.value = false;
    }
  }
}

onMounted(fetchClassifications);

// --- Watchers to clear child selections when parent changes ---
watch(selectedLevel1TagId, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    selectedLevel2TagId.value = undefined;
    selectedLevel3TagId.value = undefined;
    showAddLevel2.value = false; // Hide add sections if parent changes
    showAddLevel3.value = false;
    newLevel2TagName.value = '';
    newLevel3TagName.value = '';
  }
});

watch(selectedLevel2TagId, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    selectedLevel3TagId.value = undefined;
    showAddLevel3.value = false;
    newLevel3TagName.value = '';
  }
});

// --- Function to Add a New Tag ---
async function addNewTag(level: 1 | 2 | 3) {
  tagError.value = null; // Clear previous tag errors
  let tagName: string;
  let parentId: string | null = null;
  let setIsAdding: (value: boolean) => void;
  let setNewTagName: (value: string) => void;
  let setShowAdd: (value: boolean) => void;
  let setSelectedTagId: (value: string | undefined) => void;


  if (level === 1) {
    tagName = newLevel1TagName.value.trim();
    setIsAdding = (v) => isAddingLevel1.value = v;
    setNewTagName = (v) => newLevel1TagName.value = v;
    setShowAdd = (v) => showAddLevel1.value = v;
    setSelectedTagId = (v) => selectedLevel1TagId.value = v;
  } else if (level === 2) {
    tagName = newLevel2TagName.value.trim();
    parentId = selectedLevel1TagId.value ?? null; // Must have L1 selected
    if (!parentId) {
      tagError.value = "Please select a Level 1 tag first.";
      return;
    }
    setIsAdding = (v) => isAddingLevel2.value = v;
    setNewTagName = (v) => newLevel2TagName.value = v;
    setShowAdd = (v) => showAddLevel2.value = v;
    setSelectedTagId = (v) => selectedLevel2TagId.value = v;
  } else { // level === 3
    tagName = newLevel3TagName.value.trim();
    parentId = selectedLevel2TagId.value ?? null; // Must have L2 selected
    if (!parentId) {
      tagError.value = "Please select a Level 2 tag first.";
      return;
    }
    setIsAdding = (v) => isAddingLevel3.value = v;
    setNewTagName = (v) => newLevel3TagName.value = v;
    setShowAdd = (v) => showAddLevel3.value = v;
    setSelectedTagId = (v) => selectedLevel3TagId.value = v;
  }

  if (!tagName) {
    tagError.value = `Please enter a name for the new Level ${ level } tag.`;
    return;
  }

  setIsAdding(true);

  const newTagData: Omit<IClassification, '$id' | '$collectionId' | '$databaseId' | '$createdAt' | '$updatedAt' | '$permissions'> = {
    name: tagName,
    level: level,
    parentId: parentId,
  };

  try {
    const response = await $appwrite.databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID_CLASSIFICATIONS,
        ID.unique(),
        newTagData
        // Appwrite's createDocument returns Promise<Models.Document>
    );

    console.log(`Level ${ level } tag created:`, response);

    // FIX: Explicitly create the IClassification object
    // We know the response object contains our custom fields because we just created it
    const createdTag: IClassification = {
      $id: response.$id,
      name: response.name, // Access custom attribute
      level: response.level as (1 | 2 | 3), // Access custom attribute, assert specific type if needed
      parentId: response.parentId as (string | null), // Access custom attribute, assert specific type
      $createdAt: response.$createdAt,
      $updatedAt: response.$updatedAt,
      // You might need other properties from IClassification if they exist
      // e.g., $collectionId: response.$collectionId, etc. if they are part of your interface
    };

    // Update the global classifications state immutably
    // Ensure classifications.value is an array before spreading
    classifications.value = [ ...(classifications.value ?? []), createdTag ];

    // Automatically select the newly created tag
    setSelectedTagId(createdTag.$id);

    // Reset UI - FIXED Syntax: Pass the value directly
    setNewTagName('');
    setShowAdd(false);

  } catch (e: any) {
    console.error(`Failed to create Level ${ level } tag:`, e);
    tagError.value = e.message || `An unknown error occurred while adding the Level ${ level } tag.`;
  } finally {
    setIsAdding(false); // FIXED Syntax: Pass the value directly
  }
}


// --- Handle Bookmark Submission ---
async function handleSubmit() {
  isLoading.value = true;
  formError.value = null;
  successMessage.value = null;
  tagError.value = null; // Clear tag error on main submission attempt

  // Basic validation
  if (!title.value || !url.value || !description.value || !selectedLevel1TagId.value || !selectedLevel2TagId.value || !selectedLevel3TagId.value) {
    formError.value = "Please fill in Title, URL, Description, and select a tag for each level (L1, L2, L3).";
    isLoading.value = false;
    return;
  }

  // Prepare data for Appwrite
  // Adjust bookmarkData structure according to your IBookmark type
  const bookmarkData = {
    title: title.value,
    url: url.value,
    description: description.value,
    level1TagId: selectedLevel1TagId.value, // Store selected IDs
    level2TagId: selectedLevel2TagId.value,
    level3TagId: selectedLevel3TagId.value,
    // Only include imageUrl if it's provided
    ...(imageUrl.value && { imageUrl: imageUrl.value }),
    status: 'pending', // Add status for verification workflow
    // Add userId if needed: userId: user.value?.$id
  };


  try {
    const response = await $appwrite.databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID_BOOKMARKS,
        ID.unique(),
        bookmarkData
    );

    console.log('Bookmark created successfully:', response);
    successMessage.value = `Bookmark "${ response.title }" created successfully! It needs verification.`;

    // Clear form
    title.value = '';
    url.value = '';
    description.value = '';
    imageUrl.value = '';
    selectedLevel1TagId.value = undefined; // Clear selections
    // selectedLevel2TagId and selectedLevel3TagId will clear via watchers

  } catch (e: any) {
    console.error('Failed to create bookmark:', e);
    formError.value = e.message || 'An unknown error occurred while creating the bookmark.';
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

    <div v-if="isLoadingClassifications" class="text-muted-foreground mb-4">
      Loading classifications...
    </div>

    <form v-else class="space-y-6 max-w-2xl" @submit.prevent="handleSubmit">
      <Alert v-if="formError" variant="destructive">
        <Icon name="lucide:alert-triangle" class="h-4 w-4"/>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ formError }}</AlertDescription>
      </Alert>

      <Alert v-if="tagError" variant="destructive">
        <Icon name="lucide:alert-triangle" class="h-4 w-4"/>
        <AlertTitle>Tag Error</AlertTitle>
        <AlertDescription>{{ tagError }}</AlertDescription>
      </Alert>

      <Alert v-if="successMessage">
        <Icon name="lucide:check-circle" class="h-4 w-4"/>
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>{{ successMessage }}</AlertDescription>
      </Alert>

      <div class="space-y-4 border p-4 rounded-md">
        <h2 class="text-lg font-semibold mb-2">Bookmark Details</h2>
        <div>
          <Label for="title">Title</Label>
          <Input id="title" v-model="title" required :disabled="isLoading"/>
        </div>

        <div>
          <Label for="url">URL</Label>
          <Input id="url" v-model="url" type="url" required :disabled="isLoading" placeholder="https://example.com"/>
        </div>

        <div>
          <Label for="description">Description</Label>
          <Textarea id="description" v-model="description" required :disabled="isLoading"/>
        </div>

        <div>
          <Label for="imageUrl">Image URL (Optional)</Label>
          <Input id="imageUrl" v-model="imageUrl" type="url" :disabled="isLoading"
                 placeholder="https://example.com/image.png"/>
        </div>
      </div>


      <div class="space-y-4 border p-4 rounded-md">
        <h2 class="text-lg font-semibold mb-2">Classifications</h2>

        <div class="space-y-2">
          <Label for="level1">Level 1 Tag</Label>
          <div class="flex items-center gap-2">
            <Select v-model="selectedLevel1TagId" :disabled="isLoading || isAddingLevel1 || isLoadingClassifications">
              <SelectTrigger id="level1">
                <SelectValue placeholder="Select Level 1 Tag"/>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Level 1 Tags</SelectLabel>
                  <SelectItem v-for="tag in level1Items" :key="tag.$id" :value="tag.$id">
                    {{ tag.name }}
                  </SelectItem>
                  <SelectItem v-if="!level1Items.length" value="no-items" disabled>
                    No Level 1 tags found.
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" @click="showAddLevel1 = !showAddLevel1"
                    :disabled="isLoading || isAddingLevel1">
              <Icon :name="showAddLevel1 ? 'lucide:minus' : 'lucide:plus'" class="h-4 w-4 mr-1"/>
              Add New
            </Button>
          </div>
          <div v-if="showAddLevel1" class="flex items-center gap-2 mt-2 pl-4">
            <Input v-model="newLevel1TagName" placeholder="New Level 1 Tag Name" :disabled="isAddingLevel1"/>
            <Button type="button" @click="addNewTag(1)" :disabled="isAddingLevel1 || !newLevel1TagName">
              <Icon v-if="isAddingLevel1" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
              Save
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="level2">Level 2 Tag</Label>
          <div class="flex items-center gap-2">
            <Select v-model="selectedLevel2TagId"
                    :disabled="!selectedLevel1TagId || isLoading || isAddingLevel2 || isLoadingClassifications">
              <SelectTrigger id="level2">
                <SelectValue placeholder="Select Level 2 Tag"/>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Level 2 Tags (Sub-tags of selected L1)</SelectLabel>
                  <SelectItem v-for="tag in level2Items" :key="tag.$id" :value="tag.$id">
                    {{ tag.name }}
                  </SelectItem>
                  <SelectItem v-if="selectedLevel1TagId && !level2Items.length" value="no-items" disabled>
                    No Level 2 tags found for this L1 tag.
                  </SelectItem>
                  <SelectItem v-if="!selectedLevel1TagId" value="select-l1" disabled>
                    Select a Level 1 tag first.
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" @click="showAddLevel2 = !showAddLevel2"
                    :disabled="isLoading || isAddingLevel2 || !selectedLevel1TagId">
              <Icon :name="showAddLevel2 ? 'lucide:minus' : 'lucide:plus'" class="h-4 w-4 mr-1"/>
              Add New
            </Button>
          </div>
          <div v-if="showAddLevel2" class="flex items-center gap-2 mt-2 pl-4">
            <Input v-model="newLevel2TagName" placeholder="New Level 2 Tag Name" :disabled="isAddingLevel2"/>
            <Button type="button" @click="addNewTag(2)" :disabled="isAddingLevel2 || !newLevel2TagName">
              <Icon v-if="isAddingLevel2" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
              Save
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="level3">Level 3 Tag</Label>
          <div class="flex items-center gap-2">
            <Select v-model="selectedLevel3TagId"
                    :disabled="!selectedLevel2TagId || isLoading || isAddingLevel3 || isLoadingClassifications">
              <SelectTrigger id="level3">
                <SelectValue placeholder="Select Level 3 Tag"/>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Level 3 Tags (Sub-tags of selected L2)</SelectLabel>
                  <SelectItem v-for="tag in level3Items" :key="tag.$id" :value="tag.$id">
                    {{ tag.name }}
                  </SelectItem>
                  <SelectItem v-if="selectedLevel2TagId && !level3Items.length" value="no-items" disabled>
                    No Level 3 tags found for this L2 tag.
                  </SelectItem>
                  <SelectItem v-if="!selectedLevel2TagId" value="select-l2" disabled>
                    Select a Level 2 tag first.
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" @click="showAddLevel3 = !showAddLevel3"
                    :disabled="isLoading || isAddingLevel3 || !selectedLevel2TagId">
              <Icon :name="showAddLevel3 ? 'lucide:minus' : 'lucide:plus'" class="h-4 w-4 mr-1"/>
              Add New
            </Button>
          </div>
          <div v-if="showAddLevel3" class="flex items-center gap-2 mt-2 pl-4">
            <Input v-model="newLevel3TagName" placeholder="New Level 3 Tag Name" :disabled="isAddingLevel3"/>
            <Button type="button" @click="addNewTag(3)" :disabled="isAddingLevel3 || !newLevel3TagName">
              <Icon v-if="isAddingLevel3" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
              Save
            </Button>
          </div>
        </div>
      </div>
      <Button type="submit"
              :disabled="isLoading || isLoadingClassifications || isAddingLevel1 || isAddingLevel2 || isAddingLevel3">
        <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
        {{ isLoading ? 'Creating...' : 'Create Bookmark' }}
      </Button>
    </form>
  </div>
</template>