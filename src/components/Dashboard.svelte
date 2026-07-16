<script lang="ts">
	import {
		Clock,
		GraduationCap,
		LayoutDashboard,
		LogOut,
		Moon,
		Shield,
		ShieldAlert,
		Sun
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	import type { ActivityLog, User as UserType } from '../types';

	import AdminManagement from './AdminManagement.svelte';
	import CandidateHub from './CandidateHub.svelte';
	import SecurityCenter from './SecurityCenter.svelte';

	type ActiveTab = 'hub' | 'security' | 'admin';

	type AdminUser = UserType & {
		id?: string;
	};

	type AdminStats = {
		totalUsers: number;
		verifiedUsers: number;
		mfaUsers: number;
		totalLogins: number;
	};

	type PasswordStrength = {
		score: number;
		label: string;
		color: string;
		hasMinLength?: boolean;
		hasUpper?: boolean;
		hasLower?: boolean;
		hasNumber?: boolean;
		hasSpecial?: boolean;
	};

	type SecurityGrade = {
		label: string;
		color: string;
		bg: string;
		border: string;
	};

	type Props = {
		user: UserType;
		token: string;
		onLogout: () => void | Promise<void>;
		darkMode: boolean;
		setDarkMode: (value: boolean) => void;
	};

	let { user, token, onLogout, darkMode, setDarkMode }: Props = $props();

	let activeTab = $state<ActiveTab>('hub');

	// Security Center state
	let logs = $state<ActivityLog[]>([]);
	let twoFactor = $state(Boolean(user.twoFactorEnabled));
	let currentPassword = $state('');
	let newPassword = $state('');
	let pwdError = $state<string | null>(null);
	let pwdSuccess = $state<string | null>(null);
	let isUpdatingPwd = $state(false);

	// Resume upload simulation
	let resumeUploaded = $state(false);
	let isUploading = $state(false);
	let resumeName = $state('');

	// Admin state
	let adminUsers = $state<AdminUser[]>([]);
	let adminLogs = $state<ActivityLog[]>([]);
	let adminStats = $state<AdminStats>({
		totalUsers: 0,
		verifiedUsers: 0,
		mfaUsers: 0,
		totalLogins: 0
	});

	// Session expiry simulation: 15 minutes
	let sessionSecondsLeft = $state(900);
	let showSessionWarning = $state(false);

	function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	async function fetchLogs(): Promise<void> {
		try {
			const response = await fetch('/api/auth/logs', {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) return;

			const data = (await response.json()) as {
				logs?: ActivityLog[];
			};

			logs = data.logs ?? [];
		} catch (error) {
			console.warn('Error loading user logs (transient network state):', error);
		}
	}

	async function fetchAdminData(): Promise<void> {
		if (user.role?.toLowerCase() !== 'admin') {
			console.warn('Admin data was not loaded because the user role is:', user.role);
			return;
		}

		try {
			const headers = {
				Authorization: `Bearer ${token}`
			};

			const [usersResponse, logsResponse, statsResponse] = await Promise.all([
				fetch('/api/admin/users', { headers }),
				fetch('/api/admin/logs', { headers }),
				fetch('/api/admin/stats', { headers })
			]);

			const usersData = await usersResponse.json().catch(() => ({}));
			const logsData = await logsResponse.json().catch(() => ({}));
			const statsData = await statsResponse.json().catch(() => ({}));

			if (!usersResponse.ok) {
				throw new Error(
					usersData.error || `Users request failed with status ${usersResponse.status}`
				);
			}

			if (!logsResponse.ok) {
				throw new Error(logsData.error || `Logs request failed with status ${logsResponse.status}`);
			}

			if (!statsResponse.ok) {
				throw new Error(
					statsData.error || `Stats request failed with status ${statsResponse.status}`
				);
			}

			const receivedUsers = Array.isArray(usersData) ? usersData : usersData.users;

			const receivedLogs = Array.isArray(logsData) ? logsData : logsData.logs;

			adminUsers = Array.isArray(receivedUsers)
				? receivedUsers.map((item) => ({
						...item,
						id: item.id ?? item.uid ?? item._id
					}))
				: [];

			adminLogs = Array.isArray(receivedLogs) ? receivedLogs : [];

			adminStats = statsData.stats ??
				statsData ?? {
					totalUsers: 0,
					verifiedUsers: 0,
					mfaUsers: 0,
					totalLogins: 0
				};

			console.log('Loaded admin users:', adminUsers);
			console.log('Loaded admin logs:', adminLogs);
			console.log('Loaded admin stats:', adminStats);
		} catch (error) {
			console.error('Failed to load admin dashboard data:', error);

			adminUsers = [];
			adminLogs = [];
		}
	}

	function handleExtendSession(): void {
		sessionSecondsLeft = 900;
		showSessionWarning = false;
	}

	async function handleToggle2FA(): Promise<void> {
		try {
			const response = await fetch('/api/auth/toggle-2fa', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) return;

			const data = (await response.json()) as {
				twoFactorEnabled: boolean;
			};

			twoFactor = data.twoFactorEnabled;

			await fetchLogs();

			if (user.role === 'admin') {
				await fetchAdminData();
			}
		} catch (error) {
			console.error('Error toggling Two-Factor status:', error);
		}
	}

	async function handlePasswordUpdate(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		pwdError = null;
		pwdSuccess = null;

		if (!currentPassword) {
			pwdError = 'Current password is required';
			return;
		}

		if (!newPassword) {
			pwdError = 'New password is required';
			return;
		}

		if (newPassword.length < 8) {
			pwdError = 'New password must be at least 8 characters';
			return;
		}

		isUpdatingPwd = true;

		try {
			const response = await fetch('/api/auth/update-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					currentPassword,
					newPassword
				})
			});

			const data = (await response.json()) as {
				error?: string;
			};

			if (!response.ok) {
				throw new Error(data.error ?? 'Password update failed');
			}

			pwdSuccess = 'Password changed successfully! Keep your new credentials secure.';

			currentPassword = '';
			newPassword = '';

			await fetchLogs();
		} catch (error) {
			pwdError = getErrorMessage(error, 'Password update failed');
		} finally {
			isUpdatingPwd = false;
		}
	}

	function handleResumeUploadSimulate(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		isUploading = true;
		resumeUploaded = false;
		resumeName = file.name;

		window.setTimeout(() => {
			isUploading = false;
			resumeUploaded = true;
		}, 1500);
	}

	async function handleDeleteUser(targetId: string): Promise<void> {
		const confirmed = window.confirm(
			'CRITICAL: Are you sure you want to permanently delete this candidate? This action cannot be undone.'
		);

		if (!confirmed) return;

		try {
			const response = await fetch(`/api/admin/users/${targetId}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) {
				const data = (await response.json()) as {
					error?: string;
				};

				throw new Error(data.error ?? 'Failed to delete user');
			}

			await fetchAdminData();
		} catch (error) {
			window.alert(getErrorMessage(error, 'Failed to delete user'));
		}
	}

	function getSecurityScore(): number {
		let securityScore = 40;

		if (user.isVerified) {
			securityScore += 30;
		}

		if (twoFactor) {
			securityScore += 30;
		}

		return securityScore;
	}

	function getSecurityGrade(securityScore: number): SecurityGrade {
		if (securityScore >= 100) {
			return {
				label: 'Excellent',
				color: 'text-emerald-500',
				bg: 'bg-emerald-500/10',
				border: 'border-emerald-500/20'
			};
		}

		if (securityScore >= 70) {
			return {
				label: 'Medium Safety',
				color: 'text-yellow-500',
				bg: 'bg-yellow-500/10',
				border: 'border-yellow-500/20'
			};
		}

		return {
			label: 'Vulnerable',
			color: 'text-red-500',
			bg: 'bg-red-500/10',
			border: 'border-red-500/20'
		};
	}

	function formatTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
	}

	function getPasswordStrength(passwordValue: string): PasswordStrength {
		if (!passwordValue) {
			return {
				score: 0,
				label: 'None',
				color: 'bg-slate-300'
			};
		}

		let strengthScore = 0;

		const hasMinLength = passwordValue.length >= 8;
		const hasUpper = /[A-Z]/.test(passwordValue);
		const hasLower = /[a-z]/.test(passwordValue);
		const hasNumber = /[0-9]/.test(passwordValue);
		const hasSpecial = /[^A-Za-z0-9]/.test(passwordValue);

		if (hasMinLength) strengthScore += 25;
		if (hasUpper) strengthScore += 25;
		if (hasLower) strengthScore += 25;
		if (hasNumber || hasSpecial) strengthScore += 25;

		let label = 'Weak';
		let color = 'bg-red-500';

		if (strengthScore >= 100) {
			label = 'Strong';
			color = 'bg-emerald-500';
		} else if (strengthScore >= 50) {
			label = 'Moderate';
			color = 'bg-amber-500';
		}

		return {
			score: strengthScore,
			label,
			color,
			hasMinLength,
			hasUpper,
			hasLower,
			hasNumber,
			hasSpecial
		};
	}

	function changeActiveTab(tab: ActiveTab): void {
		activeTab = tab;
	}

	function setCurrentPassword(value: string): void {
		currentPassword = value;
	}

	function setNewPassword(value: string): void {
		newPassword = value;
	}

	let score = $derived(getSecurityScore());
	let grade = $derived(getSecurityGrade(score));
	let passwordStrength = $derived(getPasswordStrength(newPassword));

	onMount(() => {
		void fetchLogs();

		if (user.role === 'admin') {
			activeTab = 'admin';
			void fetchAdminData();
		}

		const timer = window.setInterval(() => {
			if (sessionSecondsLeft <= 1) {
				window.clearInterval(timer);
				sessionSecondsLeft = 0;
				void onLogout();
				return;
			}

			if (sessionSecondsLeft === 300) {
				showSessionWarning = true;
			}

			sessionSecondsLeft -= 1;
		}, 1000);

		return () => {
			window.clearInterval(timer);
		};
	});
</script>

<div
	id="dashboard-layout"
	class="flex min-h-screen flex-1 flex-col bg-slate-50 transition-all duration-300 md:flex-row dark:bg-slate-950"
>
	<!-- Desktop sidebar -->
	<aside
		class="hidden min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 transition-all duration-300 md:flex md:w-64 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-300"
	>
		<div
			class="flex items-center space-x-3 border-b border-slate-200/60 p-6 dark:border-slate-800/60"
		>
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm"
			>
				<GraduationCap class="h-5 w-5" />
			</div>

			<div>
				<span
					class="font-display block text-sm font-black tracking-tight text-slate-900 dark:text-white"
				>
					GDGC Secure
				</span>

				<span
					class="block font-sans text-[10px] font-bold tracking-widest text-indigo-600 uppercase dark:text-indigo-400"
				>
					Portal
				</span>
			</div>
		</div>

		<nav class="flex-1 space-y-1.5 px-4 py-6">
			{#if user.role === 'admin'}
				<button
					type="button"
					onclick={() => changeActiveTab('admin')}
					class={`flex w-full cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 text-left text-xs font-semibold transition ${
						activeTab === 'admin'
							? 'border border-indigo-500/10 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-600/15 dark:text-indigo-400'
							: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white'
					}`}
				>
					<LayoutDashboard class="h-4 w-4 shrink-0" />
					<span>Admin Console</span>
				</button>

				<button
					type="button"
					onclick={() => changeActiveTab('security')}
					class={`flex w-full cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 text-left text-xs font-semibold transition ${
						activeTab === 'security'
							? 'border border-indigo-500/10 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-600/15 dark:text-indigo-400'
							: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white'
					}`}
				>
					<Shield class="h-4 w-4 shrink-0" />
					<span>My Security Center</span>
				</button>
			{:else}
				<button
					type="button"
					onclick={() => changeActiveTab('hub')}
					class={`flex w-full cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 text-left text-xs font-semibold transition ${
						activeTab === 'hub'
							? 'border border-indigo-500/10 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-600/15 dark:text-indigo-400'
							: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white'
					}`}
				>
					<LayoutDashboard class="h-4 w-4 shrink-0" />
					<span>Candidate Hub</span>
				</button>

				<button
					type="button"
					onclick={() => changeActiveTab('security')}
					class={`flex w-full cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 text-left text-xs font-semibold transition ${
						activeTab === 'security'
							? 'border border-indigo-500/10 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-600/15 dark:text-indigo-400'
							: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white'
					}`}
				>
					<Shield class="h-4 w-4 shrink-0" />
					<span>My Security Center</span>
				</button>
			{/if}
		</nav>

		<div
			class="mt-auto border-t border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
		>
			<div
				class="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800/40 dark:bg-slate-800/30"
			>
				<div class="mb-3 flex items-center space-x-2">
					<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>

					<span
						class="font-mono text-[10px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400"
					>
						{user.role === 'admin' ? 'Role: Admin' : 'Role: Candidate'}
					</span>
				</div>

				<div class="flex items-center space-x-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/15 text-xs font-extrabold text-indigo-600 dark:text-indigo-400"
					>
						{user.name.charAt(0)}
					</div>

					<div class="min-w-0 flex-1">
						<p class="truncate text-xs font-bold text-slate-900 dark:text-white">
							{user.name}
						</p>

						<p class="truncate text-[10px] text-slate-500">
							{user.email}
						</p>
					</div>
				</div>
			</div>
		</div>
	</aside>

	<!-- Main work area -->
	<main class="flex min-h-screen min-w-0 flex-1 flex-col">
		<header
			class="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 transition-all duration-300 md:px-8 dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="flex items-center space-x-3">
				<div class="mr-2 flex items-center space-x-2 md:hidden">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm"
					>
						<GraduationCap class="h-5 w-5" />
					</div>
				</div>

				<div>
					<h1
						class="font-display text-sm font-bold tracking-tight text-slate-800 md:text-base dark:text-white"
					>
						{activeTab === 'hub'
							? 'GDGC Candidate Dashboard'
							: activeTab === 'admin'
								? 'Admin Security Audit Console'
								: 'My Account Security Control Center'}
					</h1>

					<p class="hidden text-[10px] font-medium text-slate-400 sm:block dark:text-slate-400">
						{activeTab === 'hub'
							? 'Manage your application checklist and secure documents'
							: activeTab === 'admin'
								? 'Verify student registration listings and audit telemetry logs'
								: 'Configure two-factor keys and change account passwords'}
					</p>
				</div>
			</div>

			<div class="flex items-center space-x-3">
				<div
					class="flex items-center space-x-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-400"
				>
					<Clock class="h-3.5 w-3.5 shrink-0 text-indigo-500" />
					<span class="font-semibold">
						{formatTime(sessionSecondsLeft)}
					</span>
				</div>

				<button
					id="header-theme-toggle"
					type="button"
					onclick={() => setDarkMode(!darkMode)}
					class="cursor-pointer rounded-xl border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
					title="Toggle visual mode"
					aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
				>
					{#if darkMode}
						<Sun class="h-4 w-4" />
					{:else}
						<Moon class="h-4 w-4 text-amber-400" />
					{/if}
				</button>

				<button
					id="header-logout-btn"
					type="button"
					onclick={() => void onLogout()}
					class="flex shrink-0 cursor-pointer items-center space-x-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
				>
					<LogOut class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">Secure Logout</span>
				</button>
			</div>
		</header>

		<!-- Mobile navigation -->
		<div
			class="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white p-2.5 md:hidden dark:border-slate-800 dark:bg-slate-900"
		>
			{#if user.role === 'admin'}
				<button
					type="button"
					onclick={() => changeActiveTab('admin')}
					class={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
						activeTab === 'admin'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800/40 dark:bg-slate-950 dark:text-slate-400'
					}`}
				>
					Admin Dashboard
				</button>

				<button
					type="button"
					onclick={() => changeActiveTab('security')}
					class={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
						activeTab === 'security'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800/40 dark:bg-slate-950 dark:text-slate-400'
					}`}
				>
					Security Center
				</button>
			{:else}
				<button
					type="button"
					onclick={() => changeActiveTab('hub')}
					class={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
						activeTab === 'hub'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800/40 dark:bg-slate-950 dark:text-slate-400'
					}`}
				>
					Candidate Hub
				</button>

				<button
					type="button"
					onclick={() => changeActiveTab('security')}
					class={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
						activeTab === 'security'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800/40 dark:bg-slate-950 dark:text-slate-400'
					}`}
				>
					Security Center
				</button>
			{/if}
		</div>

		<div class="flex-1 space-y-6 overflow-y-auto p-6 md:p-8">
			{#if showSessionWarning}
				<div
					id="session-expiry-warning"
					in:fly={{
						y: -20,
						opacity: 0,
						duration: 200
					}}
					class="flex flex-col gap-3 rounded-xl border border-amber-600 bg-amber-500 p-4 text-slate-950 shadow-lg sm:flex-row sm:items-center sm:justify-between"
				>
					<div class="flex items-center space-x-2.5">
						<ShieldAlert class="h-5 w-5 shrink-0 animate-bounce" />

						<div>
							<p class="text-sm font-bold">Security Session Expiration Warning</p>

							<p class="text-xs font-medium">
								To protect your candidate recruitment portfolio, your secure token will expire in
								<span class="font-bold underline">
									{formatTime(sessionSecondsLeft)}
								</span>
								mins due to inactivity rules.
							</p>
						</div>
					</div>

					<button
						id="extend-session-btn"
						type="button"
						onclick={handleExtendSession}
						class="shrink-0 cursor-pointer rounded-lg bg-slate-950 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-900"
					>
						Renew Session Token
					</button>
				</div>
			{/if}

			<!-- Dashboard overview cards -->
			<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
				<div
					class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
				>
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
							Account Status
						</span>

						<span
							class={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-wider ${
								user.isVerified
									? 'border-emerald-200/50 bg-emerald-50 text-emerald-600 dark:border-emerald-900/10 dark:bg-emerald-950/40 dark:text-emerald-400'
									: 'border-amber-200/50 bg-amber-50 text-amber-600 dark:border-amber-900/10 dark:bg-amber-950/40 dark:text-amber-400'
							}`}
						>
							{user.isVerified ? 'VERIFIED' : 'PENDING'}
						</span>
					</div>

					<div class="mt-2">
						<p class="font-display text-lg font-bold text-slate-800 dark:text-white">
							Secure Access
						</p>

						<p class="mt-1 text-xs text-slate-400">
							{twoFactor ? 'Two-Factor Authentication active' : 'Password verification only'}
						</p>
					</div>
				</div>

				<div
					class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
				>
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
							Session Health
						</span>

						<span
							class="rounded-full border border-blue-200/50 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-blue-600 dark:border-blue-900/10 dark:bg-blue-950/40 dark:text-blue-400"
						>
							STABLE
						</span>
					</div>

					<div class="mt-2">
						<p class="font-display text-lg font-bold text-slate-800 dark:text-white">
							Active Session
						</p>

						<p class="mt-1 text-xs text-slate-400">
							Secure token expires in
							{formatTime(sessionSecondsLeft)} mins
						</p>
					</div>
				</div>

				<div
					class="flex flex-col justify-between rounded-2xl border border-indigo-500/20 bg-indigo-50/15 p-5 shadow-sm transition-all duration-300 dark:bg-indigo-950/10"
				>
					<div class="mb-2 flex items-center justify-between">
						<span
							class="text-xs font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-400"
						>
							Security Score
						</span>

						<div class="h-7 w-7">
							<svg
								viewBox="0 0 36 36"
								class="h-full w-full"
								aria-label={`Security score: ${score} out of 100`}
							>
								<path
									class="stroke-indigo-100 dark:stroke-slate-900"
									stroke-width="4"
									fill="none"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								></path>

								<path
									class="stroke-indigo-600 dark:stroke-indigo-400"
									stroke-dasharray={`${score}, 100`}
									stroke-width="4"
									stroke-linecap="round"
									fill="none"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								></path>
							</svg>
						</div>
					</div>

					<div class="mt-2">
						<p class="font-display text-lg font-bold text-indigo-900 dark:text-indigo-300">
							{score} / 100
						</p>

						<p class="mt-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
							{grade.label} (Bcrypt verification)
						</p>
					</div>
				</div>
			</div>

			<!-- Active tab -->
			{#if activeTab === 'hub' && user.role !== 'admin'}
				<CandidateHub
					{user}
					{twoFactor}
					{resumeUploaded}
					{isUploading}
					{resumeName}
					{handleResumeUploadSimulate}
					setActiveTab={changeActiveTab}
				/>
			{:else if activeTab === 'security'}
				<SecurityCenter
					{user}
					{logs}
					{twoFactor}
					{handleToggle2FA}
					{currentPassword}
					{setCurrentPassword}
					{newPassword}
					{setNewPassword}
					{pwdError}
					{pwdSuccess}
					{isUpdatingPwd}
					{handlePasswordUpdate}
					{fetchLogs}
					{passwordStrength}
				/>
			{:else if activeTab === 'admin' && user.role === 'admin'}
				<AdminManagement
					{adminStats}
					{adminUsers}
					{adminLogs}
					{fetchAdminData}
					{handleDeleteUser}
				/>
			{/if}
		</div>
	</main>
</div>
