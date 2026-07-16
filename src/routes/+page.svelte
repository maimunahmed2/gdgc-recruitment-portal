<script lang="ts">
	import { GraduationCap, Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	import AuthForm from '../components/AuthForm.svelte';
	import Dashboard from '../components/Dashboard.svelte';
	import type { User } from '../types';

	type AuthView =
		'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verify' | 'verify-2fa';

	type CurrentUserResponse = {
		user: User;
	};

	let token = $state<string | null>(null);
	let user = $state<User | null>(null);
	let darkMode = $state(true);

	// Values passed to AuthForm from verification and reset links.
	let preFillView = $state<AuthView>('login');
	let preFillEmail = $state('');
	let preFillCode = $state('');

	/**
	 * Keep the root HTML element synchronized with the selected theme.
	 * This makes dark mode work in dialogs and components outside this wrapper.
	 */
	$effect(() => {
		if (typeof document === 'undefined') return;

		document.documentElement.classList.toggle('dark', darkMode);
		document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
	});

	function handleSetDarkMode(value: boolean): void {
		darkMode = value;

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('gdgc_theme', value ? 'dark' : 'light');
		}
	}

	function clearLocalSession(): void {
		token = null;
		user = null;

		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('gdgc_auth_token');
			localStorage.removeItem('gdgc_auth_user');
		}
	}

	async function restoreSession(): Promise<void> {
		const savedToken = localStorage.getItem('gdgc_auth_token');
		const savedUserString = localStorage.getItem('gdgc_auth_user');

		if (!savedToken || !savedUserString) {
			return;
		}

		try {
			// Confirm that the stored user value contains valid JSON.
			JSON.parse(savedUserString);

			// Ask the backend whether the token is still valid.
			const response = await fetch('/api/auth/me', {
				headers: {
					Authorization: `Bearer ${savedToken}`
				}
			});

			if (!response.ok) {
				clearLocalSession();
				return;
			}

			const data = (await response.json()) as CurrentUserResponse;

			if (!data.user) {
				clearLocalSession();
				return;
			}

			token = savedToken;
			user = data.user;

			// Refresh the locally cached user with the backend response.
			localStorage.setItem('gdgc_auth_user', JSON.stringify(data.user));
		} catch (error) {
			console.error('Session restoration failed:', error);
			clearLocalSession();
		}
	}

	function processUrlParameters(): void {
		const parameters = new URLSearchParams(window.location.search);

		const requestedView = parameters.get('view');
		const requestedEmail = parameters.get('email');
		const requestedCode = parameters.get('code');

		const allowedViews: AuthView[] = [
			'login',
			'signup',
			'forgot-password',
			'reset-password',
			'verify',
			'verify-2fa'
		];

		if (!requestedView || !allowedViews.includes(requestedView as AuthView)) {
			return;
		}

		preFillView = requestedView as AuthView;

		/*
		 * URLSearchParams automatically decodes URL-encoded values,
		 * so decodeURIComponent is not necessary.
		 */
		if (requestedEmail) {
			preFillEmail = requestedEmail;
		}

		if (requestedCode) {
			preFillCode = requestedCode;
		}

		// Remove email, OTP and view parameters from the visible URL.
		window.history.replaceState({}, document.title, window.location.pathname);
	}

	function handleLoginSuccess(newToken: string, loggedInUser: User): void {
		token = newToken;
		user = loggedInUser;

		localStorage.setItem('gdgc_auth_token', newToken);
		localStorage.setItem('gdgc_auth_user', JSON.stringify(loggedInUser));
	}

	async function handleLogout(): Promise<void> {
		// Store the current value before changing the reactive state.
		const currentToken = token;

		if (currentToken) {
			try {
				await fetch('/api/auth/logout', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${currentToken}`
					}
				});
			} catch (error) {
				console.error('Logout log error:', error);
			}
		}

		clearLocalSession();
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('gdgc_theme');

		darkMode = savedTheme ? savedTheme === 'dark' : true;

		processUrlParameters();
		void restoreSession();
	});
</script>

<div
	id="app-theme-wrapper"
	class={`${
		darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
	} min-h-screen overflow-x-hidden font-sans flex flex-col transition-colors duration-300`}
>
	{#if user && token}
		<!-- Logged-in dashboard -->
		<div class="flex flex-1 flex-col" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
			<Dashboard
				{user}
				{token}
				onLogout={handleLogout}
				{darkMode}
				setDarkMode={handleSetDarkMode}
			/>
		</div>
	{:else}
		<!-- Background decoration -->
		<div
			class="pointer-events-none absolute top-0 right-0 left-0 h-96 bg-gradient-to-b from-indigo-500/5 to-transparent"
		></div>

		<!-- Navigation bar -->
		<header
			id="global-navbar"
			class="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between border-b border-slate-200/40 px-6 py-5 dark:border-slate-800/40"
		>
			<div class="flex items-center space-x-2.5">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md"
				>
					<GraduationCap class="h-5 w-5" />
				</div>

				<div>
					<span
						class="font-display block text-sm font-extrabold tracking-tight text-slate-900 dark:text-white"
					>
						GDGC Portal
					</span>

					<span
						class="block font-sans text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
					>
						Secure Auth
					</span>
				</div>
			</div>

			<div class="flex items-center space-x-4">
				<!-- Server status -->
				<div
					class="hidden items-center space-x-1.5 rounded-full border border-slate-200/40 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 sm:flex dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
				>
					<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>

					<span>System Status: Operational</span>
				</div>

				<!-- Theme toggle -->
				<button
					id="navbar-theme-toggle"
					type="button"
					onclick={() => handleSetDarkMode(!darkMode)}
					class="flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
					title="Toggle theme"
					aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
				>
					{#if darkMode}
						<Sun class="h-4 w-4" />
					{:else}
						<Moon class="h-4 w-4 text-amber-400" />
					{/if}
				</button>
			</div>
		</header>

		<!-- Authentication content -->
		<main
			id="global-main-container"
			class="relative z-10 flex flex-1 items-center justify-center px-4 py-10"
		>
			<div
				class="w-full"
				in:fly={{
					y: 15,
					opacity: 0,
					duration: 200
				}}
				out:fly={{
					y: -15,
					opacity: 0,
					duration: 150
				}}
			>
				<AuthForm
					onLoginSuccess={handleLoginSuccess}
					initialView={preFillView}
					initialEmail={preFillEmail}
					initialCode={preFillCode}
				/>
			</div>
		</main>

		<!-- Footer -->
		<footer
			id="global-footer"
			class="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between border-t border-slate-200/40 px-6 py-6 text-xs font-medium text-slate-500 sm:flex-row dark:border-slate-800/40 dark:text-slate-400"
		>
			<div class="flex items-center space-x-1">
				<span> GDGC Recruitment Submission Portal © 2026 </span>
			</div>

			<div class="mt-2 flex items-center space-x-1.5 font-mono text-[10px] sm:mt-0">
				<span> Security Level: SHA-256 JWT, Bcrypt Salts-10 </span>
			</div>
		</footer>
	{/if}
</div>
