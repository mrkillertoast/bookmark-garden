<script setup lang="ts">
// pages/index.vue (script section)
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import BookmarkCard from '@/components/BookmarkCard.vue'

// Import the Bookmark type
import type { IBookmark } from '~/types'; // Adjust path if needed

// Import the helper function to get names for the card
import { getClassificationNames } from '~/utils/classificationHierarchy';


const activeTab = ref('all')
const searchQuery = ref('')

// Define sample data using the updated Bookmark type and classificationIds
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
  },
])

// Filtering logic - TO BE IMPLEMENTED PROPERLY LATER
// This needs access to selected L1/L2 IDs from sidebar (via Pinia/provide/etc.)
const filteredBookmarks = computed(() => {
  // Placeholder: Add actual filtering based on searchQuery, activeTab, and selected sidebar categories
  return bookmarks.value.filter(bookmark => {
    // Basic search filter (remains the same)
    if (searchQuery.value && !bookmark.title.toLowerCase().includes(searchQuery.value.toLowerCase())) {
      return false;
    }
    // TODO: Add filtering based on activeTab ('recent' needs date logic)
    // TODO: Add filtering based on selected L1/L2 IDs from sidebar state

    return true; // Include if not filtered out
  });
})


</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Bookmark Garden
        </h1>
        <p class="text-muted-foreground">
          Organize and access your favorite websites
        </p>
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
            v-model="searchQuery" type="search"
            placeholder="Search bookmarks..."
            class="w-full pl-9"
        />
      </div>
      <div class="flex items-center gap-2">
        <Tabs v-model="activeTab" default-value="all">
          <TabsList>
            <TabsTrigger value="all">
              All Bookmarks
            </TabsTrigger>
            <TabsTrigger value="recent">
              Recently Added
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="icon">
          <Icon name="lucide:list-filter" class="h-4 w-4"/>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <BookmarkCard
          v-for="bookmark in filteredBookmarks"
          :key="bookmark.id"
          :id="bookmark.id"
          :image-url="bookmark.imageUrl"
          :classification-names="getClassificationNames(bookmark.classificationIds)" :title="bookmark.title"
          :description="bookmark.description"
          :url="bookmark.url"
      />
      <p v-if="filteredBookmarks.length === 0" class="col-span-full text-center text-muted-foreground">
        No bookmarks found.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Page-specific styles if needed */
</style>