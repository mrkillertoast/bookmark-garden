<script setup lang="ts">
import { ref, computed, watch } from 'vue' // Add watch
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import BookmarkCard from '@/components/BookmarkCard.vue'
import type { IBookmark } from '~/types';
import { getClassificationNames } from '~/utils/classificationHierarchy';
import { useSelectedL1Id, useSelectedL2Id } from "~/composables/useFilters";

// Use useState to read the shared filter state
const selectedL1Id = useSelectedL1Id()
const selectedL2Id = useSelectedL2Id();

const searchQuery = ref(''); // Existing search state

// Sample data (ensure it includes createdAt dates)
const bookmarks = ref<IBookmark[]>([
  {
    id: 1,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/1280px-React-icon.svg.png',
    classificationIds: [ 'dev', 'frontend', 'react' ],
    title: 'React Documentation',
    description: 'Official documentation for React, a JavaScript library for building user interfaces.',
    url: 'https://react.dev/',
    createdAt: new Date(2025, 3, 4), // Example date
  },
  {
    id: 2,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Node.js_logo.svg/1280px-Node.js_logo.svg.png',
    classificationIds: [ 'dev', 'backend', 'node' ],
    title: 'Node.js',
    description: 'Node.js® is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
    url: 'https://nodejs.org/',
    createdAt: new Date(2025, 3, 1),
    isFavorite: true

  },
  {
    id: 3,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Docker_logo.svg/1280px-Docker_logo.svg.png',
    classificationIds: [ 'dev', 'backend', 'docker' ],
    title: 'Docker',
    description: 'Docker: Accelerate how you build, share, and run applications.',
    url: 'https://www.docker.com/',
    createdAt: new Date(2025, 3, 5), // Today
  },
  {
    id: 4,
    // No image example
    classificationIds: [ 'learn', 'courses' ],
    title: 'Coursera',
    description: 'Learn without limits. Find online courses from top universities.',
    url: 'https://www.coursera.org/',
    createdAt: new Date(2025, 2, 15),
  },
  {
    id: 5,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/1280px-Netflix_2015_logo.svg.png',
    classificationIds: [ 'ent', 'movies' ], // Example L1, L2
    title: 'Netflix',
    description: 'Watch TV shows and movies online.',
    url: 'https://www.netflix.com',
    createdAt: new Date(2025, 1, 10),
  },
  {
    id: 6,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/1024px-Notion-logo.svg.png',
    classificationIds: [ 'prod', 'tools', 'notion' ], // L1, L2, L3
    title: 'Notion',
    description: 'All-in-one workspace for notes, tasks, wikis, and databases.',
    url: 'https://www.notion.so',
    createdAt: new Date(2025, 3, 3),
    isFavorite: true
  },
]);


const showFavoritesOnly = ref(false); // New state for favorites filter

// Function to handle toggling favorite status (will update backend later)
function handleToggleFavorite(bookmarkId: number | string) {
  const bookmark = bookmarks.value.find(b => b.id === bookmarkId);
  if (bookmark) {
    bookmark.isFavorite = !bookmark.isFavorite;
    console.log(`Toggled favorite for ${ bookmarkId } to ${ bookmark.isFavorite }`);
    // TODO: Add Appwrite database update here later
  }
}


const filteredBookmarks = computed<IBookmark[]>(() => {
  let items = bookmarks.value;
  const lowerSearch = searchQuery.value?.toLowerCase() || '';

  // 1. Filter by Favorites (if active)
  if (showFavoritesOnly.value) {
    items = items.filter(bookmark => bookmark.isFavorite);
  }

  // 2. Filter by Selected L1 Category
  if (selectedL1Id.value) {
    items = items.filter(bookmark => bookmark.classificationIds.includes(selectedL1Id.value!));
  }

  // 3. Filter by Selected L2 Category
  if (selectedL2Id.value) {
    items = items.filter(bookmark => bookmark.classificationIds.includes(selectedL2Id.value!));
  }

  // 4. Filter by Search Query
  if (lowerSearch) {
    items = items.filter(bookmark => {
      const tagNames = getClassificationNames(bookmark.classificationIds);
      return bookmark.title.toLowerCase().includes(lowerSearch) ||
          bookmark.description.toLowerCase().includes(lowerSearch) ||
          tagNames.some(name => name.toLowerCase().includes(lowerSearch));
    });
  }

  return items;
});

</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Bookmark Garden</h1>
        <p class="text-muted-foreground">Organize and access your favorite websites</p>
      </div>
      <div>
        <Button>
          <Icon name="lucide:plus" class="mr-2 h-4 w-4"/>
          Add Bookmark
        </Button>
      </div>
    </div>

    <div class="flex justify-between items-center mb-6 gap-4">
      <div class="relative flex-grow max-w-xs">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input
            v-model="searchQuery"
            type="search"
            placeholder="Search bookmarks..."
            class="w-full pl-9"
        />
      </div>

      <div class="flex items-center gap-2">
        <Button
            variant="outline"
            @click="showFavoritesOnly = !showFavoritesOnly"
            :class="{ 'bg-accent text-accent-foreground': showFavoritesOnly }"
        >
          <Icon name="lucide:star" class="mr-2 h-4 w-4" :class="{'fill-current': showFavoritesOnly}"/>
          Favorites
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <BookmarkCard
          v-for="bookmark in filteredBookmarks"
          :key="bookmark.id"
          :id="bookmark.id"
          :image-url="bookmark.imageUrl"
          :classification-names="getClassificationNames(bookmark.classificationIds)"
          :title="bookmark.title"
          :description="bookmark.description"
          :url="bookmark.url"
          :is-favorite="bookmark.isFavorite ?? false" @toggle-favorite="handleToggleFavorite"/>
      <p v-if="filteredBookmarks.length === 0" class="col-span-full text-center text-muted-foreground">
        No bookmarks found matching your criteria.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Page-specific styles if needed */
</style>