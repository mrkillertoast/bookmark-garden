<script setup lang="ts">
import { ref } from 'vue';
import { navigateTo } from '#app';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // For errors
import { useAuth } from "~/composables/useAuth";

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);

const { login, isLoading } = useAuth();

async function handleLogin() {
  error.value = null;
  try {
    await login(email.value, password.value);
    await navigateTo('/admin'); // Assuming /admin is your protected route index
  } catch (e: any) {
    console.error('Login failed:', e);
    error.value = e.message || 'An unknown error occurred during login.';
  }
}

</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-background p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-2xl">
          Admin Login
        </CardTitle>
        <CardDescription>
          Enter your email below to login to your account.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <Alert v-if="error" variant="destructive">
          <Icon name="lucide:alert-triangle" class="h-4 w-4"/>
          <AlertTitle>Login Error</AlertTitle>
          <AlertDescription>
            {{ error }}
          </AlertDescription>
        </Alert>

        <div class="grid gap-2">
          <Label for="email">Email</Label>
          <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="m@example.com"
              required
              :disabled="isLoading"
          />
        </div>
        <div class="grid gap-2">
          <Label for="password">Password</Label>
          <Input
              id="password"
              v-model="password"
              type="password"
              required
              :disabled="isLoading"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button class="w-full" :disabled="isLoading" @click="handleLogin">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin"/>
          {{ isLoading ? 'Signing In...' : 'Sign In' }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>

<style scoped>
/* Optional: Add styles if needed */
</style>