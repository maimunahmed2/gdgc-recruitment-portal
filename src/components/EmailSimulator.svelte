<script lang="ts">
	import {
		ArrowRight,
		Check,
		ChevronDown,
		ChevronUp,
		Clock,
		Copy,
		Mail,
		MailOpen,
		RefreshCw,
		Sparkles,
		Trash2,
		X,
		Zap
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	import type { SimulatedEmail } from '../types';

	type AuthView =
		'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verify' | 'verify-2fa';

	interface EmailSimulatorProps {
		onPreFillReset?: (email: string, code: string, view?: AuthView) => void;
	}

	interface RealTimeToast {
		id: string;
		email: SimulatedEmail;
		code: string;
		viewType: 'verify' | 'verify-2fa' | 'reset-password';
	}

	interface OtpShortcut {
		extractedCode: string;
		is2FA: boolean;
		viewType: 'verify' | 'verify-2fa';
	}

	let { onPreFillReset }: EmailSimulatorProps = $props();

	let emails = $state<SimulatedEmail[]>([]);
	let isOpen = $state(false);
	let selectedEmail = $state<SimulatedEmail | null>(null);
	let isRefreshing = $state(false);
	let unreadCount = $state(0);

	let seenEmailIds = $state<Set<string>>(new Set());
	let isInitialLoad = $state(true);
	let toasts = $state<RealTimeToast[]>([]);
	let copiedId = $state<string | null>(null);

	let selectedOtpShortcut = $derived(getOtpShortcut(selectedEmail));

	function dismissToast(id: string) {
		toasts = toasts.filter((toast) => toast.id !== id);
	}

	async function handleCopyCode(event: MouseEvent, id: string, code: string) {
		event.stopPropagation();

		try {
			await navigator.clipboard.writeText(code);
			copiedId = id;

			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch (error) {
			console.warn('Could not copy OTP code:', error);
		}
	}

	function handleToastAutoFill(event: MouseEvent, toast: RealTimeToast) {
		event.stopPropagation();

		if (onPreFillReset) {
			onPreFillReset(toast.email.to, toast.code, toast.viewType);
		}

		handleEmailClick(toast.email);
		dismissToast(toast.id);
	}

	async function fetchEmails() {
		isRefreshing = true;

		try {
			const res = await fetch('/api/debug/emails');

			if (res.ok) {
				const data = await res.json();
				const fetchedEmails: SimulatedEmail[] = data.emails;

				emails = fetchedEmails;
				unreadCount = fetchedEmails.filter((email) => !email.read).length;

				if (isInitialLoad) {
					seenEmailIds = new Set(fetchedEmails.map((email) => email.id));
					isInitialLoad = false;
				} else {
					const newEmails = fetchedEmails.filter((email) => !seenEmailIds.has(email.id));

					if (newEmails.length > 0) {
						newEmails.forEach((newEmail) => {
							const codeMatch = newEmail.body.match(/\b\d{6}\b/);
							const code = codeMatch ? codeMatch[0] : '';

							if (!code) return;

							let viewType: RealTimeToast['viewType'] = 'verify';

							const subjectLower = newEmail.subject.toLowerCase();
							const bodyLower = newEmail.body.toLowerCase();

							if (subjectLower.includes('password reset') || bodyLower.includes('reset-password')) {
								viewType = 'reset-password';
							} else if (
								subjectLower.includes('two-factor') ||
								bodyLower.includes('two-factor') ||
								subjectLower.includes('2fa')
							) {
								viewType = 'verify-2fa';
							}

							const toastId = `toast_${Math.random().toString(36).substring(2, 11)}`;

							toasts = [
								...toasts,
								{
									id: toastId,
									email: newEmail,
									code,
									viewType
								}
							];

							setTimeout(() => {
								dismissToast(toastId);
							}, 15000);
						});

						const updatedSeenIds = new Set(seenEmailIds);
						newEmails.forEach((email) => updatedSeenIds.add(email.id));
						seenEmailIds = updatedSeenIds;
					}
				}
			}
		} catch (error) {
			console.warn('Simulated email inbox check (transient network state):', error);
		} finally {
			isRefreshing = false;
		}
	}

	async function clearEmails(event: MouseEvent) {
		event.stopPropagation();

		if (!confirm('Are you sure you want to clear the simulated inbox?')) return;

		try {
			await fetch('/api/debug/clear-emails');

			emails = [];
			selectedEmail = null;
			unreadCount = 0;
		} catch (error) {
			console.warn('Error clearing simulated emails:', error);
		}
	}

	function handleEmailClick(email: SimulatedEmail) {
		selectedEmail = email;

		emails = emails.map((item) => {
			if (item.id === email.id) {
				return {
					...item,
					read: true
				};
			}

			return item;
		});

		unreadCount = Math.max(0, unreadCount - (email.read ? 0 : 1));
	}

	function handleDirectLinkClick(bodyHtml: string) {
		const hrefMatch = bodyHtml.match(/href="([^"]+)"/);

		if (hrefMatch && hrefMatch[1]) {
			const urlString = hrefMatch[1];
			const params = new URLSearchParams(urlString.replace(/^\?/, ''));

			const email = params.get('email') || '';
			const code = params.get('code') || '';

			if (email && code && onPreFillReset) {
				onPreFillReset(email, code, 'reset-password');
				isOpen = false;
			}
		}
	}

	function handleAutoFillCode(email: string, code: string, view: AuthView) {
		if (onPreFillReset) {
			onPreFillReset(email, code, view);
			isOpen = false;
		}
	}

	function getOtpShortcut(email: SimulatedEmail | null): OtpShortcut | null {
		if (!email) return null;

		const hasReset = email.body.includes('?view=reset-password');
		const codeMatch = email.body.match(/\b\d{6}\b/);
		const extractedCode = codeMatch ? codeMatch[0] : null;

		if (hasReset || !extractedCode) return null;

		const subjectLower = email.subject.toLowerCase();
		const bodyLower = email.body.toLowerCase();

		const is2FA =
			subjectLower.includes('two-factor') ||
			subjectLower.includes('security') ||
			bodyLower.includes('two-factor');

		return {
			extractedCode,
			is2FA,
			viewType: is2FA ? 'verify-2fa' : 'verify'
		};
	}

	function getEmailPreview(body: string) {
		return body
			.replace(/<[^>]*>/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 70);
	}

	onMount(() => {
		fetchEmails();

		const interval = setInterval(fetchEmails, 4000);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<!-- Real-Time Floating OTP Toast Container -->
<div class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
	{#each toasts as toast (toast.id)}
		{@const isCopied = copiedId === toast.id}
		{@const is2FA = toast.viewType === 'verify-2fa'}
		{@const isReset = toast.viewType === 'reset-password'}
		{@const badgeColor = is2FA
			? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
			: isReset
				? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
				: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}
		{@const borderColor = is2FA
			? 'border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-950/20'
			: isReset
				? 'border-amber-500/30 hover:border-amber-500/60 shadow-amber-950/20'
				: 'border-indigo-500/30 hover:border-indigo-500/60 shadow-indigo-950/20'}
		{@const typeLabel = is2FA
			? '2FA Security Code'
			: isReset
				? 'Password Reset'
				: 'Registration OTP'}

		<div
			in:fly={{ y: -20, duration: 200 }}
			out:fly={{ y: -10, duration: 150 }}
			class={`pointer-events-auto bg-slate-900/95 backdrop-blur-md border ${borderColor} rounded-xl p-4 shadow-2xl flex flex-col gap-3 transition-colors duration-200`}
		>
			<!-- Toast Header -->
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-2">
					<div
						class="relative flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"
					>
						<Sparkles class="h-4.5 w-4.5 animate-pulse text-indigo-400" />

						<span class="absolute top-0 right-0 flex h-2 w-2">
							<span
								class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"
							></span>
							<span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
						</span>
					</div>

					<div>
						<h4 class="text-xs font-extrabold text-slate-100 tracking-tight">
							Real-time OTP Received!
						</h4>

						<p class="text-[10px] text-slate-400 truncate max-w-[200px] font-mono">
							{toast.email.to}
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={() => dismissToast(toast.id)}
					class="p-1 text-slate-500 hover:text-slate-300 rounded-md hover:bg-slate-800/50 transition cursor-pointer"
					aria-label="Dismiss OTP notification"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Toast Body -->
			<div class="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 flex flex-col gap-2.5">
				<div class="flex items-center justify-between">
					<span
						class={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${badgeColor} tracking-wider`}
					>
						{typeLabel}
					</span>

					<span class="text-[10px] text-slate-500 font-mono">Just now</span>
				</div>

				<div class="flex items-center justify-between gap-4">
					<div
						class="flex gap-1.5 font-mono tracking-widest text-lg font-black text-white bg-slate-900/80 px-3 py-1.5 rounded-md border border-slate-800 w-full justify-center"
					>
						{#each toast.code.split('') as char, index (index)}
							<span class="text-slate-100">{char}</span>
						{/each}
					</div>

					<button
						type="button"
						onclick={(event) => handleCopyCode(event, toast.id, toast.code)}
						class="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md border border-slate-800 transition cursor-pointer"
						title="Copy OTP"
					>
						{#if isCopied}
							<Check class="h-4 w-4 text-emerald-400" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</button>
				</div>
			</div>

			<!-- Toast Actions -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={(event) => handleToastAutoFill(event, toast)}
					class="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition cursor-pointer"
				>
					<Zap class="h-3.5 w-3.5 text-amber-300 animate-bounce" />
					<span>⚡ Instant Auto-Fill & Continue</span>
				</button>
			</div>
		</div>
	{/each}
</div>

<div
	id="email-simulator-root"
	class={`fixed bottom-0 right-4 z-50 w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-xl shadow-2xl transition-all duration-300 transform ${
		isOpen ? 'h-[480px]' : 'h-12'
	} flex flex-col`}
>
	<!-- Header bar -->
	<div
		id="email-simulator-header"
		onclick={() => (isOpen = !isOpen)}
		class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-t-xl cursor-pointer hover:brightness-110 transition-all select-none"
	>
		<div class="flex items-center space-x-2">
			<div class="relative">
				<Mail class="h-5 w-5 text-indigo-400" />

				{#if unreadCount > 0}
					<span
						class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-bounce"
					>
						{unreadCount}
					</span>
				{/if}
			</div>

			<span class="font-semibold text-slate-200 text-sm"> GDGC Mailbox Simulator </span>

			<span
				class="text-xs bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono"
			>
				Sandbox Debugger
			</span>
		</div>

		<div class="flex items-center space-x-3">
			<button
				id="email-simulator-refresh-btn"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					fetchEmails();
				}}
				disabled={isRefreshing}
				class={`p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition ${
					isRefreshing ? 'animate-spin' : ''
				}`}
				title="Refresh Sandbox Mailbox"
			>
				<RefreshCw class="h-3.5 w-3.5" />
			</button>

			{#if emails.length > 0}
				<button
					id="email-simulator-clear-btn"
					type="button"
					onclick={clearEmails}
					class="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition"
					title="Clear Inbox"
				>
					<Trash2 class="h-3.5 w-3.5" />
				</button>
			{/if}

			{#if isOpen}
				<ChevronDown class="h-4 w-4 text-slate-400" />
			{:else}
				<ChevronUp class="h-4 w-4 text-slate-400" />
			{/if}
		</div>
	</div>

	<!-- Main Mailbox Area -->
	{#if isOpen}
		<div
			id="email-simulator-content"
			class="flex-1 overflow-hidden flex bg-slate-950 text-slate-300"
		>
			{#if selectedEmail}
				<!-- Email Detail View -->
				<div class="flex-1 flex flex-col h-full overflow-hidden">
					<div
						class="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between"
					>
						<button
							id="email-simulator-back-to-inbox"
							type="button"
							onclick={() => (selectedEmail = null)}
							class="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center"
						>
							← Back to Inbox
						</button>

						<span class="text-[10px] text-slate-500 font-mono flex items-center">
							<Clock class="h-3 w-3 mr-1" />
							{new Date(selectedEmail.timestamp).toLocaleTimeString()}
						</span>
					</div>

					<div class="p-4 border-b border-slate-800 bg-slate-900/20">
						<div class="text-xs text-slate-500 font-mono mb-1">
							To:
							<span class="text-slate-300 font-sans font-medium">
								{selectedEmail.to}
							</span>
						</div>

						<div class="font-semibold text-slate-100 text-sm">
							{selectedEmail.subject}
						</div>
					</div>

					<div class="flex-1 overflow-y-auto p-4 bg-white text-slate-800 text-sm">
						<div class="email-body-renderer">
							{@html selectedEmail.body}
						</div>

						{#if selectedEmail.body.includes('?view=reset-password')}
							<div
								class="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between"
							>
								<div>
									<h4 class="text-xs font-bold text-indigo-950">Developer Sandbox Shortcut:</h4>

									<p class="text-[11px] text-indigo-800">
										Directly load and fill this reset code in the form.
									</p>
								</div>

								<button
									id="email-simulator-autofill-reset"
									type="button"
									onclick={() => handleDirectLinkClick(selectedEmail!.body)}
									class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center space-x-1 shadow transition"
								>
									<span>Auto-Fill Form</span>
									<ArrowRight class="h-3 w-3" />
								</button>
							</div>
						{/if}

						{#if selectedOtpShortcut}
							<div
								class="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-between"
							>
								<div>
									<h4 class="text-xs font-bold text-emerald-950">Developer Sandbox Shortcut:</h4>

									<p class="text-[11px] text-emerald-800">
										Auto-fill the 6-digit OTP code (<strong
											>{selectedOtpShortcut.extractedCode}</strong
										>).
									</p>
								</div>

								<button
									id="email-simulator-autofill-otp"
									type="button"
									onclick={() =>
										handleAutoFillCode(
											selectedEmail!.to,
											selectedOtpShortcut!.extractedCode,
											selectedOtpShortcut!.viewType
										)}
									class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center space-x-1 shadow transition cursor-pointer"
								>
									<span>
										Auto-Fill {selectedOtpShortcut.is2FA ? '2FA' : 'OTP'}
									</span>
									<ArrowRight class="h-3 w-3" />
								</button>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<!-- Email List View -->
				<div class="flex-1 flex flex-col h-full overflow-hidden">
					{#if emails.length === 0}
						<div
							class="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500"
						>
							<div class="p-3 bg-slate-900 rounded-full mb-3 text-slate-700">
								<Mail class="h-8 w-8" />
							</div>

							<h3 class="font-semibold text-slate-300 text-sm">Sandbox Mailbox is Empty</h3>

							<p class="text-xs text-slate-600 mt-1 max-w-xs">
								Whenever an authentication action triggers an email registration verification or
								password reset, it will appear here.
							</p>
						</div>
					{:else}
						<div class="flex-1 overflow-y-auto divide-y divide-slate-900">
							{#each emails as email (email.id)}
								<div
									onclick={() => handleEmailClick(email)}
									class={`p-3.5 hover:bg-slate-900/60 transition-all cursor-pointer flex items-start space-x-3 border-l-2 ${
										!email.read ? 'border-indigo-500 bg-indigo-950/20' : 'border-transparent'
									}`}
								>
									<div class="mt-0.5">
										{#if email.read}
											<MailOpen class="h-4 w-4 text-slate-500" />
										{:else}
											<Mail class="h-4 w-4 text-indigo-400" />
										{/if}
									</div>

									<div class="flex-1 min-w-0">
										<div class="flex items-center justify-between">
											<span class="text-xs font-semibold text-indigo-300 truncate max-w-[150px]">
												{email.to}
											</span>

											<span class="text-[10px] text-slate-500">
												{new Date(email.timestamp).toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit'
												})}
											</span>
										</div>

										<div
											class={`text-xs truncate ${
												!email.read ? 'text-slate-100 font-semibold' : 'text-slate-400'
											}`}
										>
											{email.subject}
										</div>

										<div class="text-[11px] text-slate-500 truncate mt-0.5">
											{getEmailPreview(email.body)}...
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div
						class="p-2 border-t border-slate-900 bg-slate-950 text-[10px] text-slate-600 font-mono text-center"
					>
						System intercepts emails to keep demo running locally.
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
