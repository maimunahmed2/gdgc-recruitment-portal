<script lang="ts">
	import {
		Activity,
		CheckCircle2,
		Search,
		ShieldAlert,
		ShieldCheck,
		Trash2,
		Users
	} from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	import type { ActivityLog, User } from '../types';

	type AdminStats = {
		totalUsers: number;
		verifiedUsers: number;
		mfaUsers: number;
		totalLogins: number;
	};

	type Props = {
		adminStats: AdminStats;
		adminUsers: User[];
		adminLogs: ActivityLog[];
		fetchAdminData: () => void | Promise<void>;
		handleDeleteUser: (userId: string) => void | Promise<void>;
	};

	let { adminStats, adminUsers, adminLogs, handleDeleteUser }: Props = $props();

	let searchTerm = $state('');

	let filteredUsers = $derived(
		adminUsers.filter((item) => {
			const query = searchTerm.trim().toLowerCase();

			if (!query) return true;

			return (
				item.name.toLowerCase().includes(query) ||
				item.email.toLowerCase().includes(query) ||
				item.role.toLowerCase().includes(query)
			);
		})
	);

	function formatRegisteredDate(value: string | Date): string {
		return new Date(value).toLocaleDateString([], {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatLogTime(value: string | Date): string {
		return new Date(value).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatLogType(type: string): string {
		return type.toUpperCase().replace(/_/g, ' ');
	}
</script>

<div id="tab-content-admin" in:fly={{ y: 10, opacity: 0, duration: 200 }} class="space-y-6">
	<!-- Admin metrics -->
	<div class="grid grid-cols-2 gap-5 lg:grid-cols-4">
		<div
			class="flex items-center space-x-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
				<Users class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Total Candidates
				</p>

				<p class="font-display mt-0.5 text-lg font-bold text-slate-800 dark:text-white">
					{adminStats.totalUsers}
				</p>
			</div>
		</div>

		<div
			class="flex items-center space-x-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
			>
				<CheckCircle2 class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Verified Accounts
				</p>

				<p class="font-display mt-0.5 text-lg font-bold text-slate-800 dark:text-white">
					{adminStats.verifiedUsers}
				</p>
			</div>
		</div>

		<div
			class="flex items-center space-x-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
			>
				<ShieldCheck class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">MFA Protected</p>

				<p class="font-display mt-0.5 text-lg font-bold text-slate-800 dark:text-white">
					{adminStats.mfaUsers}
				</p>
			</div>
		</div>

		<div
			class="flex items-center space-x-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="rounded-xl bg-violet-50 p-3 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
			>
				<Activity class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Audit Logins</p>

				<p class="font-display mt-0.5 text-lg font-bold text-slate-800 dark:text-white">
					{adminStats.totalLogins}
				</p>
			</div>
		</div>
	</div>

	<!-- Candidate directory and audit trail -->
	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<!-- Candidate directory -->
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 xl:col-span-2 dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="font-display text-base font-bold text-slate-800 dark:text-white">
						Candidate Directory
					</h3>

					<p class="text-xs font-medium text-slate-400 dark:text-slate-400">
						Verify or discard registered college recruitment profiles.
					</p>
				</div>

				<div class="relative">
					<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
						<Search class="h-4 w-4" />
					</span>

					<input
						id="candidate-search-input"
						type="search"
						placeholder="Search candidates..."
						bind:value={searchTerm}
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-4 pl-9 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none sm:w-52 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
					/>
				</div>
			</div>

			<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
				<table class="w-full border-collapse text-left">
					<thead>
						<tr
							class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
						>
							<th class="px-4 py-3">Candidate Info</th>
							<th class="px-4 py-3">Registered</th>
							<th class="px-4 py-3">Security Level</th>
							<th class="px-4 py-3 text-right">Actions</th>
						</tr>
					</thead>

					<tbody
						class="divide-y divide-slate-100 text-xs text-slate-600 dark:divide-slate-800/60 dark:text-slate-300"
					>
						{#each filteredUsers as item (item.id ?? item.email)}
							<tr class="transition-colors hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10">
								<td class="px-4 py-3">
									<div class="flex items-center space-x-2.5">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
										>
											{item.name.charAt(0)}
										</div>

										<div class="min-w-0">
											<p class="truncate font-bold text-slate-800 dark:text-slate-200">
												{item.name}
											</p>

											<p class="truncate text-[10px] font-medium text-slate-400">
												{item.email}
											</p>
										</div>
									</div>
								</td>

								<td class="px-4 py-3 font-medium text-slate-500">
									{formatRegisteredDate(item.createdAt)}
								</td>

								<td class="space-y-1 px-4 py-3">
									<div class="flex flex-wrap gap-1">
										<span
											class={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${
												item.isVerified
													? 'border-emerald-200/50 bg-emerald-50 text-emerald-600 dark:border-emerald-900/10 dark:bg-emerald-950/30 dark:text-emerald-400'
													: 'border-amber-200/50 bg-amber-50 text-amber-600 dark:border-amber-900/10 dark:bg-amber-950/30 dark:text-amber-400'
											}`}
										>
											{item.isVerified ? 'VERIFIED' : 'PENDING'}
										</span>

										{#if item.twoFactorEnabled}
											<span
												class="rounded-full border border-indigo-200/50 bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold text-indigo-600 dark:border-indigo-900/10 dark:bg-indigo-950/30 dark:text-indigo-400"
											>
												2FA ACTIVE
											</span>
										{/if}

										<span
											class="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
										>
											{item.role.toUpperCase()}
										</span>
									</div>
								</td>

								<td class="px-4 py-3 text-right">
									{#if item.role !== 'admin' && item.id}
										<button
											id={`delete-user-btn-${item.id}`}
											type="button"
											onclick={() => void handleDeleteUser(item.id)}
											class="cursor-pointer rounded-xl border border-red-200/50 bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 dark:border-red-900/10 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30"
											title="Purge candidate data"
											aria-label={`Delete ${item.name}`}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									{:else if item.role === 'admin'}
										<span class="text-[10px] text-slate-400 italic">SYSTEM</span>
									{:else}
										<span class="text-[10px] text-red-400">Missing user ID</span>
									{/if}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="px-4 py-10 text-center text-xs text-slate-400">
									No candidates match “{searchTerm}”.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Security audit trail -->
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
		>
			<h3
				class="font-display mb-1 flex items-center gap-1.5 text-base font-bold text-slate-800 dark:text-white"
			>
				<ShieldAlert class="h-5 w-5 shrink-0 text-indigo-500" />
				<span>Full Security Audit Trail</span>
			</h3>

			<p class="mb-5 text-xs font-medium text-slate-400 dark:text-slate-400">
				Real-time cryptographic database audit triggers.
			</p>

			<div class="max-h-[360px] space-y-4 overflow-y-auto pr-1">
				{#each adminLogs.slice(0, 15) as log (log.id ?? `${log.timestamp}-${log.email}-${log.type}`)}
					<div
						class="rounded-xl border border-slate-200/40 bg-slate-50 p-3 text-xs dark:border-slate-800/80 dark:bg-slate-950/60"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="font-bold text-slate-800 dark:text-slate-200">
								{formatLogType(log.type)}
							</span>

							<span
								class={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
									log.status === 'success'
										? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
										: 'bg-red-100/50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
								}`}
							>
								{log.status.toUpperCase()}
							</span>
						</div>

						<p class="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
							{log.email} • {log.ip}
						</p>

						<div
							class="mt-2 flex items-center justify-between gap-3 border-t border-slate-200/40 pt-1.5 font-mono text-[10px] text-slate-400 dark:border-slate-800/60"
						>
							<span class="min-w-0 truncate">
								{log.userAgent}
							</span>

							<span class="shrink-0">
								{formatLogTime(log.timestamp)}
							</span>
						</div>
					</div>
				{:else}
					<div
						class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800"
					>
						No audit activity is available yet.
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
