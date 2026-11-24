'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  User,
  AlertCircle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  KeyRound,
  Loader2,
  CopyCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getPasswordRuleChecks } from '@/lib/validations';

type AuthMode = 'signin' | 'signup';

interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'officer' | 'citizen';
  badge: string;
  subtitle: string;
  shortCode: string;
}

const INITIAL_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@demo.jaago.app',
    password: 'password123',
    name: 'Civic Commissioner Admin',
    role: 'admin',
    badge: 'Admin',
    subtitle: 'Control Center, Triage & Disputes',
    shortCode: 'ADM',
  },
  {
    email: 'officer.bellandur@demo.jaago.app',
    password: 'password123',
    name: 'Ramesh Gowda',
    role: 'officer',
    badge: 'Officer',
    subtitle: 'Bellandur (W-150) • BBMP-Roads',
    shortCode: 'AEE',
  },
  {
    email: 'officer.hsr@demo.jaago.app',
    password: 'password123',
    name: 'Sunita Rao',
    role: 'officer',
    badge: 'Officer',
    subtitle: 'HSR Layout (W-174) • BBMP-SWM',
    shortCode: 'HI',
  },
  {
    email: 'citizen.rahul@demo.jaago.app',
    password: 'password123',
    name: 'Rahul Sharma',
    role: 'citizen',
    badge: 'Citizen',
    subtitle: 'Resident • Bellandur (W-150)',
    shortCode: 'CIT',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const isDemoAuth =
    process.env.DEMO_AUTH === 'true' || process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';

  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [activeQuickEmail, setActiveQuickEmail] = useState<string | null>(null);
  const [filledEmail, setFilledEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>(INITIAL_DEMO_ACCOUNTS);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'signup') {
        setMode('signup');
      }
    }
  }, []);

  useEffect(() => {
    if (!isDemoAuth) return;
    let active = true;
    fetch('/api/auth/demo-accounts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.accounts) && data.accounts.length > 0) {
          setDemoAccounts(data.accounts);
        }
      })
      .catch(() => {
        // Keep built-in INITIAL_DEMO_ACCOUNTS fallback
      });
    return () => {
      active = false;
    };
  }, [isDemoAuth]);

  const passwordChecks = useMemo(() => getPasswordRuleChecks(password), [password]);
  const hasSpaces = /\s/.test(password);
  const metCount = passwordChecks.filter((c) => c.met).length;
  const allPasswordRulesMet = metCount === passwordChecks.length && !hasSpaces;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const strengthLabel = useMemo(() => {
    if (!password) return '';
    if (hasSpaces) return 'Spaces not allowed';
    if (metCount <= 2) return 'Weak';
    if (metCount === 3) return 'Fair';
    if (metCount === 4) return 'Good';
    return 'Strong';
  }, [password, metCount, hasSpaces]);

  const navigateAfterAuth = async () => {
    const session = await getSession();
    const role = session?.user?.role;

    let safeCallback: string | null = null;
    if (typeof window !== 'undefined') {
      const raw = new URLSearchParams(window.location.search).get('callbackUrl');
      if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
        safeCallback = raw;
      }
    }

    if (role === 'officer') {
      const allowed =
        safeCallback && !safeCallback.startsWith('/admin') ? safeCallback : '/officer/dashboard';
      router.push(allowed);
    } else if (role === 'admin') {
      router.push(safeCallback || '/admin');
    } else {
      const allowed =
        safeCallback &&
        !safeCallback.startsWith('/admin') &&
        !safeCallback.startsWith('/officer')
          ? safeCallback
          : '/my-complaints';
      router.push(allowed);
    }
    router.refresh();
  };

  const handleModeSwitch = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
    setFilledEmail(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email: trimmedEmail,
        password,
        mode: 'signin',
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        await navigateAfterAuth();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!allPasswordRulesMet) {
      setError('Please satisfy all password requirements before creating your account.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    try {
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      });

      const regData = await regRes.json().catch(() => ({}));
      if (!regRes.ok) {
        setError(regData.message || regData.error || 'Could not create account.');
        return;
      }

      setNotice('Account created successfully. Signing you in...');

      const loginRes = await signIn('credentials', {
        email: trimmedEmail,
        password,
        mode: 'signin',
        redirect: false,
      });

      if (loginRes?.error) {
        setNotice('');
        setError(`Account created, please sign in: ${loginRes.error}`);
        setMode('signin');
        setConfirmPassword('');
      } else {
        await navigateAfterAuth();
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSignIn = async (account: DemoAccount) => {
    setLoading(true);
    setActiveQuickEmail(account.email);
    setError('');
    setNotice('');
    try {
      const res = await signIn('credentials', {
        email: account.email,
        password: account.password,
        mode: 'signin',
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        await navigateAfterAuth();
      }
    } catch (err: any) {
      setError(err.message || 'Quick sign-in failed.');
    } finally {
      setLoading(false);
      setActiveQuickEmail(null);
    }
  };

  const handleFillCredentials = (account: DemoAccount) => {
    setMode('signin');
    setError('');
    setNotice(`Filled credentials for ${account.name}. Click Sign In to continue.`);
    setEmail(account.email);
    setPassword(account.password);
    setConfirmPassword('');
    setFilledEmail(account.email);
  };

  const adminAccounts = demoAccounts.filter((a) => a.role === 'admin');
  const officerAccounts = demoAccounts.filter((a) => a.role === 'officer');
  const citizenAccounts = demoAccounts.filter((a) => a.role === 'citizen');

  const renderAccountCard = (account: DemoAccount) => {
    const isThisLoading = loading && activeQuickEmail === account.email;
    const isFilled = filledEmail === account.email;

    const badgeClasses =
      account.role === 'admin'
        ? 'bg-asphalt text-marking-yellow border border-asphalt'
        : account.role === 'officer'
        ? 'bg-signboard-blue/10 text-signboard-blue border border-signboard-blue/30'
        : 'bg-white text-asphalt border border-border';

    const iconBoxClasses =
      account.role === 'admin'
        ? 'bg-asphalt text-marking-yellow'
        : account.role === 'officer'
        ? 'bg-signboard-blue text-white'
        : 'bg-asphalt text-white';

    return (
      <div
        key={account.email}
        className={`p-3 rounded-control border transition-colors ${
          isFilled
            ? 'bg-signboard-light/60 border-signboard-blue/50'
            : 'bg-kerb/70 border-border hover:bg-kerb'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-plate flex items-center justify-center font-heading font-bold text-[11px] shrink-0 ${iconBoxClasses}`}
            >
              {account.role === 'admin' ? (
                <Shield className="w-4 h-4" />
              ) : account.role === 'citizen' ? (
                <User className="w-4 h-4" />
              ) : (
                account.shortCode
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-heading font-bold text-asphalt truncate">{account.name}</p>
              <p className="text-[11px] font-sans text-asphalt-muted truncate">{account.subtitle}</p>
            </div>
          </div>

          <span
            className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded-plate shrink-0 ${badgeClasses}`}
          >
            {account.badge}
          </span>
        </div>

        <div className="mt-2.5 pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-mono text-asphalt-muted truncate">
            <span className="text-asphalt font-medium">{account.email}</span>
            <span className="mx-1.5 text-border">|</span>
            <span>{account.password}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleFillCredentials(account)}
              className="px-2 py-1 rounded-plate border border-border bg-white hover:bg-border-subtle text-[11px] font-heading font-semibold text-asphalt transition-colors disabled:opacity-50 flex items-center gap-1"
              title="Populate email and password in form"
            >
              {isFilled && <CopyCheck className="w-3 h-3 text-signboard-blue" />}
              <span>Fill</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSignIn(account)}
              className="px-2.5 py-1 rounded-plate bg-asphalt hover:bg-asphalt/90 text-marking-yellow text-[11px] font-heading font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isThisLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <span>Enter</span>
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-kerb px-4 py-8 sm:py-12 pb-24 md:pb-12 flex items-center justify-center">
      <div
        className={`w-full ${
          isDemoAuth
            ? 'max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
            : 'max-w-md'
        }`}
      >
        {/* Main Authentication Card */}
        <div
          className={`${
            isDemoAuth ? 'lg:col-span-7' : ''
          } bg-white p-6 sm:p-8 rounded-control border border-border shadow-sheet space-y-6`}
        >
          {/* Portal Brand Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-control bg-marking-yellow border-2 border-asphalt text-asphalt font-heading font-black text-lg shadow-sm shrink-0">
                JG
              </div>
              <div>
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-signboard-blue block">
                  Greater Bengaluru Redressal Portal
                </span>
                <h1 className="text-xl sm:text-2xl font-heading font-black text-asphalt tracking-tight leading-tight">
                  {mode === 'signin' ? 'Sign In to Jaago' : 'Create Citizen Account'}
                </h1>
              </div>
            </div>
            <p className="text-xs font-sans text-asphalt-muted leading-relaxed">
              {mode === 'signin'
                ? 'Access citizen complaint tracking, ward field engineering queues, or municipal control center.'
                : 'Register with a verified email and strong password to report civic issues and track repairs.'}
            </p>
          </div>

          {/* Auth Mode Switcher */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 p-1 bg-kerb rounded-control border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => handleModeSwitch('signin')}
              className={`py-2 text-xs font-heading font-bold rounded-[6px] transition-all ${
                mode === 'signin'
                  ? 'bg-white text-asphalt shadow-sm border border-border'
                  : 'text-asphalt-muted hover:text-asphalt'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => handleModeSwitch('signup')}
              className={`py-2 text-xs font-heading font-bold rounded-[6px] transition-all ${
                mode === 'signup'
                  ? 'bg-white text-asphalt shadow-sm border border-border'
                  : 'text-asphalt-muted hover:text-asphalt'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error / Success Alerts */}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-plate bg-alert-light border border-alert-red/30 text-alert-red text-xs font-sans flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && !error && (
            <div className="p-3 rounded-plate bg-fixed-light border border-fixed-green/30 text-fixed-green text-xs font-sans flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* Sign In / Sign Up Form */}
          <form
            onSubmit={mode === 'signin' ? handleSignInSubmit : handleSignUpSubmit}
            className="space-y-4"
            noValidate
          >
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-heading font-bold text-asphalt mb-1.5"
                >
                  Full Name <span className="text-alert-red">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-asphalt-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Deshmukh"
                    minLength={2}
                    maxLength={100}
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-control text-xs font-sans text-asphalt bg-white focus:outline-none focus:ring-1 focus:ring-signboard-blue"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-heading font-bold text-asphalt mb-1.5"
              >
                Email Address <span className="text-alert-red">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-asphalt-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (filledEmail) setFilledEmail(null);
                  }}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-control text-xs font-sans text-asphalt bg-white focus:outline-none focus:ring-1 focus:ring-signboard-blue"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-heading font-bold text-asphalt mb-1.5"
              >
                Password <span className="text-alert-red">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-asphalt-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a strong password'}
                  required
                  className="w-full pl-9 pr-10 py-2.5 border border-border rounded-control text-xs font-sans text-asphalt bg-white focus:outline-none focus:ring-1 focus:ring-signboard-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-asphalt-subtle hover:text-asphalt transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Rules & Strength Meter for New Account Registration */}
            {mode === 'signup' && (
              <>
                <div className="p-3 rounded-control bg-kerb/80 border border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-heading font-bold text-asphalt">
                      Password Requirements
                    </span>
                    {strengthLabel && (
                      <span
                        className={`text-[11px] font-heading font-bold ${
                          hasSpaces || metCount <= 2
                            ? 'text-alert-red'
                            : metCount === 3
                            ? 'text-attention-amber'
                            : metCount === 4
                            ? 'text-signboard-blue'
                            : 'text-fixed-green'
                        }`}
                      >
                        {strengthLabel}
                      </span>
                    )}
                  </div>

                  {/* 4-step strength bar */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((step) => {
                      const active = !hasSpaces && metCount >= step + 1;
                      const barColor =
                        metCount <= 2
                          ? 'bg-alert-red'
                          : metCount === 3
                          ? 'bg-attention-amber'
                          : metCount === 4
                          ? 'bg-signboard-blue'
                          : 'bg-fixed-green';
                      return (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-colors ${
                            password.length > 0 && active ? barColor : 'bg-border'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                    {passwordChecks.map((rule) => (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-1.5 text-[11px] font-sans ${
                          rule.met ? 'text-fixed-green font-medium' : 'text-asphalt-muted'
                        }`}
                      >
                        {rule.met ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-fixed-green" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 shrink-0 text-asphalt-subtle" />
                        )}
                        <span>{rule.label}</span>
                      </li>
                    ))}
                  </ul>

                  {hasSpaces && (
                    <p className="text-[11px] font-sans text-alert-red">
                      Spaces are not permitted in passwords.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-heading font-bold text-asphalt mb-1.5"
                  >
                    Confirm Password <span className="text-alert-red">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-asphalt-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                      className="w-full pl-9 pr-10 py-2.5 border border-border rounded-control text-xs font-sans text-asphalt bg-white focus:outline-none focus:ring-1 focus:ring-signboard-blue"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-asphalt-subtle hover:text-asphalt transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p
                      className={`mt-1 text-[11px] font-sans ${
                        passwordsMatch ? 'text-fixed-green' : 'text-alert-red'
                      }`}
                    >
                      {passwordsMatch ? 'Passwords match.' : 'Passwords do not match yet.'}
                    </p>
                  )}
                </div>
              </>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={
                loading ||
                (mode === 'signup' && (!allPasswordRulesMet || !passwordsMatch || name.trim().length < 2))
              }
            >
              {loading && !activeQuickEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              )}
            </Button>
          </form>

          {/* Bottom Mode Switch Helper */}
          <div className="pt-3 border-t border-border text-center space-y-1.5">
            <p className="text-xs font-sans text-asphalt-muted">
              {mode === 'signin' ? "Don't have an account yet?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch(mode === 'signin' ? 'signup' : 'signin')}
                className="font-heading font-bold text-signboard-blue hover:underline"
              >
                {mode === 'signin' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
            <p className="text-[11px] font-sans text-asphalt-subtle">
              Ward officers &amp; administrators are authorized via municipal allow-list.
            </p>
          </div>
        </div>

        {/* Pre-Saved Admin & Ward Officer Credentials Panel */}
        {isDemoAuth && (
          <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-control border border-border shadow-sheet space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-plate bg-kerb border border-border flex items-center justify-center text-signboard-blue shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-heading font-bold text-asphalt">
                    Pre-Saved Official Accounts
                  </h2>
                  <p className="text-[11px] font-sans text-asphalt-muted">
                    Fill the form or sign in directly
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-plate bg-marking-yellow/20 border border-marking-yellow text-[10px] font-heading font-bold text-asphalt">
                Pilot Access
              </span>
            </div>

            <div className="space-y-3.5">
              {adminAccounts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-asphalt-muted block">
                    Administration
                  </span>
                  <div className="space-y-2">{adminAccounts.map(renderAccountCard)}</div>
                </div>
              )}

              {officerAccounts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-asphalt-muted block">
                    Ward Field Officers ({officerAccounts.length})
                  </span>
                  <div className="space-y-2">{officerAccounts.map(renderAccountCard)}</div>
                </div>
              )}

              {citizenAccounts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-asphalt-muted block">
                    Citizen Resident
                  </span>
                  <div className="space-y-2">{citizenAccounts.map(renderAccountCard)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
