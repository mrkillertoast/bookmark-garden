<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icon } from '#components'; // Use auto-imported Icon

import type { BookmarkWithParsedData, IClassification } from '~/types';
import { useClassificationStore } from '~/stores/classifications';

// --- Props ---
interface Props {
  bookmark: BookmarkWithParsedData;
  isApproving: boolean; // Renamed for clarity (is this specific card being approved?)
  approvalError: string | null; // Renamed for clarity
  // Removed props related to external dialogs if checks are inline
  handleApprove: (bookmark: BookmarkWithParsedData, status: LlmClassificationStatus) => Promise<void>; // Renamed
  handleReject: (bookmarkId: string) => Promise<void>; // Add reject handler prop
  handleManualEdit?: (bookmark: BookmarkWithParsedData) => void; // Optional: Prop for manual editing flow
}

const props = defineProps<Props>();

// --- Composables ---
const classificationStore = useClassificationStore();

// --- LLM Classification Status Computation ---

// Interface for status of a single suggested tag
export interface ClassificationStatus {
  name: string;
  status: 'existing' | 'new'; // 'missing' removed as we check against store
  existingId?: string; // ID if status is 'existing'
  intendedParentId?: string; // The ID of the parent this tag SHOULD be under (relevant for L2/L3 creation)
  intendedLevel: 1 | 2 | 3;
  hierarchyValid: boolean; // Is the parent relationship correct if the tag exists?
}

// Interface for the overall status of the LLM suggestion
export interface LlmClassificationStatus {
  level1: ClassificationStatus | null;
  level2: ClassificationStatus | null;
  level3: ClassificationStatus[];
  isValidOverallHierarchy: boolean; // Is the entire suggested L1->L2->L3 chain valid?
  hasSuggestion: boolean; // Does the bookmark have any LLM suggestion?
}

const llmClassificationStatus = computed((): LlmClassificationStatus => {
  const result: LlmClassificationStatus = {
    level1: null,
    level2: null,
    level3: [],
    isValidOverallHierarchy: true, // Assume valid initially
    hasSuggestion: false,
  };

  const llmSuggest = props.bookmark.parsedLlmClassification;

  // Ensure store is loaded before proceeding
  if (!classificationStore.hasLoaded && !classificationStore.isLoading) {
    console.warn('Classification store not loaded yet in VerifyCard. Retrying fetch.');
    // Attempt to trigger fetch if VerifyCard is rendered before store load finishes
    classificationStore.fetchClassifications();
    // Return a default state indicating loading/pending check
    return { ...result, isValidOverallHierarchy: false, hasSuggestion: !!llmSuggest }; // Mark hierarchy invalid until store loads
  }
  if (classificationStore.isLoading) {
    console.log('Classification store is loading in VerifyCard.');
    // Return a default state indicating loading/pending check
    return { ...result, isValidOverallHierarchy: false, hasSuggestion: !!llmSuggest }; // Mark hierarchy invalid until store loads
  }
  if (!llmSuggest?.level1TagName) {
    return result; // No suggestion, nothing to check
  }

  result.hasSuggestion = true; // Mark that there is a suggestion to process

  let currentL1Id: string | undefined = undefined;
  let currentL1HierarchyValid = true;

  // --- Level 1 Check ---
  const l1Name = llmSuggest.level1TagName;
  const existingL1 = classificationStore.findClassificationByNameAndLevel(l1Name, 1);
  result.level1 = {
    name: l1Name,
    status: existingL1 ? 'existing' : 'new',
    existingId: existingL1?.$id,
    intendedLevel: 1,
    intendedParentId: undefined, // L1 has no parent in this context
    hierarchyValid: true, // L1 hierarchy is always valid relative to itself
  };
  currentL1Id = existingL1?.$id; // Keep track of the existing L1 ID if found
  // isValidOverallHierarchy remains true for L1


  let currentL2Id: string | undefined = undefined;
  let currentL2HierarchyValid = true;

  // --- Level 2 Check ---
  if (llmSuggest.level2TagName) {
    const l2Name = llmSuggest.level2TagName;
    const existingL2 = classificationStore.findClassificationByNameAndLevel(l2Name, 2);
    let l2Status: 'existing' | 'new' = existingL2 ? 'existing' : 'new';
    let l2Id = existingL2?.$id;
    let parentIsValid = true;

    if (existingL2) {
      // L2 exists. Check if its parent is the *intended* L1 (even if L1 is new, it won't have an ID yet).
      // The actual creation logic will handle assigning the parent ID correctly.
      // Here, we only validate if L2 *already exists* and is *already* parented under the *existing* L1.
      if (currentL1Id) { // Only check parentage if L1 also exists
        parentIsValid = existingL2.parentIds?.includes(currentL1Id) ?? false;
        if (!parentIsValid) {
          console.warn(`Hierarchy mismatch: Existing L2 "${l2Name}" (${existingL2.$id}) is not parented under existing L1 "${l1Name}" (${currentL1Id}). Found parents: ${existingL2.parentIds?.join(', ')}`);
          // Tag exists, but under wrong parent. Crucially, mark hierarchy invalid.
          result.isValidOverallHierarchy = false;
        }
      } else if (result.level1?.status === 'new') {
        // L2 exists, but the intended L1 parent is new.
        // This isn't strictly an *invalid* hierarchy for creation (we'll create L1 then L2 under it),
        // but the *existing* L2 cannot be used directly. Treat L2 as 'new' for the approval process.
        console.warn(`Hierarchy context: Existing L2 "${l2Name}" found, but intended L1 "${l1Name}" is new. L2 will be created under the new L1.`);
        l2Status = 'new';
        l2Id = undefined; // Cannot use the existing ID
        parentIsValid = false; // Mark the existing L2's hierarchy as not matching the *intended* new L1
      }
    }
    // If L2 is 'new', hierarchy is considered valid *for creation*.
    currentL2HierarchyValid = parentIsValid; // Track if the *existing* L2 (if found) has the correct parent
    currentL2Id = l2Status === 'existing' && parentIsValid ? l2Id : undefined; // Only use existing ID if status is 'existing' and parent was valid

    result.level2 = {
      name: l2Name,
      status: l2Status,
      existingId: l2Id, // Use the potentially reset ID
      intendedParentId: currentL1Id, // The ID of the L1 tag (existing or *will be* created)
      intendedLevel: 2,
      hierarchyValid: currentL2HierarchyValid,
    };
  } else {
    // No L2 suggestion. Overall hierarchy validity depends only on L1 (which is always true).
  }


  // --- Level 3 Check ---
  // Only proceed if L2 was suggested and the hierarchy up to L2 is potentially valid for creation.
  // If result.level2 exists AND (L2 is new OR L2 exists with valid parent), check L3.
  const canCheckL3 = result.level2 && (result.level2.status === 'new' || result.level2.hierarchyValid);

  if (llmSuggest.level3TagNames?.length > 0 && canCheckL3 && result.level2) {
    const intendedL2ParentId = result.level2.status === 'new'
        ? undefined // L2 is new, its ID isn't known yet, but creation logic will handle it
        : result.level2.existingId; // Use existing L2 ID if L2 exists and hierarchy was valid

    llmSuggest.level3TagNames.forEach(l3Name => {
      const existingL3 = classificationStore.findClassificationByNameAndLevel(l3Name, 3);
      let l3Status: 'existing' | 'new' = existingL3 ? 'existing' : 'new';
      let l3Id = existingL3?.$id;
      let parentIsValidL3 = true; // Assume valid initially for this tag

      if (existingL3) {
        // L3 exists. Check if its parent is the *intended* L2.
        if (intendedL2ParentId) { // Only check parentage if L2 also exists *and* had valid hierarchy
          parentIsValidL3 = existingL3.parentIds?.includes(intendedL2ParentId) ?? false;
          if (!parentIsValidL3) {
            console.warn(`Hierarchy mismatch: Existing L3 "${l3Name}" (${existingL3.$id}) is not parented under intended L2 "${result.level2?.name}" (${intendedL2ParentId}). Found parents: ${existingL3.parentIds?.join(', ')}`);
            result.isValidOverallHierarchy = false; // Invalidate overall hierarchy
          }
        } else if (result.level2?.status === 'new') {
          // L3 exists, but the intended L2 parent is new.
          // Treat L3 as 'new' for the approval process.
          console.warn(`Hierarchy context: Existing L3 "${l3Name}" found, but intended L2 "${result.level2.name}" is new. L3 will be created under the new L2.`);
          l3Status = 'new';
          l3Id = undefined;
          parentIsValidL3 = false; // Mark the existing L3's hierarchy as not matching the *intended* new L2
        } else if (!result.level2?.hierarchyValid) {
          // L3 exists, but the L2 it should be under had an invalid hierarchy itself.
          // Treat L3 as new.
          console.warn(`Hierarchy context: Existing L3 "${l3Name}" found, but intended L2 "${result.level2.name}" had invalid parent. L3 will be created under the new/correct L2.`);
          l3Status = 'new';
          l3Id = undefined;
          parentIsValidL3 = false;
        }
      }
      // If L3 is 'new', hierarchy is considered valid *for creation*.

      result.level3.push({
        name: l3Name,
        status: l3Status,
        existingId: l3Status === 'existing' && parentIsValidL3 ? l3Id : undefined, // Only use existing ID if valid
        intendedParentId: intendedL2ParentId, // The ID of the L2 tag (existing or *will be* created)
        intendedLevel: 3,
        hierarchyValid: parentIsValidL3, // Tracks if *this specific existing* L3 had the correct parent
      });
    });
  } else if (llmSuggest.level3TagNames?.length > 0 && !canCheckL3) {
    // L3 tags were suggested, but L2 was missing or had an invalid hierarchy for usage.
    // All suggested L3s must be treated as 'new' because their intended parent is problematic.
    result.isValidOverallHierarchy = false; // Mark overall as invalid if L2 was the issue
    console.warn(`Hierarchy issue: Cannot process L3 tags because L2 suggestion ("${result.level2?.name}") was missing, new, or had invalid existing parentage.`);
    llmSuggest.level3TagNames.forEach(l3Name => {
      result.level3.push({
        name: l3Name,
        status: 'new', // Force new status
        existingId: undefined,
        intendedParentId: undefined, // Parent context is broken
        intendedLevel: 3,
        hierarchyValid: false, // Cannot validate parentage
      });
    });
  }

  return result;
});

// --- Computed Status Display Helpers ---
const getStatusVariant = (status: 'existing' | 'new'): 'default' | 'secondary' => {
  return status === 'existing' ? 'default' : 'secondary';
}
const getStatusColorClass = (status: 'existing' | 'new'): string => {
  return status === 'existing' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';
}
const getHierarchyIndicator = (isValid: boolean | undefined): string => {
  if (isValid === undefined) return ''; // Not applicable (e.g., L1)
  return isValid ? '✓' : '✗'; // Simple checkmark or cross
}
const getHierarchyColorClass = (isValid: boolean | undefined): string => {
  if (isValid === undefined) return '';
  return isValid ? 'text-green-500' : 'text-red-500';
}


// --- Actions ---

// Wrapper for the approve handler
async function approve() {
  // Re-check overall hierarchy validity before approving
  if (!llmClassificationStatus.value.isValidOverallHierarchy) {
    console.error(`Approval blocked for bookmark ${props.bookmark.$id}: LLM suggested hierarchy conflicts with existing tags or parent is new.`);
    // Use alert or emit an event instead of directly modifying prop
    alert("Approval failed: LLM suggested hierarchy conflicts with existing tags, or a required parent tag is new but the child tag already exists elsewhere. Please review or edit manually.");
    return;
  }
  // Ensure there's actually a suggestion to approve
  if (!llmClassificationStatus.value.hasSuggestion) {
    console.warn(`Approval skipped for bookmark ${props.bookmark.$id}: No LLM suggestion found.`);
    // Maybe change status to 'rejected' or 'needs_manual' directly?
    // Or just do nothing / require manual action.
    // For now, let's call reject.
    await props.handleReject(props.bookmark.$id); // Or a different handler if needed
    return;
  }

  await props.handleApprove(props.bookmark, llmClassificationStatus.value);
}

// Wrapper for the reject handler
async function reject() {
  await props.handleReject(props.bookmark.$id);
}

// Wrapper for manual edit
function manualEdit() {
  if (props.handleManualEdit) {
    props.handleManualEdit(props.bookmark);
  } else {
    console.warn('Manual edit handler not provided to VerifyCard');
  }
}

</script>

<template>
  <Card :key="bookmark.$id" class="mb-4">
    <CardHeader class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Image -->
      <div v-if="props.bookmark.imageUrl" class="p-0 relative md:col-span-1">
        <img
            :src="props.bookmark.imageUrl"
            :alt="`Image for ${props.bookmark.title}`"
            class="aspect-video w-full object-cover rounded-lg"
            loading="lazy"
        />
      </div>
      <div v-else class="p-0 relative md:col-span-1 flex items-center justify-center bg-muted rounded-lg aspect-video">
        <Icon name="lucide:image-off" class="h-10 w-10 text-muted-foreground" />
      </div>

      <!-- Title, URL, Description -->
      <div class="space-y-2 md:col-span-2">
        <p class="font-bold text-lg">{{ bookmark.title || 'No Title Provided' }}</p>
        <p>
          <a :href="bookmark.url" target="_blank" rel="noopener noreferrer"
             class="text-blue-600 hover:underline break-all">
            {{ bookmark.url }}
          </a>
        </p>
        <p class="text-sm text-muted-foreground">{{ bookmark.description || 'No description.' }}</p>
        <p class="text-xs text-muted-foreground">Received: {{ new Date(bookmark.$createdAt).toLocaleString() }}</p>
      </div>
    </CardHeader>

    <CardContent class="space-y-4 pt-4">
      <Separator/>

      <!-- LLM Classification Suggestion -->
      <div>
        <h4 class="font-semibold mb-2 text-base">LLM Classification Suggestion:</h4>
        <div v-if="classificationStore.isLoading" class="text-muted-foreground italic">
          Loading classifications...
        </div>
        <div v-else-if="classificationStore.error" class="text-red-600">
          Error loading classifications: {{ classificationStore.error }}
        </div>
        <div v-else-if="llmClassificationStatus.hasSuggestion" class="p-3 rounded border bg-muted/50 space-y-2">
          <!-- Level 1 -->
          <div v-if="llmClassificationStatus.level1" class="flex items-center space-x-2 text-sm">
            <Badge :variant="getStatusVariant(llmClassificationStatus.level1.status)" class="w-10 justify-center">
              L1
            </Badge>
            <span :class="getStatusColorClass(llmClassificationStatus.level1.status)" class="font-medium">
              {{ llmClassificationStatus.level1.name }}
            </span>
            <span class="text-xs text-muted-foreground">
              ({{ llmClassificationStatus.level1.status }})
            </span>
            <!-- L1 doesn't need hierarchy check relative to parent -->
          </div>

          <!-- Level 2 -->
          <div v-if="llmClassificationStatus.level2" class="flex items-center space-x-2 text-sm">
            <Badge :variant="getStatusVariant(llmClassificationStatus.level2.status)" class="w-10 justify-center">
              L2
            </Badge>
            <span :class="getStatusColorClass(llmClassificationStatus.level2.status)" class="font-medium">
              {{ llmClassificationStatus.level2.name }}
            </span>
            <span class="text-xs text-muted-foreground">
              ({{ llmClassificationStatus.level2.status }})
            </span>
            <span v-if="llmClassificationStatus.level2.status === 'existing'"
                  :class="getHierarchyColorClass(llmClassificationStatus.level2.hierarchyValid)"
                  class="text-xs font-mono"
                  :title="llmClassificationStatus.level2.hierarchyValid ? 'Parent hierarchy matches L1' : 'Existing tag has INCORRECT parent (relative to suggested L1)'">
                 [{{ getHierarchyIndicator(llmClassificationStatus.level2.hierarchyValid) }}]
             </span>
          </div>

          <!-- Level 3 -->
          <div v-if="llmClassificationStatus.level3.length > 0" class="flex items-start space-x-2 text-sm">
            <Badge variant="outline" class="w-10 justify-center mt-0.5"> <!-- Adjust alignment -->
              L3
            </Badge>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <div v-for="(l3Tag, index) in llmClassificationStatus.level3" :key="index" class="flex items-center space-x-1">
                     <span :class="getStatusColorClass(l3Tag.status)" class="font-medium">
                         {{ l3Tag.name }}
                     </span>
                <span class="text-xs text-muted-foreground">
                         ({{ l3Tag.status }})
                     </span>
                <span v-if="l3Tag.status === 'existing'"
                      :class="getHierarchyColorClass(l3Tag.hierarchyValid)"
                      class="text-xs font-mono"
                      :title="l3Tag.hierarchyValid ? 'Parent hierarchy matches L2' : 'Existing tag has INCORRECT parent (relative to suggested L2)'">
                          [{{ getHierarchyIndicator(l3Tag.hierarchyValid) }}]
                     </span>
              </div>
            </div>
          </div>

          <!-- Hierarchy Validity Alert -->
          <Alert v-if="!llmClassificationStatus.isValidOverallHierarchy" variant="destructive" class="mt-3">
            <Icon name="lucide:alert-triangle" class="h-4 w-4" />
            <AlertDescription class="text-xs">
              Hierarchy conflict detected. An existing tag does not have the correct parent based on the suggestion, or a required parent is new while the child exists elsewhere. Approval requires manual review or edit.
            </AlertDescription>
          </Alert>

        </div>
        <div v-else class="text-muted-foreground italic">
          No LLM classification suggestion provided for this bookmark.
        </div>
      </div>

      <!-- Manual Classification (Placeholder/Example) -->
      <!-- You might add a section here if manual classification is still needed -->
      <!-- <Separator/>
      <div>
           <h4 class="font-semibold mb-2 text-base">Manual Classification:</h4>
            <p class="text-muted-foreground italic text-sm"> [Manual selection UI would go here] </p>
      </div> -->

    </CardContent>

    <CardFooter class="flex justify-between items-center pt-4">
      <!-- Approval Error Display -->
      <div v-if="approvalError" class="text-red-600 text-sm mr-4 flex-1">
        Error: {{ approvalError }}
      </div>
      <div v-else class="flex-1"></div> <!-- Spacer -->

      <!-- Action Buttons -->
      <div class="flex space-x-2">
        <Button
            variant="outline"
            size="sm"
            @click="reject"
            :disabled="isApproving"
        >
          Reject
        </Button>
        <!-- Optional Manual Edit Button -->
        <Button
            v-if="handleManualEdit"
            variant="outline"
            size="sm"
            @click="manualEdit"
            :disabled="isApproving"
        >
          Edit
        </Button>
        <Button
            size="sm"
            @click="approve"
            :disabled="isApproving || !llmClassificationStatus.isValidOverallHierarchy || !llmClassificationStatus.hasSuggestion || classificationStore.isLoading"
            :aria-label="isApproving ? 'Approving...' : 'Approve'"
        >
          <Icon v-if="isApproving" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Approve
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>
