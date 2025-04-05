import type { Client, Account, Databases, Avatars } from 'appwrite';

interface AppwriteServices {
	client: Client;
	account: Account;
	databases: Databases;
	avatars: Avatars;
}

declare module '#app' {
	interface NuxtApp {
		$appwrite: AppwriteServices;
	}
}

declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		$appwrite: AppwriteServices;
	}
}

export { };