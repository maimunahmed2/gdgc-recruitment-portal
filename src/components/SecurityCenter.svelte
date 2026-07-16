<script lang="ts">
	import {
		AlertCircle,
		BarChart3,
		Globe,
		KeyRound,
		Laptop,
		MapPin,
		RefreshCw,
		Server,
		ShieldCheck,
		ToggleLeft,
		ToggleRight
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	import type { ActivityLog, User } from '../types';

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

	type GeoData = {
		ip?: string;
		city?: string;
		region?: string;
		country?: string;
		org?: string;
		loading: boolean;
	};

	type Props = {
		user: User;
		logs: ActivityLog[];
		twoFactor: boolean;
		handleToggle2FA: () => void | Promise<void>;
		currentPassword: string;
		setCurrentPassword: (value: string) => void;
		newPassword: string;
		setNewPassword: (value: string) => void;
		pwdError: string | null;
		pwdSuccess: string | null;
		isUpdatingPwd: boolean;
		handlePasswordUpdate: (event: SubmitEvent) => void | Promise<void>;
		fetchLogs: () => void | Promise<void>;
		passwordStrength: PasswordStrength;
	};

	let {
		user: _user,
		logs,
		twoFactor,
		handleToggle2FA,
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		pwdError,
		pwdSuccess,
		isUpdatingPwd,
		handlePasswordUpdate,
		fetchLogs,
		passwordStrength
	}: Props = $props();

	let geoData = $state<GeoData>({ loading: true });
	let currentDomain = $state('Unknown host');
	let detectedBrowserOs = $state('Unknown Browser on Unknown OS');
	let isRefreshingLogs = $state(false);
	let isToggling2FA = $state(false);

	function getReadableDevice(userAgent: string): string {
		let operatingSystem = 'Unknown OS';
		let browser = 'Unknown Browser';

		// Check mobile operating systems before generic Linux/macOS.
		if (/android/i.test(userAgent)) {
			operatingSystem = 'Android';
		} else if (/iphone|ipad|ipod/i.test(userAgent)) {
			operatingSystem = 'iOS';
		} else if (/windows/i.test(userAgent)) {
			operatingSystem = 'Windows';
		} else if (/macintosh|mac os x/i.test(userAgent)) {
			operatingSystem = 'macOS';
		} else if (/linux/i.test(userAgent)) {
			operatingSystem = 'Linux';
		}

		// Edge must be checked before Chrome.
		if (/edg|edge/i.test(userAgent)) {
			browser = 'Edge';
		} else if (/firefox|fxios/i.test(userAgent)) {
			browser = 'Firefox';
		} else if (/chrome|crios/i.test(userAgent)) {
			browser = 'Chrome';
		} else if (/safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent)) {
			browser = 'Safari';
		}

		return `${browser} on ${operatingSystem}`;
	}

	function formatLogType(type: string): string {
		return type.toUpperCase().replace(/_/g, ' ');
	}

	function formatLogTime(value: string | Date): string {
		return new Date(value).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	async function loadGeoData(signal: AbortSignal): Promise<void> {
		try {
			const response = await fetch('https://ipapi.co/json/', { signal });

			if (!response.ok) {
				throw new Error('IP service request failed');
			}

			const data = (await response.json()) as {
				ip?: string;
				city?: string;
				region?: string;
				country_name?: string;
				org?: string;
			};

			geoData = {
				ip: data.ip,
				city: data.city,
				region: data.region,
				country: data.country_name,
				org: data.org,
				loading: false
			};
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			/*
			 * The free ip-api.com endpoint may be blocked on HTTPS
			 * pages, so keep a graceful fallback instead.
			 */
			geoData = { loading: false };
		}
	}

	async function toggleTwoFactor(): Promise<void> {
		if (isToggling2FA) return;

		isToggling2FA = true;

		try {
			await handleToggle2FA();
		} finally {
			isToggling2FA = false;
		}
	}

	async function refreshLogs(): Promise<void> {
		if (isRefreshingLogs) return;

		isRefreshingLogs = true;

		try {
			await fetchLogs();
		} finally {
			isRefreshingLogs = false;
		}
	}

	let fallbackIp = $derived(logs.length > 0 ? logs[0].ip : '127.0.0.1');

	let displayIp = $derived(geoData.ip ?? fallbackIp);

	let displayLocation = $derived.by(() => {
		if (geoData.loading) {
			return 'Resolving Secure Location...';
		}

		if (!geoData.city) {
			return 'Audited Container Route';
		}

		const region = geoData.region ? `${geoData.region}, ` : '';

		return `${geoData.city}, ${region}${geoData.country ?? ''}`;
	});

	onMount(() => {
		currentDomain = window.location.host;
		detectedBrowserOs = getReadableDevice(window.navigator.userAgent);

		const controller = new AbortController();
		void loadGeoData(controller.signal);

		return () => {
			controller.abort();
		};
	});
</script>

<div
	id="tab-content-security"
	in:fly={{ y: 10, opacity: 0, duration: 200 }}
	class="grid grid-cols-1 gap-6 lg:grid-cols-3"
>
	<!-- Main security controls -->
	<div class="space-y-6 lg:col-span-2">
		<!-- Two-factor authentication -->
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3
						class="font-display flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white"
					>
						<ShieldCheck class="h-5 w-5 shrink-0 text-indigo-500" />

						<span> Two-Factor Authentication (2FA) </span>
					</h3>

					<p class="mt-1 text-xs font-medium text-slate-400">
						Require an OTP sent to your mailbox for security audits upon logging in.
					</p>
				</div>

				<button
					id="mfa-toggle-btn"
					type="button"
					onclick={() => void toggleTwoFactor()}
					disabled={isToggling2FA}
					class="mt-3 flex cursor-pointer items-center text-indigo-600 transition hover:text-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0"
					aria-label={twoFactor
						? 'Disable two-factor authentication'
						: 'Enable two-factor authentication'}
					aria-pressed={twoFactor}
				>
					{#if isToggling2FA}
						<RefreshCw class="h-7 w-7 animate-spin text-indigo-500" />
					{:else if twoFactor}
						<ToggleRight class="h-9 w-9 text-indigo-600 dark:text-indigo-400" />
					{:else}
						<ToggleLeft class="h-9 w-9 text-slate-300 dark:text-slate-700" />
					{/if}
				</button>
			</div>

			<div
				class="flex items-start space-x-2.5 rounded-xl border border-slate-200/40 bg-slate-50 p-3.5 text-xs dark:border-slate-800/80 dark:bg-slate-950/40"
			>
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

				<span class="leading-normal font-medium text-slate-500 dark:text-slate-400">
					{twoFactor
						? '2FA is active. Every candidate dashboard entry is strictly audited for secure device configurations.'
						: '2FA is currently disabled. We strongly suggest activating MFA to secure your GDGC recruitment portfolio details.'}
				</span>
			</div>
		</div>

		<!-- Password update -->
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
		>
			<h3
				class="font-display mb-4 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white"
			>
				<KeyRound class="h-5 w-5 shrink-0 text-indigo-500" />

				<span>Update Security Credentials</span>
			</h3>

			{#if pwdError}
				<div
					id="pwd-error-msg"
					in:fly={{ y: -6, opacity: 0, duration: 150 }}
					class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400"
				>
					{pwdError}
				</div>
			{/if}

			{#if pwdSuccess}
				<div
					id="pwd-success-msg"
					in:fly={{ y: -6, opacity: 0, duration: 150 }}
					class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
				>
					{pwdSuccess}
				</div>
			{/if}

			<form onsubmit={(event) => void handlePasswordUpdate(event)} class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label
							for="current-password-input"
							class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>
							Current Password
						</label>

						<input
							id="current-password-input"
							type="password"
							value={currentPassword}
							oninput={(event) => setCurrentPassword(event.currentTarget.value)}
							placeholder="••••••••"
							autocomplete="current-password"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
						/>
					</div>

					<div>
						<label
							for="new-password-input"
							class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
						>
							New Secure Password
						</label>

						<input
							id="new-password-input"
							type="password"
							value={newPassword}
							oninput={(event) => setNewPassword(event.currentTarget.value)}
							placeholder="••••••••"
							autocomplete="new-password"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
						/>
					</div>
				</div>

				{#if newPassword.length > 0}
					<div
						id="password-strength-container"
						class="rounded-xl border border-slate-200/40 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950"
					>
						<div class="mb-1.5 flex items-center justify-between text-[11px]">
							<span class="font-semibold text-slate-400"> Password Strength: </span>

							<span class="font-bold text-slate-700 dark:text-slate-200">
								{passwordStrength?.label ?? 'Checking...'}
							</span>
						</div>

						<div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
							<div
								id="password-strength-bar"
								class={`h-full ${
									passwordStrength?.color ?? 'bg-slate-400'
								} transition-all duration-300`}
								style:width={`${passwordStrength?.score ?? 0}%`}
							></div>
						</div>
					</div>
				{/if}

				<button
					id="pwd-update-submit"
					type="submit"
					disabled={isUpdatingPwd}
					class="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
				>
					{isUpdatingPwd ? 'Updating Security Hashes...' : 'Apply New Password'}
				</button>
			</form>
		</div>

		<!-- Activity logs -->
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="mb-4 flex items-center justify-between">
				<h3
					class="font-display flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white"
				>
					<BarChart3 class="h-5 w-5 shrink-0 text-indigo-500" />

					<span> My Active Sessions & Activity Logs </span>
				</h3>

				<button
					id="refresh-logs-btn"
					type="button"
					onclick={() => void refreshLogs()}
					disabled={isRefreshingLogs}
					class="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
					title="Reload Logs"
					aria-label="Reload activity logs"
				>
					<RefreshCw class={`h-4 w-4 ${isRefreshingLogs ? 'animate-spin' : ''}`} />
				</button>
			</div>

			{#if logs.length === 0}
				<div class="p-8 text-center text-xs font-medium text-slate-400 dark:text-slate-600">
					No logs recorded yet.
				</div>
			{:else}
				<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
					<table class="w-full border-collapse text-left">
						<thead>
							<tr
								class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
							>
								<th class="px-4 py-3">Event</th>
								<th class="px-4 py-3">Status</th>
								<th class="px-4 py-3"> Browser/Device </th>
								<th class="px-4 py-3"> IP Address </th>
								<th class="px-4 py-3 text-right"> Timestamp </th>
							</tr>
						</thead>

						<tbody
							class="divide-y divide-slate-100 text-xs text-slate-600 dark:divide-slate-800/60 dark:text-slate-300"
						>
							{#each logs.slice(0, 10) as log (log.id ?? `${log.timestamp}-${log.type}-${log.ip}`)}
								<tr class="transition-colors hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10">
									<td class="px-4 py-3 font-bold">
										<span class="text-slate-800 dark:text-slate-200">
											{formatLogType(log.type)}
										</span>

										{#if log.details}
											<span class="mt-0.5 block text-[10px] font-normal text-slate-400">
												{log.details}
											</span>
										{/if}
									</td>

									<td class="px-4 py-3">
										<span
											class={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
												log.status === 'success'
													? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/20 dark:bg-emerald-950/30 dark:text-emerald-400'
													: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/20 dark:bg-red-950/30 dark:text-red-400'
											}`}
										>
											{log.status.toUpperCase()}
										</span>
									</td>

									<td
										class="max-w-[150px] truncate px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400"
										title={log.userAgent}
									>
										{log.userAgent}
									</td>

									<td class="px-4 py-3 font-mono text-[11px] text-slate-500">
										{log.ip}
									</td>

									<td class="px-4 py-3 text-right font-mono text-[10px] text-slate-400">
										{formatLogTime(log.timestamp)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="mt-3.5 text-center font-mono text-[10px] text-slate-400 dark:text-slate-500">
				Security audit logs are cryptographically compiled for candidate privacy.
			</div>
		</div>
	</div>

	<!-- Device information -->
	<div class="space-y-6">
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
		>
			<h3 class="mb-4 text-xs font-bold tracking-widest text-slate-400 uppercase">
				Device Authorization
			</h3>

			<div class="space-y-4 text-xs">
				<div
					class="flex items-start space-x-3 rounded-xl border border-slate-200/40 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950"
				>
					<Globe class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

					<div class="min-w-0 flex-1">
						<h4 class="font-bold text-slate-800 dark:text-slate-200">Current Login Domain</h4>

						<p class="mt-0.5 truncate font-mono text-[10px] text-slate-500">
							{currentDomain}
						</p>
					</div>
				</div>

				<div
					class="flex items-start space-x-3 rounded-xl border border-slate-200/40 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950"
				>
					<Laptop class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

					<div class="min-w-0 flex-1">
						<h4 class="font-bold text-slate-800 dark:text-slate-200">Detected Browser & OS</h4>

						<p class="mt-0.5 truncate font-mono text-[10px] text-slate-500">
							{detectedBrowserOs}
						</p>
					</div>
				</div>

				<div
					class="flex items-start space-x-3 rounded-xl border border-slate-200/40 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950"
				>
					<Server class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

					<div class="min-w-0 flex-1">
						<h4 class="font-bold text-slate-800 dark:text-slate-200">Active Node IP</h4>

						<p class="mt-0.5 truncate font-mono text-[10px] text-slate-500">
							{geoData.loading ? 'Detecting Secure Address...' : displayIp}
						</p>
					</div>
				</div>

				<div
					class="flex items-start space-x-3 rounded-xl border border-slate-200/40 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950"
				>
					<MapPin class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

					<div class="min-w-0 flex-1">
						<h4 class="font-bold text-slate-800 dark:text-slate-200">IP Geolocation Bound</h4>

						<p class="mt-0.5 truncate font-mono text-[10px] text-slate-500">
							{displayLocation}
						</p>

						{#if geoData.org}
							<p class="mt-1 text-[8px] font-bold tracking-wider text-indigo-400 uppercase">
								{geoData.org}
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
		>
			<h3 class="font-display mb-3 text-sm font-bold text-slate-800 dark:text-white">
				Remember Me Cookie
			</h3>

			<p class="text-xs leading-relaxed font-medium text-slate-400">
				If selected on login, a secure cryptographic token is saved inside local state, allowing
				rapid candidate authentication across multiple app refreshes.
			</p>
		</div>
	</div>
</div>
