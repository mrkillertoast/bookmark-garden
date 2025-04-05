<script setup lang="ts">
import { computed } from 'vue' // Import computed if not already there
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
// No need to import Bookmark type here, define props directly

// Define props for the card component
interface BookmarkCardProps {
  id: string | number;
  imageUrl?: string;
  classificationNames: string[]; // Expects an array of names like ['Development', 'Frontend', 'React']
  title: string;
  description: string;
  url: string;
}

const props = defineProps<BookmarkCardProps>()

const hasImage = computed(() => !!props.imageUrl)

</script>

<template>
  <Card class="flex flex-col h-full">
    <CardHeader v-if="hasImage" class="p-0">
      <img
          :src="props.imageUrl"
          :alt="`Image for ${props.title}`"
          class="aspect-video w-full object-cover rounded-t-lg"
          loading="lazy"
      >
    </CardHeader>
    <CardHeader v-else class="p-0">
      <div class="aspect-video w-full bg-muted rounded-t-lg flex items-center justify-center">
        <Icon name="lucide:image-off" class="h-10 w-10 text-muted-foreground" />
      </div>
    </CardHeader>

    <CardContent class="pt-4 flex-grow">
      <div class="mb-2 flex flex-wrap gap-1">
        <Badge v-for="name in props.classificationNames" :key="name" variant="outline">
          {{ name }}
        </Badge>
      </div>
      <CardTitle class="text-lg mb-1">
        {{ props.title }}
      </CardTitle>
      <CardDescription class="text-sm line-clamp-2">
        {{ props.description }}
      </CardDescription>
    </CardContent>

    <CardFooter class="pt-4 flex justify-between items-center">
      <NuxtLink :to="props.url" target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <Icon name="lucide:external-link" class="mr-2 h-4 w-4" />
          Visit
        </Button>
      </NuxtLink>
      <div class="flex gap-1">
        <Button variant="ghost" size="icon" class="h-8 w-8">
          <Icon name="lucide:pencil" class="h-4 w-4" />
          <span class="sr-only">Edit</span>
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8">
          <Icon name="lucide:trash-2" class="h-4 w-4" />
          <span class="sr-only">Delete</span>
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>

<style scoped>
/* Styles */
</style>