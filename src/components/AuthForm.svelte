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

	type AuthView =
		'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verify' | 'verify-2fa';

	interface AuthFormProps {
		onLoginSuccess: (token: string, user: any) => void;
		initialView?: AuthView;
		initialEmail?: string;
		initialCode?: string;
	}

	interface PasswordStrength {
		score: number;
		hasMinLength: boolean;
		hasUpper: boolean;
		hasLower: boolean;
		hasNumber: boolean;
		hasSpecial: boolean;
		label: string;
		color: string;
	}

	let {
		onLoginSuccess,
		initialView = 'login',
		initialEmail = '',
		initialCode = ''
	}: AuthFormProps = $props();

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
	let smtpConfigured = $state<boolean>(true);

	let passwordStrength = $state<PasswordStrength>({
		score: 0,
		hasMinLength: false,
		hasUpper: false,
		hasLower: false,
		hasNumber: false,
		hasSpecial: false,
		label: 'Very Weak',
		color: 'bg-red-500'
	});

	$effect(() => {
		if (initialEmail) email = initialEmail;

		if (initialCode) {
			otpCode = initialCode;
			resetCode = initialCode;
		}

		if (initialView) view = initialView;
	});

	function clearMessages() {
		error = null;
		successMessage = null;
	}

	function goTo(nextView: AuthView) {
		view = nextView;
		clearMessages();
	}

	function getInputValue(event: Event) {
		return (event.currentTarget as HTMLInputElement).value;
	}

	function checkPasswordStrength(pass: string) {
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

		passwordStrength = {
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

	function handlePasswordChange(event: Event) {
		const value = getInputValue(event);
		password = value;
		checkPasswordStrength(value);
	}

	function handleNewPasswordChange(event: Event) {
		const value = getInputValue(event);
		newPassword = value;
		checkPasswordStrength(value);
	}

	onMount(() => {
		function handleMessage(event: MessageEvent) {
			const origin = event.origin;

			if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
				return;
			}

			if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
				const { token, user } = event.data;

				successMessage = `Successfully authenticated via social sign-in! Welcome, ${
					user.name || 'Candidate'
				}.`;
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
		};
	});

	async function handleOAuthLogin(provider: 'google' | 'github') {
		clearMessages();
		isLoading = true;

		try {
			const response = await fetch(`/api/auth/oauth-url?provider=${provider}`);

			if (!response.ok) {
				throw new Error('Failed to retrieve authorization credentials');
			}

			const { url } = await response.json();

			const width = 540;
			const height = 640;
			const left = window.screen.width / 2 - width / 2;
			const top = window.screen.height / 2 - height / 2;

			const authWindow = window.open(
				url,
				`oauth_popup_${provider}`,
				`width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
			);

			if (!authWindow) {
				error = 'Popup was blocked by your browser. Please allow popups for this site to log in.';
				isLoading = false;
			}
		} catch (err: any) {
			error = err.message || 'An error occurred during social authentication setup';
			isLoading = false;
		}
	}

	async function handleRegister(event: SubmitEvent) {
		event.preventDefault();
		clearMessages();

		if (!name.trim()) return (error = 'Please enter your full name');
		if (!email.trim()) return (error = 'Please enter your email');
		if (!password) return (error = 'Please enter a password');
		if (password !== confirmPassword) return (error = 'Passwords do not match');

		if (passwordStrength.score < 60) {
			return (error = 'Please make your password stronger before continuing.');
		}

		isLoading = true;

		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Registration failed');
			}

			smtpConfigured = data.smtpConfigured !== false;
			successMessage = data.message || 'Registration successful! Verification code sent.';
			view = 'verify';
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return (error = 'Please enter your email');
		if (!password) return (error = 'Please enter your password');

		isLoading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, rememberMe })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Login failed');
			}

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

			successMessage = 'Successfully logged in! Directing...';

			setTimeout(() => {
				onLoginSuccess(data.token, data.user);
			}, 800);
		} catch (err: any) {
			error = err.message;

			if (err.message && err.message.toLowerCase().includes('verify')) {
				setTimeout(() => {
					view = 'verify';
				}, 1500);
			}
		} finally {
			isLoading = false;
		}
	}

	async function handleVerify2FA(event: SubmitEvent) {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return (error = 'Please enter your email address');
		if (!otpCode.trim()) return (error = 'Please enter the 6-digit verification code');

		isLoading = true;

		try {
			const res = await fetch('/api/auth/verify-2fa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: otpCode.trim(), rememberMe })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Two-factor verification failed');
			}

			successMessage = 'Two-factor authentication verified! Directing to portal...';

			setTimeout(() => {
				onLoginSuccess(data.token, data.user);
			}, 1000);
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleResend2FA() {
		clearMessages();
		isLoading = true;

		try {
			const res = await fetch('/api/auth/resend-2fa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to resend 2FA code');
			}

			smtpConfigured = data.smtpConfigured !== false;
			successMessage = 'A new secure One-Time Password has been sent to your email.';
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleVerifyOTP(event: SubmitEvent) {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return (error = 'Please enter your email address');
		if (!otpCode.trim()) return (error = 'Please enter the 6-digit OTP');

		isLoading = true;

		try {
			const res = await fetch('/api/auth/verify-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: otpCode.trim() })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Verification failed');
			}

			successMessage = data.message || 'Email verified successfully!';

			setTimeout(() => {
				view = 'login';
				password = '';
				clearMessages();
			}, 1500);
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleResendOTP() {
		clearMessages();

		if (!email.trim()) return (error = 'Email is required to resend verification code');

		isLoading = true;

		try {
			const res = await fetch('/api/auth/resend-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Resend failed');
			}

			smtpConfigured = data.smtpConfigured !== false;

			if (data.smtpConfigured !== false) {
				successMessage =
					'A new verification code has been dispatched directly to your actual email mailbox!';
			} else {
				successMessage =
					'A new verification code has been generated. Please check the server console logs.';
			}
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleForgotPassword(event: SubmitEvent) {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return (error = 'Please enter your email address');

		isLoading = true;

		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to send reset code');
			}

			const isSmtp = data.smtpConfigured !== false;
			smtpConfigured = isSmtp;

			if (isSmtp) {
				successMessage =
					'A secure password reset OTP has been sent directly to your actual email mailbox!';
			} else {
				successMessage =
					'A reset code has been generated. Please check the server console logs for your OTP.';
			}

			setTimeout(() => {
				view = 'reset-password';
				resetCode = '';
			}, 2500);
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleResetPasswordSubmit(event: SubmitEvent) {
		event.preventDefault();
		clearMessages();

		if (!email.trim()) return (error = 'Please enter your email address');
		if (!resetCode.trim()) return (error = 'Please enter the 6-digit reset code');
		if (!newPassword) return (error = 'Please enter a new password');

		if (passwordStrength.score < 60) {
			return (error = 'Your new password does not meet complexity standards.');
		}

		isLoading = true;

		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code: resetCode.trim(), newPassword })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Reset failed');
			}

			successMessage = data.message || 'Password reset successfully! Redirecting...';

			setTimeout(() => {
				view = 'login';
				password = '';
				clearMessages();
			}, 1500);
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div id="auth-form-container" class="w-full max-w-md mx-auto">
	<div
		id="auth-form-card"
		class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300"
	>
		<div class="h-1.5 w-full flex">
			<div class="h-full flex-1 bg-[#4285F4]"></div>
			<div class="h-full flex-1 bg-[#EA4335]"></div>
			<div class="h-full flex-1 bg-[#FBBC05]"></div>
			<div class="h-full flex-1 bg-[#34A853]"></div>
		</div>

		<div class="p-8">
			<div class="flex flex-col items-center mb-6">
				<div
					class="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/30 mb-3 shadow-sm"
				>
					<ShieldCheck class="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
				</div>

				<h2 class="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">
					GDGC Recruitment Portal
				</h2>

				<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
					Secure Unified Candidate Authentication
				</p>
			</div>

			{#if error}
				<div
					id="auth-error-msg"
					in:fly={{ y: -8, duration: 180 }}
					class="mb-5 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-start space-x-2.5"
				>
					<AlertCircle class="h-4 w-4 shrink-0 mt-0.5" />
					<span>{error}</span>
				</div>
			{/if}

			{#if successMessage}
				<div
					id="auth-success-msg"
					in:fly={{ y: -8, duration: 180 }}
					class="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg flex items-start space-x-2.5"
				>
					<CheckCircle2 class="h-4 w-4 shrink-0 mt-0.5" />
					<span>{successMessage}</span>
				</div>
			{/if}

			{#if view === 'login'}
				<form
					id="login-form"
					in:fly={{ x: -10, duration: 180 }}
					onsubmit={handleLogin}
					class="space-y-4"
				>
					<div>
						<label
							for="login-email-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
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
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>
					</div>

					<div>
						<div class="flex justify-between items-center mb-1.5">
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
								class="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>

							<button
								id="login-toggle-pass-visibility"
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
								aria-label="Toggle password visibility"
							>
								{#if showPassword}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</button>
						</div>
					</div>

					<div class="flex items-center justify-between py-1">
						<label class="flex items-center space-x-2.5 cursor-pointer">
							<input
								id="login-remember-me-checkbox"
								type="checkbox"
								bind:checked={rememberMe}
								class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800"
							/>

							<span class="text-xs text-slate-500 dark:text-slate-400 font-medium select-none">
								Remember my device (7 days)
							</span>
						</label>
					</div>

					<button
						id="login-submit-btn"
						type="submit"
						disabled={isLoading}
						class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-1 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
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
							<span class="bg-white dark:bg-slate-900 px-3 font-bold text-slate-400 select-none">
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
							class="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
						>
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								width="24"
								height="24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<g transform="matrix(1, 0, 0, 1, 0, 0)">
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
								</g>
							</svg>

							<span>Google</span>
						</button>

						<button
							id="github-login-btn"
							type="button"
							disabled={isLoading}
							onclick={() => handleOAuthLogin('github')}
							class="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
						>
							<svg
								class="h-3.5 w-3.5 fill-current text-slate-900 dark:text-white"
								viewBox="0 0 24 24"
								width="24"
								height="24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M12,2A10,10,0,0,0,8.84,21.5c.5.08.66-.23.66-.5V19.31c-2.77.6-3.36-1.34-3.36-1.34A2.65,2.65,0,0,0,5,16.5c-.91-.62.07-.61.07-.61a2.1,2.1,0,0,1,1.53,1,2.13,2.13,0,0,0,2.91.83,2.16,2.16,0,0,1,.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92a3.88,3.88,0,0,1,1-2.69,3.61,3.61,0,0,1,.1-2.65s.84-.27,2.75,1a9.5,9.5,0,0,1,5,0c1.91-1.29,2.75-1,2.75-1a3.61,3.61,0,0,1,.1,2.65,3.88,3.88,0,0,1,1,2.69c0,3.82-2.34,4.66-4.57,4.91a2.39,2.39,0,0,1,.68,1.85V21c0,.27.16.59.67.5A10,10,0,0,0,12,2Z"
								/>
							</svg>

							<span>GitHub</span>
						</button>
					</div>

					<div class="pt-4 text-center border-t border-slate-100 dark:border-slate-800/80">
						<span class="text-xs text-slate-500 dark:text-slate-400">
							Don't have an account yet?
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
			{/if}

			{#if view === 'signup'}
				<form
					id="signup-form"
					in:fly={{ x: -10, duration: 180 }}
					onsubmit={handleRegister}
					class="space-y-4"
				>
					<div>
						<label
							for="signup-name-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
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
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>
					</div>

					<div>
						<label
							for="signup-email-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
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
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>
					</div>

					<div>
						<label
							for="signup-password-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
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
								oninput={handlePasswordChange}
								placeholder="••••••••"
								class="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>

							<button
								id="signup-toggle-pass-visibility"
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
								aria-label="Toggle password visibility"
							>
								{#if showPassword}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</button>
						</div>

						{#if password.length > 0}
							<div
								id="password-strength-container"
								class="mt-2.5 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800/60"
							>
								<div class="flex justify-between items-center text-[11px] mb-1">
									<span class="font-semibold text-slate-500 dark:text-slate-400">
										Password Strength:
									</span>
									<span class="font-bold text-slate-700 dark:text-slate-200">
										{passwordStrength.label}
									</span>
								</div>

								<div
									class="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
								>
									<div
										id="password-strength-bar"
										class={`h-full ${passwordStrength.color} transition-all duration-300`}
										style={`width: ${passwordStrength.score}%`}
									></div>
								</div>

								<div class="grid grid-cols-2 gap-y-1.5 gap-x-3 mt-2 text-[10px]">
									<div class="flex items-center space-x-1.5">
										{#if passwordStrength.hasMinLength}
											<CheckCircle2 class="h-3 w-3 text-emerald-500" />
										{:else}
											<XCircle class="h-3 w-3 text-slate-300 dark:text-slate-700" />
										{/if}

										<span
											class={passwordStrength.hasMinLength
												? 'text-emerald-600 dark:text-emerald-400 font-medium'
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
												? 'text-emerald-600 dark:text-emerald-400 font-medium'
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
												? 'text-emerald-600 dark:text-emerald-400 font-medium'
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
												? 'text-emerald-600 dark:text-emerald-400 font-medium'
												: 'text-slate-400'}
										>
											Number & Special
										</span>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<div>
						<label
							for="signup-confirm-password-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
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
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>

						{#if password && confirmPassword && password !== confirmPassword}
							<p id="password-mismatch-warning" class="text-[10px] text-red-500 mt-1 font-semibold">
								Passwords do not match.
							</p>
						{/if}
					</div>

					<button
						id="signup-submit-btn"
						type="submit"
						disabled={isLoading}
						class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-1 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer mt-2"
					>
						{#if isLoading}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{:else}
							<span>Create Account</span>
							<ArrowRight class="h-4 w-4" />
						{/if}
					</button>

					<div class="pt-4 text-center border-t border-slate-100 dark:border-slate-800/80">
						<span class="text-xs text-slate-500 dark:text-slate-400"> Already registered? </span>

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
			{/if}

			{#if view === 'verify'}
				<form
					id="verify-form"
					in:fly={{ x: -10, duration: 180 }}
					onsubmit={handleVerifyOTP}
					class="space-y-4"
				>
					{#if smtpConfigured}
						<div
							class="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-lg text-xs flex items-start space-x-2 leading-relaxed"
						>
							<ShieldCheck
								class="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
							/>
							<span>
								A secure 6-digit email verification OTP has been dispatched
								<strong>directly to your actual mailbox</strong> via SMTP. Please check your inbox and
								spam folder.
							</span>
						</div>
					{:else}
						<div
							class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg text-xs flex flex-col gap-1 leading-relaxed"
						>
							<div class="flex items-start space-x-2">
								<AlertCircle
									class="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
								/>
								<span class="font-semibold text-amber-900 dark:text-amber-300">
									SMTP Settings Not Active
								</span>
							</div>

							<span class="text-[11px] text-slate-600 dark:text-slate-400">
								Your real SMTP credentials are not configured in your AI Studio secrets panel yet.
							</span>

							<div
								class="text-[10px] bg-slate-900/10 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded p-1.5 font-mono text-slate-500 mt-1"
							>
								Check your server console terminal for the generated 6-digit OTP code to continue!
							</div>
						</div>
					{/if}

					<div>
						<label
							for="verify-email-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							Verification Email
						</label>

						<div class="relative">
							<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<Mail class="h-4 w-4" />
							</span>

							<input
								id="verify-email-input"
								type="email"
								required
								bind:value={email}
								placeholder="you@gdgc.edu"
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>
					</div>

					<div>
						<label
							for="verify-otp-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							6-Digit One-Time Password (OTP)
						</label>

						<input
							id="verify-otp-input"
							type="text"
							required
							maxlength="6"
							value={otpCode}
							oninput={(event) => (otpCode = getInputValue(event).replace(/\D/g, ''))}
							placeholder="123456"
							class="w-full py-2.5 text-center text-lg tracking-[8px] font-bold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
						/>
					</div>

					<div class="flex items-center justify-between text-xs pt-1">
						<span class="text-slate-500 dark:text-slate-400">Didn't receive the OTP?</span>

						<button
							id="verify-resend-btn"
							type="button"
							onclick={handleResendOTP}
							disabled={isLoading}
							class="font-bold text-indigo-600 hover:text-indigo-500 hover:underline flex items-center space-x-1"
						>
							<RefreshCw class="h-3 w-3" />
							<span>Resend Code</span>
						</button>
					</div>

					<button
						id="verify-submit-btn"
						type="submit"
						disabled={isLoading}
						class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-1 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer mt-2"
					>
						{#if isLoading}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{:else}
							<span>Verify Email & Activate</span>
						{/if}
					</button>

					<div class="text-center pt-2">
						<button
							id="verify-back-to-login"
							type="button"
							onclick={() => goTo('login')}
							class="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition"
						>
							← Return to Login
						</button>
					</div>
				</form>
			{/if}

			{#if view === 'verify-2fa'}
				<form
					id="verify-2fa-form"
					in:fly={{ x: -10, duration: 180 }}
					onsubmit={handleVerify2FA}
					class="space-y-4"
				>
					{#if smtpConfigured}
						<div
							class="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-lg text-xs flex items-start space-x-2 leading-relaxed animate-pulse"
						>
							<ShieldCheck
								class="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
							/>
							<span>
								Two-Factor Authentication is enabled. A secure 6-digit security code has been
								dispatched
								<strong>directly to your actual mailbox</strong> via SMTP. Please check your spam folder
								if it doesn't appear in a moment.
							</span>
						</div>
					{:else}
						<div
							class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg text-xs flex flex-col gap-1 leading-relaxed"
						>
							<div class="flex items-start space-x-2">
								<AlertCircle
									class="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
								/>
								<span class="font-semibold text-amber-900 dark:text-amber-300">
									SMTP Settings Not Active
								</span>
							</div>

							<span class="text-[11px] text-slate-600 dark:text-slate-400">
								Your real SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured in
								your AI Studio secrets panel yet.
							</span>

							<div
								class="text-[10px] bg-slate-900/10 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded p-1.5 font-mono text-slate-500 mt-1"
							>
								Check your server console terminal for the generated 6-digit OTP code to continue!
							</div>
						</div>
					{/if}

					<div>
						<label
							for="verify-2fa-email"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							Your Account Email
						</label>

						<div class="relative">
							<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<Mail class="h-4 w-4" />
							</span>

							<input
								id="verify-2fa-email"
								type="email"
								disabled
								value={email}
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none cursor-not-allowed"
							/>
						</div>
					</div>

					<div>
						<label
							for="verify-2fa-code"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							6-Digit Secure Verification Code
						</label>

						<div class="relative">
							<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<KeyRound class="h-4 w-4 text-indigo-500" />
							</span>

							<input
								id="verify-2fa-code"
								type="text"
								required
								maxlength="6"
								value={otpCode}
								oninput={(event) => (otpCode = getInputValue(event).replace(/\D/g, ''))}
								placeholder="123456"
								class="w-full pl-9 pr-3 py-2.5 text-center text-lg tracking-[8px] font-bold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
							/>
						</div>
					</div>

					<button
						id="verify-2fa-submit"
						type="submit"
						disabled={isLoading}
						class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-1 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer mt-2"
					>
						{#if isLoading}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{:else}
							<span>Confirm & Complete Secure Sign In</span>
						{/if}
					</button>

					<div class="flex items-center justify-between pt-2">
						<button
							id="verify-2fa-back-to-login"
							type="button"
							onclick={() => goTo('login')}
							class="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition"
						>
							← Return to Login
						</button>

						<button
							id="verify-2fa-resend"
							type="button"
							disabled={isLoading}
							onclick={handleResend2FA}
							class="text-xs font-bold text-indigo-600 hover:text-indigo-500 disabled:text-slate-400 transition cursor-pointer"
						>
							Resend Security Code
						</button>
					</div>
				</form>
			{/if}

			{#if view === 'forgot-password'}
				<form
					id="forgot-password-form"
					in:fly={{ x: -10, duration: 180 }}
					onsubmit={handleForgotPassword}
					class="space-y-4"
				>
					<div class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-center mb-4">
						Enter your registered candidate email. If the account exists, we will issue a secure
						6-digit OTP to reset your credentials.
					</div>

					<div>
						<label
							for="forgot-email-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							Candidate Email Address
						</label>

						<div class="relative">
							<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<Mail class="h-4 w-4" />
							</span>

							<input
								id="forgot-email-input"
								type="email"
								required
								bind:value={email}
								placeholder="you@gdgc.edu"
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>
					</div>

					<button
						id="forgot-submit-btn"
						type="submit"
						disabled={isLoading}
						class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-1 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
					>
						{#if isLoading}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{:else}
							<span>Request Password Reset OTP</span>
						{/if}
					</button>

					<div class="text-center pt-2">
						<button
							id="forgot-back-to-login"
							type="button"
							onclick={() => goTo('login')}
							class="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition"
						>
							← Return to Sign In
						</button>
					</div>
				</form>
			{/if}

			{#if view === 'reset-password'}
				<form
					id="reset-password-form"
					in:fly={{ x: -10, duration: 180 }}
					onsubmit={handleResetPasswordSubmit}
					class="space-y-4"
				>
					{#if smtpConfigured}
						<div
							class="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-lg text-xs flex items-start space-x-2 leading-relaxed"
						>
							<ShieldCheck
								class="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
							/>
							<span>
								A secure 6-digit password reset OTP has been dispatched
								<strong>directly to your actual mailbox</strong> via SMTP. Please check your inbox and
								spam folder.
							</span>
						</div>
					{:else}
						<div
							class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg text-xs flex flex-col gap-1 leading-relaxed"
						>
							<div class="flex items-start space-x-2">
								<AlertCircle
									class="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
								/>
								<span class="font-semibold text-amber-900 dark:text-amber-300">
									SMTP Settings Not Active
								</span>
							</div>

							<span class="text-[11px] text-slate-600 dark:text-slate-400">
								Your real SMTP credentials are not configured in your AI Studio secrets panel yet.
							</span>

							<div
								class="text-[10px] bg-slate-900/10 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded p-1.5 font-mono text-slate-500 mt-1"
							>
								Check your server console terminal for the generated 6-digit OTP code to continue!
							</div>
						</div>
					{/if}

					<div>
						<label
							for="reset-email-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							Candidate Email Address
						</label>

						<div class="relative">
							<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<Mail class="h-4 w-4" />
							</span>

							<input
								id="reset-email-input"
								type="email"
								required
								bind:value={email}
								placeholder="you@gdgc.edu"
								class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>
						</div>
					</div>

					<div>
						<label
							for="reset-code-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							6-Digit Password Reset Code
						</label>

						<input
							id="reset-code-input"
							type="text"
							required
							maxlength="6"
							value={resetCode}
							oninput={(event) => (resetCode = getInputValue(event).replace(/\D/g, ''))}
							placeholder="123456"
							class="w-full py-2 text-center text-lg tracking-[6px] font-bold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
						/>
					</div>

					<div>
						<label
							for="reset-new-password-input"
							class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
						>
							New Secure Password
						</label>

						<div class="relative">
							<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
								<Lock class="h-4 w-4" />
							</span>

							<input
								id="reset-new-password-input"
								type={showPassword ? 'text' : 'password'}
								required
								value={newPassword}
								oninput={handleNewPasswordChange}
								placeholder="••••••••"
								class="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
							/>

							<button
								id="reset-toggle-pass-visibility"
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
								aria-label="Toggle password visibility"
							>
								{#if showPassword}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</button>
						</div>

						{#if newPassword.length > 0}
							<div
								id="reset-password-strength-container"
								class="mt-2.5 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800/60"
							>
								<div class="flex justify-between items-center text-[11px] mb-1">
									<span class="font-semibold text-slate-500 dark:text-slate-400">
										Password Strength:
									</span>

									<span class="font-bold text-slate-700 dark:text-slate-200">
										{passwordStrength.label}
									</span>
								</div>

								<div
									class="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
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
						class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-1 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer mt-2"
					>
						{#if isLoading}
							<RefreshCw class="h-4 w-4 animate-spin" />
						{:else}
							<span>Update Credentials</span>
						{/if}
					</button>

					<div class="text-center pt-2">
						<button
							id="reset-back-to-login"
							type="button"
							onclick={() => goTo('login')}
							class="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition"
						>
							← Return to Login
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>

	<div
		id="auth-demo-helper"
		class="mt-6 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-100 dark:border-slate-800 rounded-xl"
	>
		<h4
			class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider"
		>
			💡 Tester Demo Credentials
		</h4>

		<div class="grid grid-cols-2 gap-3 text-[11px]">
			<div
				class="bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800"
			>
				<span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">
					Admin Account
				</span>
				<span class="font-mono text-slate-600 dark:text-slate-300 block"> admin@gdgc.edu </span>
				<span class="font-mono text-slate-500 dark:text-slate-400"> AdminPass123! </span>
			</div>

			<div
				class="bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800"
			>
				<span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">
					Regular Account
				</span>
				<span class="font-mono text-slate-600 dark:text-slate-300 block"> user@gdgc.edu </span>
				<span class="font-mono text-slate-500 dark:text-slate-400"> UserPass123! </span>
			</div>
		</div>
	</div>
</div>
