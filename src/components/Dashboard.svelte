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

	interface DashboardProps {
		user: UserType;
		token: string;
		onLogout: () => void;
		darkMode: boolean;
		setDarkMode: (value: boolean) => void;
	}

	interface AdminStats {
		totalUsers: number;
		verifiedUsers: number;
		mfaUsers: number;
		totalLogins: number;
	}

	let { user, token, onLogout, darkMode, setDarkMode }: DashboardProps = $props();

	let activeTab = $state<ActiveTab>('hub');

	let logs = $state<ActivityLog[]>([]);
	let twoFactor = $state(!!user.twoFactorEnabled);
	let currentPassword = $state('');
	let newPassword = $state('');
	let pwdError = $state<string | null>(null);
	let pwdSuccess = $state<string | null>(null);
	let isUpdatingPwd = $state(false);

	let resumeUploaded = $state(false);
	let isUploading = $state(false);
	let resumeName = $state('');

	let adminUsers = $state<UserType[]>([]);
	let adminLogs = $state<ActivityLog[]>([]);
	let adminStats = $state<AdminStats>({
		totalUsers: 0,
		verifiedUsers: 0,
		mfaUsers: 0,
		totalLogins: 0
	});

	let sessionSecondsLeft = $state(900);
	let showSessionWarning = $state(false);

	let isAdmin = $derived(user.role === 'admin');

	let pageTitle = $derived(
		activeTab === 'hub'
			? 'GDGC Recruitment Candidate Hub'
			: activeTab === 'admin'
				? 'Admin Security Audit Console'
				: 'My Account Security Control Center'
	);

	let pageSubtitle = $derived(
		activeTab === 'hub'
			? 'Manage your application checklist and secure documents'
			: activeTab === 'admin'
				? 'Verify student registration listings and audit telemetry logs'
				: 'Configure two-factor keys and change account passwords'
	);

	async function fetchLogs() {
		try {
			const res = await fetch('/api/auth/logs', {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (res.ok) {
				const data = await res.json();
				logs = data.logs;
			}
		} catch (error) {
			console.warn('Error loading user logs (transient network state):', error);
		}
	}

	async function fetchAdminData() {
		if (user.role !== 'admin') return;

		try {
			const headers = {
				Authorization: `Bearer ${token}`
			};

			const [usersRes, logsRes, statsRes] = await Promise.all([
				fetch('/api/admin/users', { headers }),
				fetch('/api/admin/logs', { headers }),
				fetch('/api/admin/stats', { headers })
			]);

			if (usersRes.ok) {
				const data = await usersRes.json();
				adminUsers = data.users;
			}

			if (logsRes.ok) {
				const data = await logsRes.json();
				adminLogs = data.logs;
			}

			if (statsRes.ok) {
				const data = await statsRes.json();
				adminStats = data.stats;
			}
		} catch (error) {
			console.warn('Failed to load admin logs/statistics (transient network state):', error);
		}
	}

	$effect(() => {
		fetchLogs();

		if (user.role === 'admin') {
			fetchAdminData();
			activeTab = 'admin';
		}
	});

	onMount(() => {
		const timer = setInterval(() => {
			if (sessionSecondsLeft <= 1) {
				clearInterval(timer);
				onLogout();
				sessionSecondsLeft = 0;
				return;
			}

			if (sessionSecondsLeft === 300) {
				showSessionWarning = true;
			}

			sessionSecondsLeft -= 1;
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	});

	function handleExtendSession() {
		sessionSecondsLeft = 900;
		showSessionWarning = false;
	}

	async function handleToggle2FA() {
		try {
			const res = await fetch('/api/auth/toggle-2fa', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				}
			});

			if (res.ok) {
				const data = await res.json();

				twoFactor = data.twoFactorEnabled;
				fetchLogs();

				if (user.role === 'admin') {
					fetchAdminData();
				}
			}
		} catch (error) {
			console.error('Error toggling Two-Factor status:', error);
		}
	}

	async function handlePasswordUpdate(event: SubmitEvent) {
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
			const res = await fetch('/api/auth/update-password', {
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

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Password update failed');
			}

			pwdSuccess = 'Password changed successfully! Keep your new credentials secure.';
			currentPassword = '';
			newPassword = '';

			fetchLogs();
		} catch (err: any) {
			pwdError = err.message;
		} finally {
			isUpdatingPwd = false;
		}
	}

	function handleResumeUploadSimulate(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		isUploading = true;
		resumeName = file.name;

		setTimeout(() => {
			isUploading = false;
			resumeUploaded = true;
		}, 1500);
	}

	async function handleDeleteUser(targetId: string) {
		const confirmed = confirm(
			'CRITICAL: Are you sure you want to permanently delete this candidate? This action cannot be undone.'
		);

		if (!confirmed) return;

		try {
			const res = await fetch(`/api/admin/users/${targetId}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete user');
			}

			fetchAdminData();
		} catch (err: any) {
			alert(err.message);
		}
	}

	function getSecurityScore() {
		let score = 40;

		if (user.isVerified) score += 30;
		if (twoFactor) score += 30;

		return score;
	}

	function getSecurityGrade(score: number) {
		if (score >= 100) {
			return {
				label: 'Excellent',
				color: 'text-emerald-500',
				bg: 'bg-emerald-500/10',
				border: 'border-emerald-500/20'
			};
		}

		if (score >= 70) {
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

	function formatTime(seconds: number) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
	}

	function getPasswordStrength(pass: string) {
		if (!pass) {
			return {
				score: 0,
				label: 'None',
				color: 'bg-slate-300'
			};
		}

		let score = 0;

		const hasMinLength = pass.length >= 8;
		const hasUpper = /[A-Z]/.test(pass);
		const hasLower = /[a-z]/.test(pass);
		const hasNumber = /[0-9]/.test(pass);
		const hasSpecial = /[^A-Za-z0-9]/.test(pass);

		if (hasMinLength) score += 25;
		if (hasUpper) score += 25;
		if (hasLower) score += 25;
		if (hasNumber || hasSpecial) score += 25;

		let label = 'Weak';
		let color = 'bg-red-500';

		if (score >= 100) {
			label = 'Strong';
			color = 'bg-emerald-500';
		} else if (score >= 50) {
			label = 'Moderate';
			color = 'bg-amber-500';
		}

		return {
			score,
			label,
			color,
			hasMinLength,
			hasUpper,
			hasLower,
			hasNumber,
			hasSpecial
		};
	}

	function setCurrentPasswordValue(value: string) {
		currentPassword = value;
	}

	function setNewPasswordValue(value: string) {
		newPassword = value;
	}

	let score = $derived(getSecurityScore());
	let grade = $derived(getSecurityGrade(score));
	let passwordStrength = $derived(getPasswordStrength(newPassword));
</script>

<div
	id="dashboard-layout"
	class="flex-1 flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950 transition-all duration-300"
>
	<!-- Left Sidebar Navigation Panel -->
	<aside
		class="hidden md:flex md:w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex-col shrink-0 min-h-screen"
	>
		<div class="p-6 flex items-center space-x-3 border-b border-slate-800/60">
			<div
				class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0"
			>
				<GraduationCap class="w-5 h-5" />
			</div>

			<div>
				<span class="text-white font-black text-sm tracking-tight block font-display">
					GDGC Secure
				</span>
				<span
					class="text-[10px] text-indigo-400 font-bold tracking-widest uppercase block font-sans"
				>
					Recruits
				</span>
			</div>
		</div>

		<nav class="flex-1 px-4 py-6 space-y-1.5">
			{#if isAdmin}
				<button
					type="button"
					onclick={() => (activeTab = 'admin')}
					class={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-xs transition cursor-pointer ${
						activeTab === 'admin'
							? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/10'
							: 'text-slate-400 hover:text-white hover:bg-slate-800/40'
					}`}
				>
					<LayoutDashboard class="w-4 h-4 shrink-0" />
					<span>Admin Console</span>
				</button>

				<button
					type="button"
					onclick={() => (activeTab = 'security')}
					class={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-xs transition cursor-pointer ${
						activeTab === 'security'
							? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/10'
							: 'text-slate-400 hover:text-white hover:bg-slate-800/40'
					}`}
				>
					<Shield class="w-4 h-4 shrink-0" />
					<span>My Security Center</span>
				</button>
			{:else}
				<button
					type="button"
					onclick={() => (activeTab = 'hub')}
					class={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-xs transition cursor-pointer ${
						activeTab === 'hub'
							? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/10'
							: 'text-slate-400 hover:text-white hover:bg-slate-800/40'
					}`}
				>
					<LayoutDashboard class="w-4 h-4 shrink-0" />
					<span>Candidate Hub</span>
				</button>

				<button
					type="button"
					onclick={() => (activeTab = 'security')}
					class={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-xs transition cursor-pointer ${
						activeTab === 'security'
							? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/10'
							: 'text-slate-400 hover:text-white hover:bg-slate-800/40'
					}`}
				>
					<Shield class="w-4 h-4 shrink-0" />
					<span>My Security Center</span>
				</button>
			{/if}
		</nav>

		<div class="p-4 border-t border-slate-800 bg-slate-950/40 mt-auto">
			<div class="bg-slate-800/30 border border-slate-800/40 rounded-2xl p-3.5">
				<div class="flex items-center space-x-2 mb-3">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
					<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
						{user.role === 'admin' ? 'Role: Admin' : 'Role: Candidate'}
					</span>
				</div>

				<div class="flex items-center space-x-3">
					<div
						class="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-xs shrink-0"
					>
						{user.name.charAt(0)}
					</div>

					<div class="min-w-0 flex-1">
						<p class="text-xs font-bold text-white truncate">{user.name}</p>
						<p class="text-[10px] text-slate-500 truncate">{user.email}</p>
					</div>
				</div>
			</div>
		</div>
	</aside>

	<!-- Right Main Work Area -->
	<main class="flex-1 flex flex-col min-w-0 min-h-screen">
		<header
			class="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 md:px-8 flex items-center justify-between shrink-0 transition-all duration-300"
		>
			<div class="flex items-center space-x-3">
				<div class="md:hidden flex items-center space-x-2 mr-2">
					<div
						class="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm"
					>
						<GraduationCap class="h-5 w-5" />
					</div>
				</div>

				<div>
					<h1
						class="text-sm md:text-base font-bold text-slate-800 dark:text-white font-display tracking-tight"
					>
						{pageTitle}
					</h1>

					<p class="text-[10px] text-slate-400 dark:text-slate-400 hidden sm:block font-medium">
						{pageSubtitle}
					</p>
				</div>
			</div>

			<div class="flex items-center space-x-3">
				<div
					class="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-600 dark:text-slate-400"
				>
					<Clock class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
					<span class="font-semibold">{formatTime(sessionSecondsLeft)}</span>
				</div>

				<button
					id="header-theme-toggle"
					type="button"
					onclick={() => setDarkMode(!darkMode)}
					class="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer"
					title="Toggle visual mode"
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
					onclick={onLogout}
					class="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 border border-slate-700 dark:border-slate-700 shadow-sm transition shrink-0 cursor-pointer"
				>
					<LogOut class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">Secure Logout</span>
				</button>
			</div>
		</header>

		<!-- Mobile Navigation -->
		<div
			class="md:hidden flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2.5 overflow-x-auto gap-2 shrink-0"
		>
			{#if isAdmin}
				<button
					type="button"
					onclick={() => (activeTab = 'admin')}
					class={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
						activeTab === 'admin'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/40'
					}`}
				>
					Admin Dashboard
				</button>

				<button
					type="button"
					onclick={() => (activeTab = 'security')}
					class={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
						activeTab === 'security'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/40'
					}`}
				>
					Security Center
				</button>
			{:else}
				<button
					type="button"
					onclick={() => (activeTab = 'hub')}
					class={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
						activeTab === 'hub'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/40'
					}`}
				>
					Candidate Hub
				</button>

				<button
					type="button"
					onclick={() => (activeTab = 'security')}
					class={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
						activeTab === 'security'
							? 'bg-indigo-600 text-white shadow-sm'
							: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/40'
					}`}
				>
					Security Center
				</button>
			{/if}
		</div>

		<div class="p-6 md:p-8 flex-1 space-y-6 overflow-y-auto">
			{#if showSessionWarning}
				<div
					id="session-expiry-warning"
					in:fly={{ y: -20, duration: 200 }}
					class="bg-amber-500 text-slate-950 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between border border-amber-600 gap-3 shadow-lg"
				>
					<div class="flex items-center space-x-2.5">
						<ShieldAlert class="h-5 w-5 shrink-0 animate-bounce" />

						<div>
							<p class="font-bold text-sm">Security Session Expiration Warning</p>
							<p class="text-xs font-medium">
								To protect your candidate recruitment portfolio, your secure token will expire in
								<span class="font-bold underline">{formatTime(sessionSecondsLeft)}</span>
								mins due to inactivity rules.
							</p>
						</div>
					</div>

					<button
						id="extend-session-btn"
						type="button"
						onclick={handleExtendSession}
						class="px-4 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
					>
						Renew Session Token
					</button>
				</div>
			{/if}

			<!-- Dashboard Overview Cards -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
				<div
					class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-all duration-300"
				>
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
							Account Status
						</span>

						<span
							class={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${
								user.isVerified
									? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/10'
									: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/10'
							}`}
						>
							{user.isVerified ? 'VERIFIED' : 'PENDING'}
						</span>
					</div>

					<div class="mt-2">
						<p class="text-lg font-bold text-slate-800 dark:text-white font-display">
							Secure Access
						</p>

						<p class="text-xs text-slate-400 mt-1">
							{twoFactor ? 'Two-Factor Authentication active' : 'Password verification only'}
						</p>
					</div>
				</div>

				<div
					class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-all duration-300"
				>
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
							Session Health
						</span>

						<span
							class="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/10 text-[9px] font-extrabold tracking-wider"
						>
							STABLE
						</span>
					</div>

					<div class="mt-2">
						<p class="text-lg font-bold text-slate-800 dark:text-white font-display">
							Active Session
						</p>

						<p class="text-xs text-slate-400 mt-1">
							Secure token expires in {formatTime(sessionSecondsLeft)} mins
						</p>
					</div>
				</div>

				<div
					class="bg-indigo-50/15 dark:bg-indigo-950/10 rounded-2xl p-5 border border-indigo-500/20 shadow-sm flex flex-col justify-between transition-all duration-300"
				>
					<div class="flex items-center justify-between mb-2">
						<span
							class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider"
						>
							Security Score
						</span>

						<div class="w-7 h-7">
							<svg viewBox="0 0 36 36" class="w-full h-full">
								<path
									class="stroke-indigo-100 dark:stroke-slate-900"
									stroke-width="4"
									fill="none"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								/>
								<path
									class="stroke-indigo-600 dark:stroke-indigo-400"
									stroke-dasharray={`${score}, 100`}
									stroke-width="4"
									stroke-linecap="round"
									fill="none"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								/>
							</svg>
						</div>
					</div>

					<div class="mt-2">
						<p class="text-lg font-bold text-indigo-900 dark:text-indigo-300 font-display">
							{score} / 100
						</p>

						<p class="text-xs text-indigo-700 dark:text-indigo-400 font-semibold mt-1">
							{grade.label} (Bcrypt verification)
						</p>
					</div>
				</div>
			</div>

			{#if activeTab === 'hub' && user.role !== 'admin'}
				<CandidateHub
					{user}
					{twoFactor}
					{resumeUploaded}
					{isUploading}
					{resumeName}
					{handleResumeUploadSimulate}
					setActiveTab={(tab) => (activeTab = tab)}
				/>
			{/if}

			{#if activeTab === 'security'}
				<SecurityCenter
					{user}
					{logs}
					{twoFactor}
					{handleToggle2FA}
					{currentPassword}
					setCurrentPassword={setCurrentPasswordValue}
					{newPassword}
					setNewPassword={setNewPasswordValue}
					{pwdError}
					{pwdSuccess}
					{isUpdatingPwd}
					{handlePasswordUpdate}
					{fetchLogs}
					{passwordStrength}
				/>
			{/if}

			{#if activeTab === 'admin' && user.role === 'admin'}
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
