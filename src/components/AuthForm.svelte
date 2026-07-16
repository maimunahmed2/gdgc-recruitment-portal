<script lang="ts">
	import {
		AlertCircle,
		ArrowRight,
		CheckCircle2,
		Eye,
		EyeOff,
		KeyRound,
		Lock,
		Mail,
		RefreshCw,
		ShieldCheck,
		User,
		XCircle
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	import type { User as AuthUser } from '../types';

	type AuthView =
		'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verify' | 'verify-2fa';

	type OAuthProvider = 'google' | 'github';

	type PasswordStrength = {
		score: number;
		hasMinLength: boolean;
		hasUpper: boolean;
		hasLower: boolean;
		hasNumber: boolean;
		hasSpecial: boolean;
		label: string;
		color: string;
	};

	type ApiResponse = {
		error?: string;
		message?: string;
		smtpConfigured?: boolean;
		mfaRequired?: boolean;
		token?: string;
		user?: AuthUser;
		url?: string;
	};

	type OAuthSuccessMessage = {
		type: 'OAUTH_AUTH_SUCCESS';
		token: string;
		user: AuthUser;
	};

	type OAuthFailureMessage = {
		type: 'OAUTH_AUTH_FAILURE';
		error?: string;
	};

	type Props = {
		onLoginSuccess: (token: string, user: AuthUser) => void;
		initialView?: AuthView;
		initialEmail?: string;
		initialCode?: string;
	};

	let {
		onLoginSuccess,
		initialView = 'login',
		initialEmail = '',
		initialCode = ''
	}: Props = $props();

	let view = $state<AuthView>(initialView);

	let name = $state('');
	let email = $state(initialEmail);
	let password = $state('');
	let confirmPassword = $state('');
	let rememberMe = $state(false);
	let otpCode = $state(initialCode);

	let resetCode = $state(initialCode);
	let newPassword = $state('');

	let showPassword = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let smtpConfigured = $state(true);

	let passwordStrength = $state<PasswordStrength>(createPasswordStrength(''));
	let demoMessageTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (initialEmail) email = initialEmail;

		if (initialCode) {
			otpCode = initialCode;
			resetCode = initialCode;
		}

		if (initialView) view = initialView;
	});

	function getErrorMessage(value: unknown, fallback = 'Something went wrong'): string {
		return value instanceof Error && value.message ? value.message : fallback;
	}

	function clearMessages(): void {
		error = null;
		successMessage = null;
	}

	function goTo(nextView: AuthView): void {
		view = nextView;
		clearMessages();
	}

	function onlyDigits(value: string): string {
		return value.replace(/\D/g, '').slice(0, 6);
	}

	function handleOtpInput(event: Event): void {
		otpCode = onlyDigits((event.currentTarget as HTMLInputElement).value);
	}

	function handleResetCodeInput(event: Event): void {
		resetCode = onlyDigits((event.currentTarget as HTMLInputElement).value);
	}

	function createPasswordStrength(pass: string): PasswordStrength {
		const hasMinLength = pass.length >= 8;
		const hasUpper = /[A-Z]/.test(pass);
		const hasLower = /[a-z]/.test(pass);
		const hasNumber = /\d/.test(pass);
		const hasSpecial = /[@$!%*?&]/.test(pass);

		let score = 0;
		if (hasMinLength) score += 20;
		if (hasUpper) score += 20;
		if (hasLower) score += 20;
		if (hasNumber) score += 20;
		if (hasSpecial) score += 20;

		let label = 'Very Weak';
		let color = 'bg-red-500';

		if (score >= 100) {
			label = 'Excellent';
			color = 'bg-emerald-500';
		} else if (score >= 80) {
			label = 'Strong';
			color = 'bg-teal-500';
		} else if (score >= 60) {
			label = 'Good';
			color = 'bg-yellow-500';
		} else if (score >= 40) {
			label = 'Weak';
			color = 'bg-orange-500';
		}

		return {
			score,
			hasMinLength,
			hasUpper,
			hasLower,
			hasNumber,
			hasSpecial,
			label,
			color
		};
	}

	function handlePasswordInput(event: Event): void {
		password = (event.currentTarget as HTMLInputElement).value;
		passwordStrength = createPasswordStrength(password);
	}

	function handleNewPasswordInput(event: Event): void {
		newPassword = (event.currentTarget as HTMLInputElement).value;
		passwordStrength = createPasswordStrength(newPassword);
	}

	function handleFillDemo(demoEmail: string, demoPassword: string): void {
		view = 'login';
		email = demoEmail;
		password = demoPassword;
		passwordStrength = createPasswordStrength(demoPassword);
		error = null;

		const message = 'Demo credentials filled successfully! Click "Sign In to Portal" below.';
		successMessage = message;

		if (demoMessageTimer) clearTimeout(demoMessageTimer);
		demoMessageTimer = setTimeout(() => {
			if (successMessage === message) successMessage = null;
		}, 4000);
	}

	onMount(() => {
		function handleMessage(event: MessageEvent<OAuthSuccessMessage | OAuthFailureMessage>): void {
			const trustedOrigin =
				event.origin === window.location.origin ||
				event.origin.endsWith('.run.app') ||
				event.origin.includes('localhost');

			if (!trustedOrigin) return;

			if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
				const { token, user } = event.data;
				successMessage = `Successfully authenticated via social sign-in! Welcome, ${user.name || 'Candidate'}.`;
				isLoading = false;

				setTimeout(() => {
					onLoginSuccess(token, user);
				}, 1000);
			} else if (event.data?.type === 'OAUTH_AUTH_FAILURE') {
				error = event.data.error || 'Authentication aborted or failed.';
				isLoading = false;
			}
		}

		window.addEventListener('message', handleMessage);

		return () => {
			window.removeEventListener('message', handleMessage);
			if (demoMessageTimer) clearTimeout(demoMessageTimer);
		};
	});

	async function parseResponse(response: Response): Promise<ApiResponse> {
		try {
			return (await response.json()) as ApiResponse;
		} catch {
			return {};
		}
	}

	async function handleOAuthLogin(provider: OAuthProvider): Promise<void> {
		clearMessages();
		isLoading = true;

		try {
			const response = await fetch(`/api/auth/oauth-url?provider=${provider}`);
			const data = await parseResponse(response);

			if (!response.ok || !data.url) {
				throw new Error(data.error || 'Failed to retrieve authorization credentials');
			}

			const width = 540;
			const height = 640;
			const left = window.screen.width / 2 - width / 2;
			const top = window.screen.height / 2 - height / 2;

			const authWindow = window.open(
				data.url,
				`oauth_popup_${provider}`,
				`width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
			);

			if (!authWindow) {
				error = 'Popup was blocked by your browser. Please allow popups for this site to log in.';
				isLoading = false;
			}
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'An error occurred during social authentication setup');
			isLoading = false;
		}
	}

	async function handleRegister(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearMessages();

		if (!name.trim()) return void (error = 'Please enter your full name');
		if (!email.trim()) return void (error = 'Please enter your email');
		if (!password) return void (error = 'Please enter a password');
		if (password !== confirmPassword) return void (error = 'Passwords do not match');
		if (passwordStrength.score < 60) {
			return void (error = 'Please make your password stronger before continuing.');
		}

		isLoading = true;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Registration failed');

			smtpConfigured = data.smtpConfigured !== false;
			successMessage = data.message || 'Registration successful! Verification code sent.';
			view = 'verify';
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Registration failed');
		} finally {
			isLoading = false;
		}
	}

	async function handleLogin(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return void (error = 'Please enter your email');
		if (!password) return void (error = 'Please enter your password');

		isLoading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, rememberMe })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Login failed');

			if (data.mfaRequired) {
				smtpConfigured = data.smtpConfigured !== false;
				successMessage = 'Two-Factor Authentication is required. Code sent to email.';

				setTimeout(() => {
					view = 'verify-2fa';
					otpCode = '';
					clearMessages();
				}, 1000);
				return;
			}

			if (!data.token || !data.user) throw new Error('The login response was incomplete');

			successMessage = 'Successfully logged in! Directing...';
			setTimeout(() => onLoginSuccess(data.token as string, data.user as AuthUser), 800);
		} catch (caughtError) {
			const message = getErrorMessage(caughtError, 'Login failed');
			error = message;

			if (message.toLowerCase().includes('verify')) {
				setTimeout(() => {
					view = 'verify';
				}, 1500);
			}
		} finally {
			isLoading = false;
		}
	}

	async function handleVerify2FA(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return void (error = 'Please enter your email address');
		if (!otpCode.trim()) return void (error = 'Please enter the 6-digit verification code');

		isLoading = true;

		try {
			const response = await fetch('/api/auth/verify-2fa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: otpCode.trim(), rememberMe })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Two-factor verification failed');
			if (!data.token || !data.user) throw new Error('The verification response was incomplete');

			successMessage = 'Two-factor authentication verified! Directing to portal...';
			setTimeout(() => onLoginSuccess(data.token as string, data.user as AuthUser), 1000);
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Two-factor verification failed');
		} finally {
			isLoading = false;
		}
	}

	async function handleResend2FA(): Promise<void> {
		clearMessages();

		if (!email.trim()) return void (error = 'Please enter your email address');

		isLoading = true;

		try {
			const response = await fetch('/api/auth/resend-2fa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Failed to resend 2FA code');

			smtpConfigured = data.smtpConfigured !== false;
			successMessage = 'A new secure One-Time Password has been sent to your email.';
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Failed to resend 2FA code');
		} finally {
			isLoading = false;
		}
	}

	async function handleVerifyOTP(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return void (error = 'Please enter your email address');
		if (!otpCode.trim()) return void (error = 'Please enter the 6-digit OTP');

		isLoading = true;

		try {
			const response = await fetch('/api/auth/verify-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: otpCode.trim() })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Verification failed');

			successMessage = data.message || 'Email verified successfully!';
			setTimeout(() => {
				view = 'login';
				password = '';
				clearMessages();
			}, 1500);
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Verification failed');
		} finally {
			isLoading = false;
		}
	}

	async function handleResendOTP(): Promise<void> {
		clearMessages();

		if (!email.trim()) return void (error = 'Email is required to resend verification code');

		isLoading = true;

		try {
			const response = await fetch('/api/auth/resend-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Resend failed');

			smtpConfigured = data.smtpConfigured !== false;
			successMessage = smtpConfigured
				? 'A new verification code has been dispatched directly to your actual email mailbox!'
				: 'A new verification code has been generated. Please check the server console logs.';
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Resend failed');
		} finally {
			isLoading = false;
		}
	}

	async function handleForgotPassword(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return void (error = 'Please enter your email address');

		isLoading = true;

		try {
			const response = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Failed to send reset code');

			smtpConfigured = data.smtpConfigured !== false;
			successMessage = smtpConfigured
				? 'A secure password reset OTP has been sent directly to your actual email mailbox!'
				: 'A reset code has been generated. Please check the server console logs for your OTP.';

			setTimeout(() => {
				view = 'reset-password';
				resetCode = '';
			}, 2500);
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Failed to send reset code');
		} finally {
			isLoading = false;
		}
	}

	async function handleResetPasswordSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return void (error = 'Please enter your email address');
		if (!resetCode.trim()) return void (error = 'Please enter the 6-digit reset code');
		if (!newPassword) return void (error = 'Please enter a new password');
		if (passwordStrength.score < 60) {
			return void (error = 'Your new password does not meet complexity standards.');
		}

		isLoading = true;

		try {
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: resetCode.trim(), newPassword })
			});
			const data = await parseResponse(response);

			if (!response.ok) throw new Error(data.error || 'Reset failed');

			successMessage = data.message || 'Password reset successfully! Redirecting...';
			setTimeout(() => {
				view = 'login';
				password = '';
				newPassword = '';
				passwordStrength = createPasswordStrength('');
				clearMessages();
			}, 1500);
		} catch (caughtError) {
			error = getErrorMessage(caughtError, 'Reset failed');
		} finally {
			isLoading = false;
		}
	}
</script>

<div id="auth-form-container" class="mx-auto w-full max-w-md">
	<div
		id="auth-form-card"
		class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="flex h-1.5 w-full" aria-hidden="true">
			<div class="h-full flex-1 bg-[#4285F4]"></div>
			<div class="h-full flex-1 bg-[#EA4335]"></div>
			<div class="h-full flex-1 bg-[#FBBC05]"></div>
			<div class="h-full flex-1 bg-[#34A853]"></div>
		</div>

		<div class="p-8">
			<div class="mb-6 flex flex-col items-center">
				<div
					class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 shadow-sm dark:border-indigo-900/30 dark:bg-indigo-950/40"
				>
					<ShieldCheck class="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
				</div>
				<h2 class="font-sans text-xl font-bold tracking-tight text-slate-900 dark:text-white">
					GDGC Secure Portal
				</h2>
				<p class="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
					Secure Unified Candidate Authentication
				</p>
			</div>

			{#if error}
				<div
					id="auth-error-msg"
					in:fly={{ y: -8, duration: 180 }}
					class="mb-5 flex items-start space-x-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400"
					role="alert"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
					<span>{error}</span>
				</div>
			{/if}

			{#if successMessage}
				<div
					id="auth-success-msg"
					in:fly={{ y: -8, duration: 180 }}
					class="mb-5 flex items-start space-x-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
					role="status"
				>
					<CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0" />
					<span>{successMessage}</span>
				</div>
			{/if}

			{#key view}
				{#if view === 'login'}
					<form
						id="login-form"
						in:fly={{ x: -10, duration: 200 }}
						out:fly={{ x: 10, duration: 150 }}
						onsubmit={handleLogin}
						class="space-y-4"
					>
						<div>
							<label
								for="login-email-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Email Address
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
									<Mail class="h-4 w-4" />
								</span>
								<input
									id="login-email-input"
									type="email"
									bind:value={email}
									placeholder="you@gdgc.edu"
									autocomplete="email"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<div>
							<div class="mb-1.5 flex items-center justify-between">
								<label
									for="login-password-input"
									class="text-xs font-semibold text-slate-600 dark:text-slate-400"
								>
									Password
								</label>
								<button
									id="login-forgot-pass-btn"
									type="button"
									onclick={() => goTo('forgot-password')}
									class="text-xs font-medium text-indigo-600 hover:text-indigo-500 hover:underline focus:outline-none"
								>
									Forgot Password?
								</button>
							</div>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
									<Lock class="h-4 w-4" />
								</span>
								<input
									id="login-password-input"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									placeholder="••••••••"
									autocomplete="current-password"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
								<button
									id="login-toggle-pass-visibility"
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none dark:hover:text-slate-200"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
								</button>
							</div>
						</div>

						<div class="flex items-center justify-between py-1">
							<label class="flex cursor-pointer items-center space-x-2.5">
								<input
									id="login-remember-me-checkbox"
									type="checkbox"
									bind:checked={rememberMe}
									class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950"
								/>
								<span class="select-none text-xs font-medium text-slate-500 dark:text-slate-400">
									Remember my device (7 days)
								</span>
							</label>
						</div>

						<button
							id="login-submit-btn"
							type="submit"
							disabled={isLoading}
							class="flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:bg-indigo-400"
						>
							{#if isLoading}
								<RefreshCw class="h-4 w-4 animate-spin" />
							{:else}
								<span>Sign In to Portal</span>
								<ArrowRight class="h-4 w-4" />
							{/if}
						</button>

						<div class="relative my-4">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-slate-100 dark:border-slate-800"></div>
							</div>
							<div class="relative flex justify-center text-[10px] uppercase">
								<span class="select-none bg-white px-3 font-bold text-slate-400 dark:bg-slate-900">
									or continue with
								</span>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3 pb-2">
							<button
								id="google-login-btn"
								type="button"
								disabled={isLoading}
								onclick={() => handleOAuthLogin('google')}
								class="flex cursor-pointer items-center justify-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
							>
								<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
									<path
										d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.56h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.49c0,-0.64 -0.06,-1.27 -0.17,-1.87Z"
										fill="#4285F4"
									/>
									<path
										d="M12,20.58c2.59,0 4.77,-0.86 6.36,-2.33l-3.3,-2.56c-0.91,0.61 -2.08,0.98 -3.06,0.98c-2.4,0 -4.43,-1.62 -5.16,-3.82H3.38v2.64c1.62,3.23 4.97,5.09 8.62,5.09Z"
										fill="#34A853"
									/>
									<path
										d="M6.84,12.85c-0.18,-0.55 -0.29,-1.13 -0.29,-1.73s0.11,-1.18 0.29,-1.73V6.75H3.38c-0.62,1.24 -0.98,2.64 -0.98,4.12s0.36,2.88 0.98,4.12l3.46,-2.64Z"
										fill="#FBBC05"
									/>
									<path
										d="M12,6.13c1.41,0 2.68,0.49 3.68,1.44l2.76,-2.76C16.77,3.22 14.59,2.42 12,2.42c-3.65,0 -7,1.86 -8.62,5.09l3.46,2.64c0.73,-2.2 2.76,-3.82 5.16,-3.82Z"
										fill="#EA4335"
									/>
								</svg>
								<span>Google</span>
							</button>

							<button
								id="github-login-btn"
								type="button"
								disabled={isLoading}
								onclick={() => handleOAuthLogin('github')}
								class="flex cursor-pointer items-center justify-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
							>
								<svg
									class="h-3.5 w-3.5 fill-current text-slate-900 dark:text-white"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										d="M12,2A10,10,0,0,0,8.84,21.5c.5.08.66-.23.66-.5V19.31c-2.77.6-3.36-1.34-3.36-1.34A2.65,2.65,0,0,0,5,16.5c-.91-.62.07-.61.07-.61a2.1,2.1,0,0,1,1.53,1,2.13,2.13,0,0,0,2.91.83,2.16,2.16,0,0,1,.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92a3.88,3.88,0,0,1,1-2.69,3.61,3.61,0,0,1,.1-2.65s.84-.27,2.75,1a9.5,9.5,0,0,1,5,0c1.91-1.29,2.75-1,2.75-1a3.61,3.61,0,0,1,.1,2.65,3.88,3.88,0,0,1,1,2.69c0,3.82-2.34,4.66-4.57,4.91a2.39,2.39,0,0,1,.68,1.85V21c0,.27.16.59.67.5A10,10,0,0,0,12,2Z"
									/>
								</svg>
								<span>GitHub</span>
							</button>
						</div>

						<div class="border-t border-slate-100 pt-4 text-center dark:border-slate-800/80">
							<span class="text-xs text-slate-500 dark:text-slate-400"
								>Don't have an account yet?
							</span>
							<button
								id="login-go-to-signup"
								type="button"
								onclick={() => goTo('signup')}
								class="text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline focus:outline-none"
							>
								Create Account
							</button>
						</div>
					</form>
				{:else if view === 'signup'}
					<form
						id="signup-form"
						in:fly={{ x: -10, duration: 200 }}
						out:fly={{ x: 10, duration: 150 }}
						onsubmit={handleRegister}
						class="space-y-4"
					>
						<div>
							<label
								for="signup-name-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Full Name
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
									<User class="h-4 w-4" />
								</span>
								<input
									id="signup-name-input"
									type="text"
									required
									bind:value={name}
									placeholder="Alex Candidate"
									autocomplete="name"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<div>
							<label
								for="signup-email-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Email Address
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
									<Mail class="h-4 w-4" />
								</span>
								<input
									id="signup-email-input"
									type="email"
									required
									bind:value={email}
									placeholder="alex@gdgc.edu"
									autocomplete="email"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<div>
							<label
								for="signup-password-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Password
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
									<Lock class="h-4 w-4" />
								</span>
								<input
									id="signup-password-input"
									type={showPassword ? 'text' : 'password'}
									required
									value={password}
									oninput={handlePasswordInput}
									placeholder="••••••••"
									autocomplete="new-password"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
								<button
									id="signup-toggle-pass-visibility"
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none dark:hover:text-slate-200"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
								</button>
							</div>

							{#if password.length > 0}
								<div
									id="password-strength-container"
									class="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800/60 dark:bg-slate-950"
								>
									<div class="mb-1 flex items-center justify-between text-[11px]">
										<span class="font-semibold text-slate-500 dark:text-slate-400"
											>Password Strength:</span
										>
										<span class="font-bold text-slate-700 dark:text-slate-200"
											>{passwordStrength.label}</span
										>
									</div>
									<div
										class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
									>
										<div
											id="password-strength-bar"
											class={`h-full ${passwordStrength.color} transition-all duration-300`}
											style={`width: ${passwordStrength.score}%`}
										></div>
									</div>
									<div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
										<div class="flex items-center space-x-1.5">
											{#if passwordStrength.hasMinLength}
												<CheckCircle2 class="h-3 w-3 text-emerald-500" />
											{:else}
												<XCircle class="h-3 w-3 text-slate-300 dark:text-slate-700" />
											{/if}
											<span
												class={passwordStrength.hasMinLength
													? 'font-medium text-emerald-600 dark:text-emerald-400'
													: 'text-slate-400'}
											>
												8+ Characters
											</span>
										</div>
										<div class="flex items-center space-x-1.5">
											{#if passwordStrength.hasUpper}
												<CheckCircle2 class="h-3 w-3 text-emerald-500" />
											{:else}
												<XCircle class="h-3 w-3 text-slate-300 dark:text-slate-700" />
											{/if}
											<span
												class={passwordStrength.hasUpper
													? 'font-medium text-emerald-600 dark:text-emerald-400'
													: 'text-slate-400'}
											>
												1+ Uppercase
											</span>
										</div>
										<div class="flex items-center space-x-1.5">
											{#if passwordStrength.hasLower}
												<CheckCircle2 class="h-3 w-3 text-emerald-500" />
											{:else}
												<XCircle class="h-3 w-3 text-slate-300 dark:text-slate-700" />
											{/if}
											<span
												class={passwordStrength.hasLower
													? 'font-medium text-emerald-600 dark:text-emerald-400'
													: 'text-slate-400'}
											>
												1+ Lowercase
											</span>
										</div>
										<div class="flex items-center space-x-1.5">
											{#if passwordStrength.hasNumber && passwordStrength.hasSpecial}
												<CheckCircle2 class="h-3 w-3 text-emerald-500" />
											{:else}
												<XCircle class="h-3 w-3 text-slate-300 dark:text-slate-700" />
											{/if}
											<span
												class={passwordStrength.hasNumber && passwordStrength.hasSpecial
													? 'font-medium text-emerald-600 dark:text-emerald-400'
													: 'text-slate-400'}
											>
												Number &amp; Special
											</span>
										</div>
									</div>
								</div>
							{/if}
						</div>

						<div>
							<label
								for="signup-confirm-password-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Confirm Password
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
									<KeyRound class="h-4 w-4" />
								</span>
								<input
									id="signup-confirm-password-input"
									type="password"
									required
									bind:value={confirmPassword}
									placeholder="••••••••"
									autocomplete="new-password"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
							{#if password && confirmPassword && password !== confirmPassword}
								<p
									id="password-mismatch-warning"
									class="mt-1 text-[10px] font-semibold text-red-500"
								>
									Passwords do not match.
								</p>
							{/if}
						</div>

						<button
							id="signup-submit-btn"
							type="submit"
							disabled={isLoading}
							class="mt-2 flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:bg-indigo-400"
						>
							{#if isLoading}
								<RefreshCw class="h-4 w-4 animate-spin" />
							{:else}
								<span>Create Account</span>
								<ArrowRight class="h-4 w-4" />
							{/if}
						</button>

						<div class="relative my-4">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-slate-100 dark:border-slate-800"></div>
							</div>
							<div class="relative flex justify-center text-[10px] uppercase">
								<span class="select-none bg-white px-3 font-bold text-slate-400 dark:bg-slate-900">
									or continue with
								</span>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3 pb-2">
							<button
								id="google-signup-btn"
								type="button"
								disabled={isLoading}
								onclick={() => handleOAuthLogin('google')}
								class="flex cursor-pointer items-center justify-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
							>
								<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
									<path
										d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.56h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.49c0,-0.64 -0.06,-1.27 -0.17,-1.87Z"
										fill="#4285F4"
									/>
									<path
										d="M12,20.58c2.59,0 4.77,-0.86 6.36,-2.33l-3.3,-2.56c-0.91,0.61 -2.08,0.98 -3.06,0.98c-2.4,0 -4.43,-1.62 -5.16,-3.82H3.38v2.64c1.62,3.23 4.97,5.09 8.62,5.09Z"
										fill="#34A853"
									/>
									<path
										d="M6.84,12.85c-0.18,-0.55 -0.29,-1.13 -0.29,-1.73s0.11,-1.18 0.29,-1.73V6.75H3.38c-0.62,1.24 -0.98,2.64 -0.98,4.12s0.36,2.88 0.98,4.12l3.46,-2.64Z"
										fill="#FBBC05"
									/>
									<path
										d="M12,6.13c1.41,0 2.68,0.49 3.68,1.44l2.76,-2.76C16.77,3.22 14.59,2.42 12,2.42c-3.65,0 -7,1.86 -8.62,5.09l3.46,2.64c0.73,-2.2 2.76,-3.82 5.16,-3.82Z"
										fill="#EA4335"
									/>
								</svg>
								<span>Google</span>
							</button>

							<button
								id="github-signup-btn"
								type="button"
								disabled={isLoading}
								onclick={() => handleOAuthLogin('github')}
								class="flex cursor-pointer items-center justify-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
							>
								<svg
									class="h-3.5 w-3.5 fill-current text-slate-900 dark:text-white"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										d="M12,2A10,10,0,0,0,8.84,21.5c.5.08.66-.23.66-.5V19.31c-2.77.6-3.36-1.34-3.36-1.34A2.65,2.65,0,0,0,5,16.5c-.91-.62.07-.61.07-.61a2.1,2.1,0,0,1,1.53,1,2.13,2.13,0,0,0,2.91.83,2.16,2.16,0,0,1,.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92a3.88,3.88,0,0,1,1-2.69,3.61,3.61,0,0,1,.1-2.65s.84-.27,2.75,1a9.5,9.5,0,0,1,5,0c1.91-1.29,2.75-1,2.75-1a3.61,3.61,0,0,1,.1,2.65,3.88,3.88,0,0,1,1,2.69c0,3.82-2.34,4.66-4.57,4.91a2.39,2.39,0,0,1,.68,1.85V21c0,.27.16.59.67.5A10,10,0,0,0,12,2Z"
									/>
								</svg>
								<span>GitHub</span>
							</button>
						</div>

						<div class="border-t border-slate-100 pt-4 text-center dark:border-slate-800/80">
							<span class="text-xs text-slate-500 dark:text-slate-400">Already registered? </span>
							<button
								id="signup-go-to-login"
								type="button"
								onclick={() => goTo('login')}
								class="text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline focus:outline-none"
							>
								Log In Instead
							</button>
						</div>
					</form>
				{:else if view === 'verify'}
					<form
						id="verify-form"
						in:fly={{ x: -10, duration: 200 }}
						out:fly={{ x: 10, duration: 150 }}
						onsubmit={handleVerifyOTP}
						class="space-y-4"
					>
						{#if smtpConfigured}
							<div
								class="flex items-start space-x-2 rounded-lg border border-emerald-200/50 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
							>
								<ShieldCheck
									class="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400"
								/>
								<span>
									A secure 6-digit email verification OTP has been dispatched <strong
										>directly to your actual mailbox</strong
									> via SMTP. Please check your inbox and spam folder.
								</span>
							</div>
						{:else}
							<div
								class="flex flex-col gap-1 rounded-lg border border-amber-200/50 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
							>
								<div class="flex items-start space-x-2">
									<AlertCircle
										class="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-600 dark:text-amber-400"
									/>
									<span class="font-semibold text-amber-900 dark:text-amber-300"
										>SMTP Settings Not Active</span
									>
								</div>
								<span class="text-[11px] text-slate-600 dark:text-slate-400">
									Your real SMTP credentials are not configured in your AI Studio secrets panel yet.
								</span>
								<div
									class="mt-1 rounded border border-slate-200 bg-slate-900/10 p-1.5 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40"
								>
									Check your server console terminal for the generated 6-digit OTP code to continue!
								</div>
							</div>
						{/if}

						<div>
							<label
								for="verify-email-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Verification Email
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
									><Mail class="h-4 w-4" /></span
								>
								<input
									id="verify-email-input"
									type="email"
									required
									bind:value={email}
									placeholder="you@gdgc.edu"
									autocomplete="email"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<div>
							<label
								for="verify-otp-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								6-Digit One-Time Password (OTP)
							</label>
							<input
								id="verify-otp-input"
								type="text"
								required
								maxlength="6"
								inputmode="numeric"
								value={otpCode}
								oninput={handleOtpInput}
								placeholder="123456"
								autocomplete="one-time-code"
								class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-center font-mono text-lg font-bold tracking-[8px] text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
							/>
						</div>

						<div class="flex items-center justify-between pt-1 text-xs">
							<span class="text-slate-500 dark:text-slate-400">Didn't receive the OTP?</span>
							<button
								id="verify-resend-btn"
								type="button"
								onclick={handleResendOTP}
								disabled={isLoading}
								class="flex items-center space-x-1 font-bold text-indigo-600 hover:text-indigo-500 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
							>
								<RefreshCw class="h-3 w-3" />
								<span>Resend Code</span>
							</button>
						</div>

						<button
							id="verify-submit-btn"
							type="submit"
							disabled={isLoading}
							class="mt-2 flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:bg-indigo-400"
						>
							{#if isLoading}<RefreshCw class="h-4 w-4 animate-spin" />{:else}<span
									>Verify Email &amp; Activate</span
								>{/if}
						</button>

						<div class="pt-2 text-center">
							<button
								id="verify-back-to-login"
								type="button"
								onclick={() => goTo('login')}
								class="text-xs font-bold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400"
							>
								← Return to Login
							</button>
						</div>
					</form>
				{:else if view === 'verify-2fa'}
					<form
						id="verify-2fa-form"
						in:fly={{ x: -10, duration: 200 }}
						out:fly={{ x: 10, duration: 150 }}
						onsubmit={handleVerify2FA}
						class="space-y-4"
					>
						{#if smtpConfigured}
							<div
								class="flex animate-pulse items-start space-x-2 rounded-lg border border-emerald-200/50 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
							>
								<ShieldCheck
									class="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400"
								/>
								<span>
									Two-Factor Authentication is enabled. A secure 6-digit security code has been
									dispatched <strong>directly to your actual mailbox</strong> via SMTP. Please check your
									spam folder if it does not appear in a moment.
								</span>
							</div>
						{:else}
							<div
								class="flex flex-col gap-1 rounded-lg border border-amber-200/50 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
							>
								<div class="flex items-start space-x-2">
									<AlertCircle
										class="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-600 dark:text-amber-400"
									/>
									<span class="font-semibold text-amber-900 dark:text-amber-300"
										>SMTP Settings Not Active</span
									>
								</div>
								<span class="text-[11px] text-slate-600 dark:text-slate-400">
									Your real SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured in
									your AI Studio secrets panel yet.
								</span>
								<div
									class="mt-1 rounded border border-slate-200 bg-slate-900/10 p-1.5 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40"
								>
									Check your server console terminal for the generated 6-digit OTP code to continue!
								</div>
							</div>
						{/if}

						<div>
							<label
								for="verify-2fa-email"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
								>Your Account Email</label
							>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
									><Mail class="h-4 w-4" /></span
								>
								<input
									id="verify-2fa-email"
									type="email"
									disabled
									value={email}
									class="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 py-2 pr-3 pl-9 text-sm text-slate-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
								/>
							</div>
						</div>

						<div>
							<label
								for="verify-2fa-code"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
								>6-Digit Secure Verification Code</label
							>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
									><KeyRound class="h-4 w-4 text-indigo-500" /></span
								>
								<input
									id="verify-2fa-code"
									type="text"
									required
									maxlength="6"
									inputmode="numeric"
									value={otpCode}
									oninput={handleOtpInput}
									placeholder="123456"
									autocomplete="one-time-code"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-center font-mono text-lg font-bold tracking-[8px] text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<button
							id="verify-2fa-submit"
							type="submit"
							disabled={isLoading}
							class="mt-2 flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:bg-indigo-400"
						>
							{#if isLoading}<RefreshCw class="h-4 w-4 animate-spin" />{:else}<span
									>Confirm &amp; Complete Secure Sign In</span
								>{/if}
						</button>

						<div class="flex items-center justify-between pt-2">
							<button
								id="verify-2fa-back-to-login"
								type="button"
								onclick={() => goTo('login')}
								class="text-xs font-bold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400"
							>
								← Return to Login
							</button>
							<button
								id="verify-2fa-resend"
								type="button"
								disabled={isLoading}
								onclick={handleResend2FA}
								class="cursor-pointer text-xs font-bold text-indigo-600 transition hover:text-indigo-500 disabled:cursor-not-allowed disabled:text-slate-400"
							>
								Resend Security Code
							</button>
						</div>
					</form>
				{:else if view === 'forgot-password'}
					<form
						id="forgot-password-form"
						in:fly={{ x: -10, duration: 200 }}
						out:fly={{ x: 10, duration: 150 }}
						onsubmit={handleForgotPassword}
						class="space-y-4"
					>
						<div
							class="mb-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400"
						>
							Enter your registered candidate email. If the account exists, we will issue a secure
							6-digit OTP to reset your credentials.
						</div>

						<div>
							<label
								for="forgot-email-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
							>
								Candidate Email Address
							</label>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
									><Mail class="h-4 w-4" /></span
								>
								<input
									id="forgot-email-input"
									type="email"
									required
									bind:value={email}
									placeholder="you@gdgc.edu"
									autocomplete="email"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<button
							id="forgot-submit-btn"
							type="submit"
							disabled={isLoading}
							class="flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:bg-indigo-400"
						>
							{#if isLoading}<RefreshCw class="h-4 w-4 animate-spin" />{:else}<span
									>Request Password Reset OTP</span
								>{/if}
						</button>

						<div class="pt-2 text-center">
							<button
								id="forgot-back-to-login"
								type="button"
								onclick={() => goTo('login')}
								class="text-xs font-bold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400"
							>
								← Return to Sign In
							</button>
						</div>
					</form>
				{:else if view === 'reset-password'}
					<form
						id="reset-password-form"
						in:fly={{ x: -10, duration: 200 }}
						out:fly={{ x: 10, duration: 150 }}
						onsubmit={handleResetPasswordSubmit}
						class="space-y-4"
					>
						{#if smtpConfigured}
							<div
								class="flex items-start space-x-2 rounded-lg border border-emerald-200/50 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
							>
								<ShieldCheck
									class="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400"
								/>
								<span>
									A secure 6-digit password reset OTP has been dispatched <strong
										>directly to your actual mailbox</strong
									> via SMTP. Please check your inbox and spam folder.
								</span>
							</div>
						{:else}
							<div
								class="flex flex-col gap-1 rounded-lg border border-amber-200/50 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
							>
								<div class="flex items-start space-x-2">
									<AlertCircle
										class="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-600 dark:text-amber-400"
									/>
									<span class="font-semibold text-amber-900 dark:text-amber-300"
										>SMTP Settings Not Active</span
									>
								</div>
								<span class="text-[11px] text-slate-600 dark:text-slate-400">
									Your real SMTP credentials are not configured in your AI Studio secrets panel yet.
								</span>
								<div
									class="mt-1 rounded border border-slate-200 bg-slate-900/10 p-1.5 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40"
								>
									Check your server console terminal for the generated 6-digit OTP code to continue!
								</div>
							</div>
						{/if}

						<div>
							<label
								for="reset-email-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
								>Candidate Email Address</label
							>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
									><Mail class="h-4 w-4" /></span
								>
								<input
									id="reset-email-input"
									type="email"
									required
									bind:value={email}
									placeholder="you@gdgc.edu"
									autocomplete="email"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
							</div>
						</div>

						<div>
							<label
								for="reset-code-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
								>6-Digit Password Reset Code</label
							>
							<input
								id="reset-code-input"
								type="text"
								required
								maxlength="6"
								inputmode="numeric"
								value={resetCode}
								oninput={handleResetCodeInput}
								placeholder="123456"
								autocomplete="one-time-code"
								class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-center font-mono text-lg font-bold tracking-[6px] text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
							/>
						</div>

						<div>
							<label
								for="reset-new-password-input"
								class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
								>New Secure Password</label
							>
							<div class="relative">
								<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
									><Lock class="h-4 w-4" /></span
								>
								<input
									id="reset-new-password-input"
									type={showPassword ? 'text' : 'password'}
									required
									value={newPassword}
									oninput={handleNewPasswordInput}
									placeholder="••••••••"
									autocomplete="new-password"
									class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-9 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
								/>
								<button
									id="reset-toggle-pass-visibility"
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none dark:hover:text-slate-200"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
								</button>
							</div>

							{#if newPassword.length > 0}
								<div
									id="reset-password-strength-container"
									class="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800/60 dark:bg-slate-950"
								>
									<div class="mb-1 flex items-center justify-between text-[11px]">
										<span class="font-semibold text-slate-500 dark:text-slate-400"
											>Password Strength:</span
										>
										<span class="font-bold text-slate-700 dark:text-slate-200"
											>{passwordStrength.label}</span
										>
									</div>
									<div
										class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
									>
										<div
											id="reset-password-strength-bar"
											class={`h-full ${passwordStrength.color} transition-all duration-300`}
											style={`width: ${passwordStrength.score}%`}
										></div>
									</div>
								</div>
							{/if}
						</div>

						<button
							id="reset-submit-btn"
							type="submit"
							disabled={isLoading}
							class="mt-2 flex w-full cursor-pointer items-center justify-center space-x-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/20 disabled:cursor-not-allowed disabled:bg-indigo-400"
						>
							{#if isLoading}<RefreshCw class="h-4 w-4 animate-spin" />{:else}<span
									>Update Credentials</span
								>{/if}
						</button>

						<div class="pt-2 text-center">
							<button
								id="reset-back-to-login"
								type="button"
								onclick={() => goTo('login')}
								class="text-xs font-bold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400"
							>
								← Return to Login
							</button>
						</div>
					</form>
				{/if}
			{/key}
		</div>
	</div>

	<div
		id="auth-demo-helper"
		class="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
	>
		<h4 class="mb-2 text-xs font-bold tracking-wider text-slate-700 uppercase dark:text-slate-300">
			💡 Tester Demo Credentials
		</h4>
		<p class="mb-3 text-[10px] text-slate-400 dark:text-slate-500">
			Click either account below to instantly pre-fill credentials and prepare login details!
		</p>
		<div class="grid grid-cols-2 gap-3 text-[11px]">
			<button
				type="button"
				onclick={() => handleFillDemo('admin@gdgc.edu', 'AdminPass123!')}
				class="group cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-indigo-500 hover:shadow-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-500"
			>
				<span
					class="mb-0.5 block font-bold text-indigo-600 group-hover:text-indigo-700 dark:text-indigo-400"
					>Admin Account</span
				>
				<span class="block font-mono text-xs text-slate-600 dark:text-slate-300"
					>admin@gdgc.edu</span
				>
				<span class="mt-0.5 block font-mono text-[10px] text-slate-400 dark:text-slate-500"
					>Password: AdminPass123!</span
				>
			</button>

			<button
				type="button"
				onclick={() => handleFillDemo('user@gdgc.edu', 'UserPass123!')}
				class="group cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-indigo-500 hover:shadow-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-500"
			>
				<span
					class="mb-0.5 block font-bold text-indigo-600 group-hover:text-indigo-700 dark:text-indigo-400"
					>Regular Account</span
				>
				<span class="block font-mono text-xs text-slate-600 dark:text-slate-300">user@gdgc.edu</span
				>
				<span class="mt-0.5 block font-mono text-[10px] text-slate-400 dark:text-slate-500"
					>Password: UserPass123!</span
				>
			</button>
		</div>
	</div>
</div>
