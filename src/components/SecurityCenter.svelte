<script lang="ts">
	import {
		AlertCircle,
		BarChart3,
		Globe,
		KeyRound,
		MapPin,
		RefreshCw,
		ShieldCheck,
		ToggleLeft,
		ToggleRight
	} from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	import type { ActivityLog, User } from '../types';

	interface PasswordStrength {
		score: number;
		label: string;
		color: string;
		hasMinLength?: boolean;
		hasUpper?: boolean;
		hasLower?: boolean;
		hasNumber?: boolean;
		hasSpecial?: boolean;
	}

	interface SecurityCenterProps {
		user: User;
		logs: ActivityLog[];
		twoFactor: boolean;
		handleToggle2FA: () => void;
		currentPassword: string;
		setCurrentPassword: (value: string) => void;
		newPassword: string;
		setNewPassword: (value: string) => void;
		pwdError: string | null;
		pwdSuccess: string | null;
		isUpdatingPwd: boolean;
		handlePasswordUpdate: (event: SubmitEvent) => void;
		fetchLogs: () => void;
		passwordStrength: PasswordStrength;
	}

	let {
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
	}: SecurityCenterProps = $props();

	function getInputValue(event: Event) {
		return (event.currentTarget as HTMLInputElement).value;
	}
</script>

<div
	id="tab-content-security"
	in:fly={{ y: 10, duration: 200 }}
	class="grid grid-cols-1 lg:grid-cols-3 gap-6"
>
	<!-- Left / Middle: 2FA & Password Management -->
	<div class="lg:col-span-2 space-y-6">
		<!-- MFA Panel -->
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
				<div>
					<h3
						class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 font-display"
					>
						<ShieldCheck class="h-5 w-5 text-indigo-500 shrink-0" />
						<span>Two-Factor Authentication (2FA)</span>
					</h3>

					<p class="text-xs text-slate-400 dark:text-slate-400 mt-1 font-medium">
						Require an OTP sent to your mailbox for security audits upon logging in.
					</p>
				</div>

				<button
					id="mfa-toggle-btn"
					type="button"
					onclick={handleToggle2FA}
					class="mt-3 sm:mt-0 flex items-center text-indigo-600 hover:text-indigo-500 transition focus:outline-none cursor-pointer"
					aria-label="Toggle two-factor authentication"
				>
					{#if twoFactor}
						<ToggleRight class="h-9 w-9 text-indigo-600 dark:text-indigo-400" />
					{:else}
						<ToggleLeft class="h-9 w-9 text-slate-300 dark:text-slate-700" />
					{/if}
				</button>
			</div>

			<div
				class="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/80 rounded-xl text-xs flex items-start space-x-2.5"
			>
				<AlertCircle class="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />

				<span class="text-slate-500 dark:text-slate-400 leading-normal font-medium">
					{twoFactor
						? '2FA is active. Every candidate dashboard entry is strictly audited for secure device configurations.'
						: '2FA is currently disabled. We strongly suggest activating MFA to secure your GDGC recruitment portfolio details.'}
				</span>
			</div>
		</div>

		<!-- Password Update Card -->
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3
				class="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 font-display"
			>
				<KeyRound class="h-5 w-5 text-indigo-500 shrink-0" />
				<span>Update Security Credentials</span>
			</h3>

			{#if pwdError}
				<div
					id="pwd-error-msg"
					class="mb-4 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium"
				>
					{pwdError}
				</div>
			{/if}

			{#if pwdSuccess}
				<div
					id="pwd-success-msg"
					class="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl font-medium"
				>
					{pwdSuccess}
				</div>
			{/if}

			<form onsubmit={handlePasswordUpdate} class="space-y-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label
							for="current-password-input"
							class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
						>
							Current Password
						</label>

						<input
							id="current-password-input"
							type="password"
							value={currentPassword}
							oninput={(event) => setCurrentPassword(getInputValue(event))}
							placeholder="••••••••"
							class="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
						/>
					</div>

					<div>
						<label
							for="new-password-input"
							class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
						>
							New Secure Password
						</label>

						<input
							id="new-password-input"
							type="password"
							value={newPassword}
							oninput={(event) => setNewPassword(getInputValue(event))}
							placeholder="••••••••"
							class="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
						/>
					</div>
				</div>

				{#if newPassword.length > 0}
					<div
						id="password-strength-container"
						class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/40 dark:border-slate-800/80"
					>
						<div class="flex justify-between items-center text-[11px] mb-1.5">
							<span class="font-semibold text-slate-400">Password Strength:</span>

							<span class="font-bold text-slate-700 dark:text-slate-200">
								{passwordStrength?.label || 'Checking...'}
							</span>
						</div>

						<div class="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
							<div
								id="password-strength-bar"
								class={`h-full ${passwordStrength?.color || 'bg-slate-400'} transition-all duration-300`}
								style={`width: ${passwordStrength?.score || 0}%`}
							></div>
						</div>
					</div>
				{/if}

				<button
					id="pwd-update-submit"
					type="submit"
					disabled={isUpdatingPwd}
					class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
				>
					{isUpdatingPwd ? 'Updating Security Hashes...' : 'Apply New Password'}
				</button>
			</form>
		</div>

		<!-- User Activity Logs List -->
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<div class="flex items-center justify-between mb-4">
				<h3
					class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 font-display"
				>
					<BarChart3 class="h-5 w-5 text-indigo-500 shrink-0" />
					<span>My Active Sessions & Activity Logs</span>
				</h3>

				<button
					id="refresh-logs-btn"
					type="button"
					onclick={fetchLogs}
					class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
					title="Reload Logs"
				>
					<RefreshCw class="h-4 w-4" />
				</button>
			</div>

			{#if logs.length === 0}
				<div class="text-center p-8 text-slate-400 dark:text-slate-600 text-xs font-medium">
					No logs recorded yet.
				</div>
			{:else}
				<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr
								class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800"
							>
								<th class="py-3 px-4">Event</th>
								<th class="py-3 px-4">Status</th>
								<th class="py-3 px-4">Browser/Device</th>
								<th class="py-3 px-4">IP Address</th>
								<th class="py-3 px-4 text-right">Timestamp</th>
							</tr>
						</thead>

						<tbody
							class="text-xs divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-300"
						>
							{#each logs.slice(0, 10) as log (log.id)}
								<tr class="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 transition-colors">
									<td class="py-3 px-4 font-bold">
										<span class="text-slate-800 dark:text-slate-200">
											{log.type.toUpperCase().replace(/_/g, ' ')}
										</span>

										{#if log.details}
											<span class="block text-[10px] text-slate-400 font-normal mt-0.5">
												{log.details}
											</span>
										{/if}
									</td>

									<td class="py-3 px-4">
										<span
											class={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
												log.status === 'success'
													? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/20'
													: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/20'
											}`}
										>
											{log.status.toUpperCase()}
										</span>
									</td>

									<td
										class="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]"
										title={log.userAgent}
									>
										{log.userAgent}
									</td>

									<td class="py-3 px-4 font-mono text-[11px] text-slate-500">
										{log.ip}
									</td>

									<td class="py-3 px-4 text-right text-slate-400 font-mono text-[10px]">
										{new Date(log.timestamp).toLocaleTimeString([], {
											hour: '2-digit',
											minute: '2-digit',
											second: '2-digit'
										})}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-3.5 text-center">
				Security audit logs are cryptographically compiled for candidate privacy.
			</div>
		</div>
	</div>

	<!-- Right Panel: Account Metrics summary -->
	<div class="space-y-6">
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3 class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
				Device Authorization
			</h3>

			<div class="space-y-4 text-xs">
				<div
					class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/80 rounded-xl flex items-start space-x-3"
				>
					<Globe class="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />

					<div class="min-w-0">
						<h4 class="font-bold text-slate-800 dark:text-slate-200">Current Login Domain</h4>

						<p class="text-[10px] text-slate-500 font-mono mt-0.5 truncate">Development Sandbox</p>
					</div>
				</div>

				<div
					class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/80 rounded-xl flex items-start space-x-3"
				>
					<MapPin class="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />

					<div class="min-w-0">
						<h4 class="font-bold text-slate-800 dark:text-slate-200">IP Location Bound</h4>

						<p class="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
							Audited Virtual Container Routing
						</p>
					</div>
				</div>
			</div>
		</div>

		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3 class="text-sm font-bold text-slate-800 dark:text-white mb-3 font-display">
				Remember Me Cookie
			</h3>

			<p class="text-xs text-slate-400 dark:text-slate-400 leading-relaxed font-medium">
				If selected on login, a secure cryptographic token is saved inside local state, allowing
				rapid candidate authentication bypass across multiple app refreshes.
			</p>
		</div>
	</div>
</div>
