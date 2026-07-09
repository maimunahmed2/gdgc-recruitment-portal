<script lang="ts">
	import {
		ArrowRight,
		FileText,
		HelpCircle,
		Shield,
		ShieldCheck,
		Sparkles,
		UploadCloud
	} from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	import type { User } from '../types';

	interface CandidateHubProps {
		user: User;
		twoFactor: boolean;
		resumeUploaded: boolean;
		isUploading: boolean;
		resumeName: string;
		handleResumeUploadSimulate: (event: Event) => void;
		setActiveTab: (tab: 'hub' | 'security' | 'admin') => void;
	}

	let {
		twoFactor,
		resumeUploaded,
		isUploading,
		resumeName,
		handleResumeUploadSimulate,
		setActiveTab
	}: CandidateHubProps = $props();
</script>

<div
	id="tab-content-hub"
	in:fly={{ y: 10, duration: 200 }}
	class="grid grid-cols-1 lg:grid-cols-3 gap-6"
>
	<!-- Left panel: Recruitment Checklist -->
	<div class="lg:col-span-2 space-y-6">
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h2
				class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1 font-display"
			>
				<Sparkles class="h-5 w-5 text-indigo-500 shrink-0" />
				<span>GDGC Recruits Checklist</span>
			</h2>

			<p class="text-xs text-slate-400 dark:text-slate-400 mb-6 font-medium">
				Complete the tasks below to finalize your academic application package.
			</p>

			<div class="space-y-4">
				<!-- Task 1: Verification -->
				<div
					class="flex items-start p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-slate-800/80"
				>
					<div
						class="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg mr-3 shadow-sm border border-indigo-100/30 dark:border-indigo-900/10 shrink-0"
					>
						<ShieldCheck class="h-5 w-5" />
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center justify-between">
							<h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">
								Email Address Verification
							</h4>

							<span
								class="text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/10 uppercase tracking-wider"
							>
								Completed
							</span>
						</div>

						<p class="text-xs text-slate-400 dark:text-slate-400 mt-1">
							Verified secure email ownership using real-time sandbox OTP code generation.
						</p>
					</div>
				</div>

				<!-- Task 2: Resume Submission -->
				<div
					class="flex items-start p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-slate-800/80"
				>
					<div
						class="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg mr-3 shadow-sm border border-indigo-100/30 dark:border-indigo-900/10 shrink-0"
					>
						<FileText class="h-5 w-5" />
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center justify-between mb-1">
							<h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">
								Submit Academic Resume
							</h4>

							{#if resumeUploaded}
								<span
									class="text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/10 uppercase tracking-wider"
								>
									Received
								</span>
							{:else}
								<span
									class="text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/10 uppercase tracking-wider"
								>
									Action Required
								</span>
							{/if}
						</div>

						{#if resumeUploaded}
							<p class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
								Uploaded file:
								<span class="underline font-mono">{resumeName}</span>
							</p>
						{:else}
							<p class="text-xs text-slate-400 dark:text-slate-400 mb-3 leading-normal">
								Upload your PDF resume so reviewers can look over your design and dev background.
							</p>

							<label
								class="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-sm transition-all"
							>
								<UploadCloud class="h-4 w-4 mr-1.5" />

								<span>
									{isUploading ? 'Uploading Resume PDF...' : 'Choose PDF File'}
								</span>

								<input
									type="file"
									accept=".pdf"
									onchange={handleResumeUploadSimulate}
									class="hidden"
									disabled={isUploading}
								/>
							</label>
						{/if}
					</div>
				</div>

				<!-- Task 3: Security MFA Setup -->
				<div
					class="flex items-start p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-slate-800/80"
				>
					<div
						class="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg mr-3 shadow-sm border border-indigo-100/30 dark:border-indigo-900/10 shrink-0"
					>
						<Shield class="h-5 w-5" />
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center justify-between">
							<h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">
								Activate Two-Factor Identity Verification
							</h4>

							{#if twoFactor}
								<span
									class="text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/10 uppercase tracking-wider"
								>
									Active
								</span>
							{:else}
								<button
									id="checklist-enable-2fa-btn"
									type="button"
									onclick={() => setActiveTab('security')}
									class="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-500 hover:underline cursor-pointer"
								>
									Configure Now
								</button>
							{/if}
						</div>

						<p class="text-xs text-slate-400 dark:text-slate-400 mt-1">
							Add an extra layer of defence preventing password breaches. Highly suggested by
							recruiters.
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- GDGC Recruitment FAQ -->
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3
				class="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-1.5 font-display"
			>
				<HelpCircle class="h-4 w-4 text-indigo-500 shrink-0" />
				<span>Frequently Asked Questions</span>
			</h3>

			<div class="space-y-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
				<div class="border-b border-slate-100 dark:border-slate-800/60 pb-3">
					<h4 class="font-bold text-slate-700 dark:text-slate-200">
						What are the security standards of this recruitment portal?
					</h4>

					<p class="mt-1">
						All candidates' passwords are encrypted before storage using bcrypt. Session tokens are
						signed server-side using secure JWT cryptography standards, ensuring no tampering can
						occur.
					</p>
				</div>

				<div>
					<h4 class="font-bold text-slate-700 dark:text-slate-200">
						How do I verify the security metrics of my candidate profile?
					</h4>

					<p class="mt-1">
						Navigate to the <b>My Security Center</b> tab. There, you can analyze your active sessions,
						logouts, logins, IP addresses, and password strength requirements.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Right panel: Security Status & Details -->
	<div class="space-y-6">
		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
				Security Overview
			</h3>

			<p class="text-xs text-slate-500 dark:text-slate-400 leading-normal mb-4">
				Your candidate credentials are never stored in readable, plain text format. They are
				immediately salts-padded and hashed using secure cryptographic industry workflows on the
				backend.
			</p>

			<button
				id="hub-inspect-logs-btn"
				type="button"
				onclick={() => setActiveTab('security')}
				class="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
			>
				<span>View My Access Logs</span>
				<ArrowRight class="h-3.5 w-3.5" />
			</button>
		</div>

		<div
			class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300"
		>
			<h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
				Security Center Insights
			</h3>

			<div class="space-y-2.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
				<div
					class="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200/40 dark:border-slate-800/80 flex items-start space-x-2"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
					<span>Verified email confirms candidate ownership.</span>
				</div>

				<div
					class="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200/40 dark:border-slate-800/80 flex items-start space-x-2"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
					<span>Enabling MFA safeguards academic submissions.</span>
				</div>
			</div>
		</div>
	</div>
</div>
