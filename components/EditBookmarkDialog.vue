<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icon } from '#components';
import { useClassificationStore } from '~/stores/classifications';

// Define props for the dialog component
interface Props {
  isOpen: boolean;
  bookmark: any; // Using any for now, will be typed properly
  onClose: () => void;
  onSave: (bookmarkId: string, description: string, level1Id: string | null, level2Id: string | null, level3Id: string | null) => Promise<void>;
  llmSuggestions?: {
    level1TagName?: string;
    level2TagNames?: string[];
    level3TagNames?: string[];
  };
}

const props = defineProps<Props>();
const emit = defineEmits([ 'update:isOpen' ]);

// --- Composables ---
const classificationStore = useClassificationStore();

// --- State ---
const description = ref(props.bookmark?.description || '');
const isLoading = ref(false);
const error = ref<string | null>(null);

// For tag input and autocomplete
const newLevel1Tag = ref('');
const newLevel2Tag = ref('');
const newLevel3Tag = ref('');
const level1Suggestions = ref<Array<{ id?: string, name: string }>>([]);
const level2Suggestions = ref<Array<{ id?: string, name: string }>>([]);
const level3Suggestions = ref<Array<{ id?: string, name: string }>>([]);
const showLevel1Suggestions = ref(false);
const showLevel2Suggestions = ref(false);
const showLevel3Suggestions = ref(false);

// LLM suggestions display
const hasLlmSuggestions = computed(() => {
  return props.llmSuggestions && (
    props.llmSuggestions.level1TagName || 
    (props.llmSuggestions.level2TagNames && props.llmSuggestions.level2TagNames.length > 0) ||
    (props.llmSuggestions.level3TagNames && props.llmSuggestions.level3TagNames.length > 0)
  );
});


// --- Methods ---
function closeDialog() {
  emit('update:isOpen', false);
  props.onClose();
}

// Tag input and autocomplete methods
function filterLevel1Suggestions(input: string) {
  if (!input.trim()) {
    level1Suggestions.value = [];
    return;
  }

  const inputLower = input.toLowerCase();
  const allLevel1Tags = Array.from(classificationStore.classifications.values())
    .filter(tag => tag.level === 1);

  level1Suggestions.value = allLevel1Tags
    .filter(tag => tag.name.toLowerCase().includes(inputLower))
    .map(tag => ({ id: tag.$id, name: tag.name }));

  // Add the exact input as a suggestion if it doesn't exist
  if (!level1Suggestions.value.some(s => s.name.toLowerCase() === inputLower)) {
    level1Suggestions.value.push({ name: input });
  }

  showLevel1Suggestions.value = level1Suggestions.value.length > 0;
}

function filterLevel2Suggestions(input: string) {
  if (!input.trim()) {
    level2Suggestions.value = [];
    return;
  }

  const inputLower = input.toLowerCase();
  const allLevel2Tags = Array.from(classificationStore.classifications.values())
    .filter(tag => tag.level === 2);

  // First, get all level 2 tags that match the input
  level2Suggestions.value = allLevel2Tags
    .filter(tag => tag.name.toLowerCase().includes(inputLower))
    .map(tag => ({ 
      id: tag.$id, 
      name: tag.name,
      // Check if this tag is already a child of the selected level 1
      hasCorrectParent: tag.parentIds?.includes(selectedLevel1Id.value) || false
    }));

  // Add the exact input as a suggestion if it doesn't exist
  if (!level2Suggestions.value.some(s => s.name.toLowerCase() === inputLower)) {
    level2Suggestions.value.push({ name: input });
  }

  showLevel2Suggestions.value = level2Suggestions.value.length > 0;
}

function filterLevel3Suggestions(input: string) {
  if (!input.trim()) {
    level3Suggestions.value = [];
    return;
  }

  const inputLower = input.toLowerCase();
  const allLevel3Tags = Array.from(classificationStore.classifications.values())
    .filter(tag => tag.level === 3);

  // Get all level 3 tags that match the input
  level3Suggestions.value = allLevel3Tags
    .filter(tag => tag.name.toLowerCase().includes(inputLower))
    .map(tag => ({ 
      id: tag.$id, 
      name: tag.name,
      // Check if this tag is already a child of any selected level 2
      hasCorrectParent: tag.parentIds?.some(pid => selectedLevel2Ids.value.has(pid)) || false
    }));

  // Add the exact input as a suggestion if it doesn't exist
  if (!level3Suggestions.value.some(s => s.name.toLowerCase() === inputLower)) {
    level3Suggestions.value.push({ name: input });
  }

  showLevel3Suggestions.value = level3Suggestions.value.length > 0;
}

function selectLevel1Suggestion(suggestion: { id?: string, name: string }) {
  if (suggestion.id) {
    // Existing tag
    selectedLevel1Id.value = suggestion.id;
  } else {
    // New tag - will be created on save
    selectedLevel1Id.value = `new:${suggestion.name}`;
  }

  newLevel1Tag.value = '';
  showLevel1Suggestions.value = false;
}

function selectLevel2Suggestion(suggestion: { id?: string, name: string, hasCorrectParent?: boolean }) {
  if (suggestion.id && suggestion.hasCorrectParent) {
    // Existing tag with correct parent
    selectedLevel2Ids.value.add(suggestion.id);
  } else if (suggestion.id) {
    // Existing tag but with wrong parent - we'll need to create a new one
    selectedLevel2Ids.value.add(`new:${suggestion.name}`);
  } else {
    // New tag - will be created on save
    selectedLevel2Ids.value.add(`new:${suggestion.name}`);
  }

  newLevel2Tag.value = '';
  showLevel2Suggestions.value = false;
}

function selectLevel3Suggestion(suggestion: { id?: string, name: string, hasCorrectParent?: boolean }) {
  if (suggestion.id && suggestion.hasCorrectParent) {
    // Existing tag with correct parent
    selectedLevel3Ids.value.add(suggestion.id);
  } else if (suggestion.id) {
    // Existing tag but with wrong parent - we'll need to create a new one
    selectedLevel3Ids.value.add(`new:${suggestion.name}`);
  } else {
    // New tag - will be created on save
    selectedLevel3Ids.value.add(`new:${suggestion.name}`);
  }

  newLevel3Tag.value = '';
  showLevel3Suggestions.value = false;
}

// Initialize with bookmark's existing tags
const selectedLevel1Id = ref<string | undefined>(props.bookmark?.level1Id);
const selectedLevel2Ids = ref<Set<string>>(new Set(props.bookmark?.level2Ids || []));
const selectedLevel3Ids = ref<Set<string>>(new Set(props.bookmark?.level3Ids || []));

// Log the initial tag values for debugging
console.log('Initial tags:', {
  level1: selectedLevel1Id.value,
  level2: Array.from(selectedLevel2Ids.value),
  level3: Array.from(selectedLevel3Ids.value)
});

// Make sure the tags are displayed by ensuring they're properly initialized
// This is especially important for new tags (prefixed with "new:")
if (props.bookmark?.level1Id && !selectedLevel1Id.value) {
  selectedLevel1Id.value = props.bookmark.level1Id;
}

if (props.bookmark?.level2Ids && props.bookmark.level2Ids.length > 0) {
  props.bookmark.level2Ids.forEach(id => {
    if (id) selectedLevel2Ids.value.add(id);
  });
}

if (props.bookmark?.level3Ids && props.bookmark.level3Ids.length > 0) {
  props.bookmark.level3Ids.forEach(id => {
    if (id) selectedLevel3Ids.value.add(id);
  });
}

// Computed properties for tag dropdowns
const level1Items = computed(() => {
  if (!classificationStore.classifications) return [];
  return Array.from(classificationStore.classifications.values())
      .filter(tag => tag.level === 1)
      .sort((a, b) => a.name.localeCompare(b.name));
});

const level2Items = computed(() => {
  if (!classificationStore.classifications) return [];
  return Array.from(classificationStore.classifications.values())
      .filter(tag =>
          tag.level === 2 &&
          !selectedLevel2Ids.value.has(tag.$id)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
});

const level3Items = computed(() => {
  if (!classificationStore.classifications) return [];
  return Array.from(classificationStore.classifications.values())
      .filter(tag =>
          tag.level === 3 &&
          !selectedLevel3Ids.value.has(tag.$id)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
});

// Methods to add/remove tags
function addLevel2Tag(tagId: string) {
  if (tagId) {
    selectedLevel2Ids.value.add(tagId);
  }
}

function addLevel3Tag(tagId: string) {
  if (tagId) {
    selectedLevel3Ids.value.add(tagId);
  }
}

function removeLevel2Tag(tagId: string) {
  selectedLevel2Ids.value.delete(tagId);

  // Remove any L3 tags that were children of this L2
  if (tagId.startsWith('new:')) {
    // For new tags, we need to check by name since they don't have IDs yet
    const tagName = tagId.substring(4);
    const l3ToRemove = Array.from(selectedLevel3Ids.value)
      .filter(l3Id => {
        if (l3Id.startsWith('new:')) {
          // This is a heuristic - we assume new L3 tags are children of the most recently added L2 tag
          // In a real implementation, you might want to track parent-child relationships for new tags
          return true;
        } else {
          const l3Tag = classificationStore.classifications.get(l3Id);
          return l3Tag?.parentIds?.includes(tagId);
        }
      });
    l3ToRemove.forEach(id => selectedLevel3Ids.value.delete(id));
  } else {
    // For existing tags, we can check the parent IDs
    const l3ToRemove = Array.from(selectedLevel3Ids.value)
      .filter(l3Id => {
        if (l3Id.startsWith('new:')) {
          // This is a heuristic - we assume new L3 tags are children of the most recently added L2 tag
          // In a real implementation, you might want to track parent-child relationships for new tags
          return true;
        } else {
          const l3Tag = classificationStore.classifications.get(l3Id);
          return l3Tag?.parentIds?.includes(tagId);
        }
      });
    l3ToRemove.forEach(id => selectedLevel3Ids.value.delete(id));
  }
}

function removeLevel3Tag(tagId: string) {
  selectedLevel3Ids.value.delete(tagId);
}

// Removed watch function that reset dependent selections
// This was part of the level locking mechanism

async function saveChanges() {
  if (!props.bookmark?.$id) {
    error.value = "Cannot save: Missing bookmark ID";
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    // Process tags to ensure parent-child relationships
    let level1Id = selectedLevel1Id.value || null;
    let level2Ids = Array.from(selectedLevel2Ids.value);
    let level3Ids = Array.from(selectedLevel3Ids.value);

    // Check if we have any new tags (prefixed with "new:")
    const hasNewTags = 
      (level1Id && level1Id.startsWith('new:')) ||
      level2Ids.some(id => id.startsWith('new:')) ||
      level3Ids.some(id => id.startsWith('new:'));

    // If we have new tags, we need to extract the names and handle them specially
    if (hasNewTags) {
      // For now, we'll just pass the IDs as is, and let the parent component
      // handle the creation of new tags and establishing relationships
      // In a real implementation, you might want to create the tags here
      // and update the IDs before saving

      // Extract new tag names for logging
      const newLevel1Name = level1Id?.startsWith('new:') ? level1Id.substring(4) : null;
      const newLevel2Names = level2Ids
        .filter(id => id.startsWith('new:'))
        .map(id => id.substring(4));
      const newLevel3Names = level3Ids
        .filter(id => id.startsWith('new:'))
        .map(id => id.substring(4));

      console.log('New tags to be created:', {
        level1: newLevel1Name,
        level2: newLevel2Names,
        level3: newLevel3Names
      });
    }

    await props.onSave(
        props.bookmark.$id,
        description.value,
        level1Id,
        level2Ids,
        level3Ids
    );
    closeDialog();
  } catch (e: any) {
    error.value = e.message || "Failed to save changes";
    console.error("Error saving bookmark changes:", e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <Dialog :open="props.isOpen" @update:open="emit('update:isOpen', $event)">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Edit Bookmark</DialogTitle>
        <DialogDescription>
          Update the bookmark details and classification tags.
        </DialogDescription>
      </DialogHeader>

      <div class="py-4 space-y-4">
        <!-- Bookmark Info -->
        <div class="text-sm">
          <p class="font-medium">{{ props.bookmark?.title }}</p>
          <p class="text-muted-foreground truncate">{{ props.bookmark?.url }}</p>
        </div>

        <!-- Description -->
        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Textarea
              id="description"
              v-model="description"
              :placeholder="props.bookmark?.description"
              :disabled="isLoading"
          />
        </div>

        <!-- LLM Suggested Tags -->
        <div v-if="hasLlmSuggestions" class="space-y-2 mb-4">
          <Label>LLM Suggested Tags</Label>
          <div class="p-3 rounded border bg-muted/50 space-y-2">
            <!-- Level 1 -->
            <div v-if="props.llmSuggestions?.level1TagName" class="flex items-center space-x-2 text-sm">
              <Badge variant="outline" class="w-10 justify-center">L1</Badge>
              <span class="font-medium">{{ props.llmSuggestions.level1TagName }}</span>
              <Button 
                variant="outline" 
                size="sm" 
                class="h-6 px-2 ml-auto"
                @click="selectLevel1Suggestion({ name: props.llmSuggestions.level1TagName })"
              >
                Use
              </Button>
            </div>

            <!-- Level 2 -->
            <div v-if="props.llmSuggestions?.level2TagNames?.length" class="flex items-start space-x-2 text-sm">
              <Badge variant="outline" class="w-10 justify-center mt-0.5">L2</Badge>
              <div class="flex flex-wrap gap-2 flex-1">
                <Badge 
                  v-for="(tagName, index) in props.llmSuggestions.level2TagNames" 
                  :key="index"
                  variant="secondary"
                  class="flex items-center gap-1"
                >
                  <span>{{ tagName }}</span>
                  <button
                    @click="selectLevel2Suggestion({ name: tagName })"
                    class="ml-1 hover:text-primary"
                    title="Use tag"
                  >
                    <Icon name="lucide:plus" class="h-3 w-3"/>
                  </button>
                </Badge>
              </div>
            </div>

            <!-- Level 3 -->
            <div v-if="props.llmSuggestions?.level3TagNames?.length" class="flex items-start space-x-2 text-sm">
              <Badge variant="outline" class="w-10 justify-center mt-0.5">L3</Badge>
              <div class="flex flex-wrap gap-2 flex-1">
                <Badge 
                  v-for="(tagName, index) in props.llmSuggestions.level3TagNames" 
                  :key="index"
                  variant="secondary"
                  class="flex items-center gap-1"
                >
                  <span>{{ tagName }}</span>
                  <button
                    @click="selectLevel3Suggestion({ name: tagName })"
                    class="ml-1 hover:text-primary"
                    title="Use tag"
                  >
                    <Icon name="lucide:plus" class="h-3 w-3"/>
                  </button>
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <!-- Tag Selection -->
        <div class="space-y-4">
          <!-- Level 1 Tag Selection (single) -->
          <div class="space-y-2">
            <Label for="level1">Level 1 Tag</Label>
            <div class="relative">
              <Input
                id="level1"
                v-model="newLevel1Tag"
                placeholder="Type to search or add new tag"
                :disabled="isLoading || classificationStore.isLoading"
                @input="filterLevel1Suggestions(newLevel1Tag)"
                @focus="filterLevel1Suggestions(newLevel1Tag)"
                @blur="setTimeout(() => { showLevel1Suggestions.value = false }, 200)"
              />

              <!-- Autocomplete dropdown -->
              <div 
                v-if="showLevel1Suggestions" 
                class="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
              >
                <div 
                  v-for="(suggestion, index) in level1Suggestions" 
                  :key="index"
                  class="px-3 py-2 cursor-pointer hover:bg-muted flex items-center justify-between"
                  @mousedown="selectLevel1Suggestion(suggestion)"
                >
                  <span>{{ suggestion.name }}</span>
                  <Badge v-if="suggestion.id" variant="outline" class="ml-2">existing</Badge>
                  <Badge v-else variant="secondary" class="ml-2">new</Badge>
                </div>
              </div>
            </div>

            <!-- Selected Level 1 Tag -->
            <div v-if="selectedLevel1Id" class="mt-2">
              <Badge 
                class="px-2 py-1 flex items-center gap-1"
                :variant="selectedLevel1Id.startsWith('new:') ? 'secondary' : 'default'"
              >
                <span>
                  {{ selectedLevel1Id.startsWith('new:') 
                    ? selectedLevel1Id.substring(4) 
                    : classificationStore.classifications.get(selectedLevel1Id)?.name }}
                </span>
                <span class="text-xs opacity-70">
                  ({{ selectedLevel1Id.startsWith('new:') ? 'new' : 'existing' }})
                </span>
                <button
                  @click="selectedLevel1Id = undefined"
                  class="ml-1 hover:text-destructive"
                  title="Remove tag"
                >
                  <Icon name="lucide:x" class="h-3 w-3"/>
                </button>
              </Badge>
            </div>
          </div>

          <!-- Level 2 Tags (multiple) -->
          <div class="space-y-2">
            <Label for="level2">Level 2 Tags</Label>
            <div class="relative">
              <Input
                id="level2"
                v-model="newLevel2Tag"
                placeholder="Type to search or add new Level 2 tag"
                :disabled="isLoading || classificationStore.isLoading"
                @input="filterLevel2Suggestions(newLevel2Tag)"
                @focus="filterLevel2Suggestions(newLevel2Tag)"
                @blur="setTimeout(() => { showLevel2Suggestions.value = false }, 200)"
              />

              <!-- Autocomplete dropdown -->
              <div 
                v-if="showLevel2Suggestions" 
                class="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
              >
                <div 
                  v-for="(suggestion, index) in level2Suggestions" 
                  :key="index"
                  class="px-3 py-2 cursor-pointer hover:bg-muted flex items-center justify-between"
                  @mousedown="selectLevel2Suggestion(suggestion)"
                >
                  <span>{{ suggestion.name }}</span>
                  <div class="flex items-center gap-1">
                    <Badge v-if="suggestion.id && suggestion.hasCorrectParent" variant="outline" class="ml-2">existing</Badge>
                    <Badge v-else-if="suggestion.id" variant="outline" class="ml-2 text-amber-500">wrong parent</Badge>
                    <Badge v-else variant="secondary" class="ml-2">new</Badge>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selected Level 2 Tags -->
            <div v-if="selectedLevel2Ids.size > 0" class="flex flex-wrap gap-2 mt-2">
              <Badge
                v-for="tagId in selectedLevel2Ids"
                :key="tagId"
                :variant="tagId.startsWith('new:') ? 'secondary' : 'default'"
                class="px-2 py-1 flex items-center gap-1"
              >
                <span>
                  {{ tagId.startsWith('new:') 
                    ? tagId.substring(4) 
                    : classificationStore.classifications.get(tagId)?.name }}
                </span>
                <span class="text-xs opacity-70">
                  ({{ tagId.startsWith('new:') ? 'new' : 'existing' }})
                </span>
                <button
                  @click="removeLevel2Tag(tagId)"
                  class="ml-1 hover:text-destructive"
                  title="Remove tag"
                >
                  <Icon name="lucide:x" class="h-3 w-3"/>
                </button>
              </Badge>
            </div>
          </div>

          <!-- Level 3 Tags (multiple) -->
          <div class="space-y-2">
            <Label for="level3">Level 3 Tags</Label>
            <div class="relative">
              <Input
                id="level3"
                v-model="newLevel3Tag"
                placeholder="Type to search or add new Level 3 tag"
                :disabled="isLoading || classificationStore.isLoading"
                @input="filterLevel3Suggestions(newLevel3Tag)"
                @focus="filterLevel3Suggestions(newLevel3Tag)"
                @blur="setTimeout(() => { showLevel3Suggestions.value = false }, 200)"
              />

              <!-- Autocomplete dropdown -->
              <div 
                v-if="showLevel3Suggestions" 
                class="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
              >
                <div 
                  v-for="(suggestion, index) in level3Suggestions" 
                  :key="index"
                  class="px-3 py-2 cursor-pointer hover:bg-muted flex items-center justify-between"
                  @mousedown="selectLevel3Suggestion(suggestion)"
                >
                  <span>{{ suggestion.name }}</span>
                  <div class="flex items-center gap-1">
                    <Badge v-if="suggestion.id && suggestion.hasCorrectParent" variant="outline" class="ml-2">existing</Badge>
                    <Badge v-else-if="suggestion.id" variant="outline" class="ml-2 text-amber-500">wrong parent</Badge>
                    <Badge v-else variant="secondary" class="ml-2">new</Badge>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selected Level 3 Tags -->
            <div v-if="selectedLevel3Ids.size > 0" class="flex flex-wrap gap-2 mt-2">
              <Badge
                v-for="tagId in selectedLevel3Ids"
                :key="tagId"
                :variant="tagId.startsWith('new:') ? 'secondary' : 'default'"
                class="px-2 py-1 flex items-center gap-1"
              >
                <span>
                  {{ tagId.startsWith('new:') 
                    ? tagId.substring(4) 
                    : classificationStore.classifications.get(tagId)?.name }}
                </span>
                <span class="text-xs opacity-70">
                  ({{ tagId.startsWith('new:') ? 'new' : 'existing' }})
                </span>
                <button
                  @click="removeLevel3Tag(tagId)"
                  class="ml-1 hover:text-destructive"
                  title="Remove tag"
                >
                  <Icon name="lucide:x" class="h-3 w-3"/>
                </button>
              </Badge>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        <Alert v-if="error" variant="destructive">
          <Icon name="lucide:alert-triangle" class="h-4 w-4"/>
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="closeDialog" :disabled="isLoading">Cancel</Button>
        <Button @click="saveChanges" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
