import { useAuth } from "#imports";

export default defineNuxtRouteMiddleware(async (to) => {
	const { currentUser, isLoading, fetchCurrentUser } = useAuth();

	// Check session on first load
	if (isLoading.value) {
		await fetchCurrentUser();
	}

	// If route requires auth and user is not logged in
	if (to.meta.requiresAuth && !currentUser.value) {
		return navigateTo('/login');
	}

	// If user is logged in and trying to access auth pages (login/register)
	if (currentUser.value && to.meta.authPage) {
		return navigateTo('/admin');
	}
});