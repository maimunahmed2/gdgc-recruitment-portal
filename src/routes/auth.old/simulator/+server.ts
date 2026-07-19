import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GDGC OAuth Sandbox Simulator</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 dark:bg-slate-950 font-sans flex items-center justify-center min-h-screen p-4">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
        <div class="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <svg class="h-5 w-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span class="text-xs font-mono font-bold tracking-wider uppercase text-indigo-100">OAuth Sandbox Simulator</span>
          </div>
          <span class="text-[10px] font-semibold bg-indigo-500 text-white px-2 py-0.5 rounded-full">Dev Mode</span>
        </div>

        <div class="p-6">
          <div class="text-center mb-6">
            <div id="provider-logo" class="h-12 w-12 mx-auto rounded-full flex items-center justify-center shadow-md mb-3"></div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white" id="title-text">Sign in via OAuth</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Select or customize a simulated account to authenticate</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Preset Identities</label>
              <div class="grid grid-cols-1 gap-2">
                <button onclick="selectPreset('alex.oauth@gdgc.edu', 'Alex Candidate')" class="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between group transition-all">
                  <div><p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Alex Candidate (OAuth)</p><p class="text-xs text-slate-500 dark:text-slate-400 font-mono">alex.oauth@gdgc.edu</p></div>
                  <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Select &rarr;</span>
                </button>
                <button onclick="selectPreset('taylor.coder@github.com', 'Taylor GitHub')" class="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between group transition-all">
                  <div><p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Taylor GitHub (OAuth)</p><p class="text-xs text-slate-500 dark:text-slate-400 font-mono">taylor.coder@github.com</p></div>
                  <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Select &rarr;</span>
                </button>
              </div>
            </div>

            <div class="border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Or Custom Simulated Identity</label>
              <div class="space-y-3">
                <input type="text" id="custom-name" placeholder="John Doe" class="w-full p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <input type="email" id="custom-email" placeholder="john.doe@example.com" class="w-full p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
              </div>
            </div>

            <button onclick="submitCustom()" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-md transition-all">Authorize simulated credentials</button>
          </div>
        </div>
      </div>

      <script>
        const urlParams = new URLSearchParams(window.location.search);
        const provider = urlParams.get('provider') || 'google';
        const redirectUri = urlParams.get('redirect_uri');
        const logoEl = document.getElementById('provider-logo');
        const titleEl = document.getElementById('title-text');

        if (provider === 'google') {
          logoEl.className += ' bg-amber-50 dark:bg-amber-950/20';
          logoEl.innerHTML = '<span class="text-xl font-bold text-[#EA4335]">G</span>';
          titleEl.innerText = 'Sign in with Google';
        } else {
          logoEl.className += ' bg-slate-100 dark:bg-slate-800';
          logoEl.innerHTML = '<span class="text-xl font-bold text-slate-950 dark:text-white">G</span>';
          titleEl.innerText = 'Sign in with GitHub';
        }

        function selectPreset(email, name) {
          triggerCallback(email, name);
        }

        function submitCustom() {
          const name = document.getElementById('custom-name').value.trim() || 'Simulated User';
          const email = document.getElementById('custom-email').value.trim() || 'simulated@gdgc.edu';
          if (!email.includes('@')) {
            alert('Please enter a valid email address');
            return;
          }
          triggerCallback(email, name);
        }

        function triggerCallback(email, name) {
          if (!redirectUri) {
            alert('Redirect URI is missing from request');
            return;
          }
          const targetUrl = new URL(redirectUri);
          targetUrl.searchParams.append('mock', 'true');
          targetUrl.searchParams.append('email', email);
          targetUrl.searchParams.append('name', name);
          targetUrl.searchParams.append('provider', provider);
          window.location.href = targetUrl.toString();
        }
      </script>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
};
