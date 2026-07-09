<script lang="ts">
	import { GraduationCap, Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	import AuthForm from '../components/AuthForm.svelte';
	import Dashboard from '../components/Dashboard.svelte';
	import type { User } from '../types';

	type AuthView =
		'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verify' | 'verify-2fa';

	let token = $state<string | null>(null);
	let user = $state<User | null>(null);
	let darkMode = $state<boolean>(true);

	let preFillView = $state<AuthView>('login');
	let preFillEmail = $state('');
	let preFillCode = $state('');

	function handleSetDarkMode(value: boolean) {
		darkMode = value;
		localStorage.setItem('gdgc_theme', value ? 'dark' : 'light');
	}

	async function handleLogout() {
		if (token) {
			try {
				await fetch('/api/auth/logout', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`
					}
				});
			} catch (error) {
				console.error('Logout log error:', error);
			}
		}

		token = null;
		user = null;

		localStorage.removeItem('gdgc_auth_token');
		localStorage.removeItem('gdgc_auth_user');
	}

	function handleLoginSuccess(newToken: string, loggedInUser: User) {
		token = newToken;
		user = loggedInUser;

		localStorage.setItem('gdgc_auth_token', newToken);
		localStorage.setItem('gdgc_auth_user', JSON.stringify(loggedInUser));
	}

	function handlePreFillReset(email: string, code: string, view: AuthView = 'reset-password') {
		preFillView = view;
		preFillEmail = email;
		preFillCode = code;
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('gdgc_theme');

		if (savedTheme) {
			darkMode = savedTheme === 'dark';
		} else {
			darkMode = true;
		}
	});

	onMount(() => {
		async function checkTokenSession() {
			const savedToken = localStorage.getItem('gdgc_auth_token');
			const savedUserStr = localStorage.getItem('gdgc_auth_user');

			if (savedToken && savedUserStr) {
				try {
					JSON.parse(savedUserStr);

					const res = await fetch('/api/auth/me', {
						headers: {
							Authorization: `Bearer ${savedToken}`
						}
					});

					if (res.ok) {
						const data = await res.json();

						token = savedToken;
						user = data.user;
					} else {
						await handleLogout();
					}
				} catch (error) {
					await handleLogout();
				}
			}
		}

		checkTokenSession();
	});

	onMount(() => {
		const params = new URLSearchParams(window.location.search);

		const view = params.get('view');
		const email = params.get('email');
		const code = params.get('code');

		const allowedViews: AuthView[] = [
			'login',
			'signup',
			'forgot-password',
			'reset-password',
			'verify'
		];

		if (view && allowedViews.includes(view as AuthView)) {
			preFillView = view as AuthView;

			if (email) preFillEmail = decodeURIComponent(email);
			if (code) preFillCode = code;

			window.history.replaceState({}, document.title, window.location.pathname);
		}
	});
</script>

<div
	id="app-theme-wrapper"
	class={`${
		darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
	} min-h-screen font-sans flex flex-col transition-colors duration-300 overflow-x-hidden`}
>
	{#if user && token}
		<div
			key="dashboard-view"
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 150 }}
			class="flex-1 flex flex-col"
		>
			<Dashboard
				{user}
				{token}
				onLogout={handleLogout}
				{darkMode}
				setDarkMode={handleSetDarkMode}
			/>
		</div>
	{:else}
		<div
			class="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"
		/>

		<header
			id="global-navbar"
			class="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40"
		>
			<div class="flex items-center space-x-2.5">
				<div
					class="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md"
				>
					<GraduationCap class="h-5 w-5" />
				</div>

				<div>
					<span
						class="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block font-display"
					>
						GDGC recruitment
					</span>

					<span
						class="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider font-sans"
					>
						Secure Auth Demo
					</span>
				</div>
			</div>

			<div class="flex items-center space-x-4">
				<div
					class="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-900/50 px-2.5 py-1 rounded-full border border-slate-200/40 dark:border-slate-800"
				>
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					<span>Server: Audited Sandbox Online</span>
				</div>

				<button
					id="navbar-theme-toggle"
					onclick={() => handleSetDarkMode(!darkMode)}
					class="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition cursor-pointer"
					title="Toggle theme"
				>
					{#if darkMode}
						<Sun class="h-4 w-4" />
					{:else}
						<Moon class="h-4 w-4 text-amber-400" />
					{/if}
				</button>
			</div>
		</header>

		<main
			id="global-main-container"
			class="flex-1 relative z-10 flex items-center justify-center py-10 px-4"
		>
			<div in:fly={{ y: 15, duration: 200 }} out:fly={{ y: -15, duration: 150 }} class="w-full">
				<AuthForm
					onLoginSuccess={handleLoginSuccess}
					initialView={preFillView}
					initialEmail={preFillEmail}
					initialCode={preFillCode}
				/>
			</div>
		</main>

		<footer
			id="global-footer"
			class="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-200/40 dark:border-slate-800/40 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium"
		>
			<div class="flex items-center space-x-1">
				<span>GDGC Recruitment Submission Portal © 2026</span>
			</div>

			<div class="flex items-center space-x-1.5 mt-2 sm:mt-0 font-mono text-[10px]">
				<span>Security Level: SHA-256 JWT, Bcrypt Salts-10</span>
			</div>
		</footer>
	{/if}
</div>
