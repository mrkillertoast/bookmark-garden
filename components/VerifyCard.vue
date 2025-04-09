<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';

import type { BookmarkWithParsedData } from '~/types';

interface Props {
  bookmark: BookmarkWithParsedData;
  isApprovingBookmark: boolean;
  bookmarkApprovalError: string | null;
  selectedBookmarkForTagVerification: BookmarkWithParsedData | null;
  openTagVerificationDialog: (bookmark: BookmarkWithParsedData) => void;
  handleApproveBookmark: (bookmark: BookmarkWithParsedData) => Promise<void>;
}

const props = defineProps<Props>();

</script>


<template>
  <Card :key="bookmark.$id">
    <CardHeader class="grid grid-cols-3">

      <div v-if="props.bookmark.imageUrl" class="p-0 relative"><img
          :src="props.bookmark.imageUrl"
          :alt="`Image for ${props.bookmark.title}`"
          class="aspect-video w-full object-cover rounded-t-lg"
          loading="lazy"
      >
      </div>
      <div class="space-y-2 col-span-2">
        <p class="font-bold">{{ bookmark.title || 'No Title Provided' }}</p>
        <p>
          <a :href="bookmark.url" target="_blank" rel="noopener noreferrer"
             class="pb-4 text-blue-600 hover:underline break-all">
            {{ bookmark.url }}
          </a>
        </p>
        <p class="text-sm text-muted-foreground">{{ bookmark.description || 'No description.' }}</p>

      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <Separator/>

      <!-- 3. LLM Classification -->
      <div>
        <h4 class="font-semibold mb-2 text-base">LLM Classification Suggestion:</h4>
        <div v-if="bookmark.parsedLlmClassification && bookmark.parsedLlmClassification.level1TagName">
          <p class="text-sm bg-muted p-2 rounded">
            <span class="font-medium">{{ bookmark.parsedLlmClassification.level1TagName }}</span>
            <Icon name="lucide:chevron-right" class="inline h-4 w-4 mx-1"/>
            <span class="font-medium">{{ bookmark.parsedLlmClassification.level2TagName }}</span>
            <Icon name="lucide:chevron-right" class="inline h-4 w-4 mx-1"/>
            <span v-if="bookmark.parsedLlmClassification.level3TagNames.length > 0">
              [ {{ bookmark.parsedLlmClassification.level3TagNames.join(', ') }} ]
            </span>
            <span v-else class="text-muted-foreground">[ No specific L3 tags ]</span>
          </p>
        </div>
        <p v-else class="text-sm text-muted-foreground italic">LLM did not provide a classification.</p>
      </div>

      <!-- 4. Suggested New Tags -->
      <div v-if="bookmark.parsedSuggestedNewTags && bookmark.parsedSuggestedNewTags.length > 0">
        <Separator class="my-4"/>
        <div class="flex justify-between items-center mb-2">
          <h4 class="font-semibold text-base">Suggested New Tags:</h4>
          <Dialog>
            <DialogTrigger as-child>
              <Button variant="outline" size="sm" @click="openTagVerificationDialog(bookmark)">
                <Icon name="lucide:tags" class="h-4 w-4 mr-2"/>
                Verify Tags ({{
                  bookmark.parsedSuggestedNewTags.filter(s => s.verificationStatus === 'pending' || s.verificationStatus === 'error').length
                }})
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
        <div class="space-y-1">
          <div v-for="(suggestion, sIndex) in bookmark.parsedSuggestedNewTags" :key="`sugg-${bookmark.$id}-${sIndex}`"
               class="text-xs p-1 border rounded flex justify-between items-center bg-background">
            <span>
              "{{ suggestion.newName }}" (L{{ suggestion.intendedLevel }})
              <span v-if="suggestion.intendedParentName"
                    class="text-muted-foreground"> -> Parent: "{{ suggestion.intendedParentName }}"</span>
            </span>
            <Badge
                :variant="suggestion.verificationStatus === 'approved' ? 'success' : suggestion.verificationStatus === 'rejected' ? 'destructive' : suggestion.verificationStatus === 'error' ? 'destructive' : 'secondary'">
              {{ suggestion.verificationStatus || 'Pending' }}
              <Icon v-if="suggestion.verificationStatus === 'error'" name="lucide:alert-circle" class="ml-1 h-3 w-3"/>
            </Badge>
          </div>
        </div>
      </div>

    </CardContent>
    <CardFooter class="flex justify-end space-x-2">
      <Button
          variant="default"
          @click="handleApproveBookmark(bookmark)"
          :disabled="isApprovingBookmark || (bookmark.parsedSuggestedNewTags?.some(s => s.verificationStatus === 'pending' || s.verificationStatus === 'error'))"
          title="Approve this bookmark (Resolve tag suggestions first)"
      >
        <Icon v-if="isApprovingBookmark" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
        Approve Bookmark
      </Button>
    </CardFooter>
    <Alert v-if="bookmarkApprovalError && selectedBookmarkForTagVerification?.$id === bookmark.$id"
           variant="destructive" class="mt-2 text-xs mx-6 mb-4">
      <Icon name="lucide:alert-triangle" class="h-4 w-4"/>
      <AlertDescription>{{ bookmarkApprovalError }}</AlertDescription>
    </Alert>
  </Card>
</template>
