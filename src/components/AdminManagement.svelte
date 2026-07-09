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

	interface AdminStats {
		totalUsers: number;
		verifiedUsers: number;
		mfaUsers: number;
		totalLogins: number;
	}

	interface AdminManagementProps {
		adminStats: AdminStats;
		adminUsers: User[];
		adminLogs: ActivityLog[];
		fetchAdminData: () => void;
		handleDeleteUser: (userId: string) => void;
	}

	let { adminStats, adminUsers, adminLogs, handleDeleteUser }: AdminManagementProps = $props();

	let searchTerm = $state('');

	let filteredUsers = $derived(
		adminUsers.filter((user) => {
			const query = searchTerm.toLowerCase();

			return (
				user.name.toLowerCase().includes(query) ||
				user.email.toLowerCase().includes(query) ||
				user.role.toLowerCase().includes(query)
			);
		})
	);
</script>

<div id="tab-content-admin" in:fly={{ y: 10, duration: 200 }} class="space-y-6">
	<!-- Admin metrics dashboard row -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
		<div
			class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5 transition-all"
		>
			<div class="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
				<Users class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
					Total Candidates
				</p>
				<p class="text-lg font-bold text-slate-800 dark:text-white font-display mt-0.5">
					{adminStats.totalUsers}
				</p>
			</div>
		</div>

		<div
			class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5 transition-all"
		>
			<div
				class="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl"
			>
				<CheckCircle2 class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
					Verified Accounts
				</p>
				<p class="text-lg font-bold text-slate-800 dark:text-white font-display mt-0.5">
					{adminStats.verifiedUsers}
				</p>
			</div>
		</div>

		<div
			class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5 transition-all"
		>
			<div
				class="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl"
			>
				<ShieldCheck class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">MFA Protected</p>
				<p class="text-lg font-bold text-slate-800 dark:text-white font-display mt-0.5">
					{adminStats.mfaUsers}
				</p>
			</div>
		</div>

		<div
			class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5 transition-all"
		>
			<div
				class="p-3 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl"
			>
				<Activity class="h-5 w-5" />
			</div>

			<div>
				<p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Logins</p>
				<p class="text-lg font-bold text-slate-800 dark:text-white font-display mt-0.5">
					{adminStats.totalLogins}
				</p>
			</div>
		</div>
	</div>

	<!-- Grid: 2 columns Split - User Table & System logs -->
	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
		<!-- User directory -->
		<div
			class="xl:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
				<div>
					<h3 class="text-base font-bold text-slate-800 dark:text-white font-display">
						Candidate Directory
					</h3>
					<p class="text-xs text-slate-400 dark:text-slate-400 font-medium">
						Verify or discard registered college recruitment profiles.
					</p>
				</div>

				<!-- Search Input -->
				<div class="relative">
					<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
						<Search class="h-4 w-4" />
					</span>

					<input
						id="candidate-search-input"
						type="text"
						placeholder="Search candidates..."
						bind:value={searchTerm}
						class="pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-52"
					/>
				</div>
			</div>

			<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr
							class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800"
						>
							<th class="py-3 px-4">Candidate Info</th>
							<th class="py-3 px-4">Registered</th>
							<th class="py-3 px-4">Security Level</th>
							<th class="py-3 px-4 text-right">Actions</th>
						</tr>
					</thead>

					<tbody
						class="text-xs divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-300"
					>
						{#each filteredUsers as item (item.id)}
							<tr class="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 transition-colors">
								<td class="py-3 px-4">
									<div class="flex items-center space-x-2.5">
										<div
											class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300"
										>
											{item.name.charAt(0)}
										</div>

										<div class="min-w-0">
											<p class="font-bold text-slate-800 dark:text-slate-200 truncate">
												{item.name}
											</p>
											<p class="text-[10px] text-slate-400 font-medium truncate">
												{item.email}
											</p>
										</div>
									</div>
								</td>

								<td class="py-3 px-4 text-slate-500 font-medium">
									{new Date(item.createdAt).toLocaleDateString([], {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}
								</td>

								<td class="py-3 px-4 space-y-1">
									<div class="flex flex-wrap gap-1">
										<span
											class={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
												item.isVerified
													? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/10'
													: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/10'
											}`}
										>
											{item.isVerified ? 'VERIFIED' : 'PENDING'}
										</span>

										{#if item.twoFactorEnabled}
											<span
												class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/10"
											>
												2FA ACTIVE
											</span>
										{/if}

										<span
											class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
										>
											{item.role.toUpperCase()}
										</span>
									</div>
								</td>

								<td class="py-3 px-4 text-right">
									{#if item.role !== 'admin'}
										<button
											id={`delete-user-btn-${item.id}`}
											onclick={() => handleDeleteUser(item.id)}
											class="p-1.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200/50 dark:border-red-900/10 text-red-600 dark:text-red-400 rounded-xl transition cursor-pointer"
											title="Purge candidate data"
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									{:else}
										<span class="text-[10px] text-slate-400 italic">SYSTEM</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Audit trail -->
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3
				class="text-base font-bold text-slate-800 dark:text-white font-display mb-1 flex items-center gap-1.5"
			>
				<ShieldAlert class="h-5 w-5 text-indigo-500 shrink-0" />
				<span>Full Security Audit trail</span>
			</h3>

			<p class="text-xs text-slate-400 dark:text-slate-400 mb-5 font-medium">
				Real-time cryptographic database audit triggers.
			</p>

			<div class="space-y-4 max-h-[360px] overflow-y-auto pr-1">
				{#each adminLogs.slice(0, 15) as log (log.id)}
					<div
						class="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/40 dark:border-slate-800/80 text-xs"
					>
						<div class="flex items-center justify-between mb-1">
							<span class="font-bold text-slate-800 dark:text-slate-200">
								{log.type.toUpperCase().replace(/_/g, ' ')}
							</span>

							<span
								class={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
									log.status === 'success'
										? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
										: 'bg-red-100/50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
								}`}
							>
								{log.status.toUpperCase()}
							</span>
						</div>

						<p class="text-slate-500 dark:text-slate-400 text-[11px] font-medium mt-0.5">
							{log.email} • {log.ip}
						</p>

						<div
							class="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/60 text-[10px] text-slate-400 font-mono"
						>
							<span>{log.userAgent}</span>
							<span>
								{new Date(log.timestamp).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
