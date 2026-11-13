'use client';

import React, { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, User, Wrench, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isDemoAuth = process.env.DEMO_AUTH === 'true' || process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';

  const handleSignIn = async (userEmail: string, userPass = 'password123') => {
    setLoading(true);
    setError('');
    try {
      const res = await signIn('credentials', {
        email: userEmail,
        password: userPass,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        const session = await getSession();
        if (session?.user?.role === 'officer') {
          router.push('/officer/dashboard');
        } else if (session?.user?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/my-complaints');
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-kerb">
      <div className="max-w-md w-full space-y-6 bg-white p-6 sm:p-8 rounded-control border border-border shadow-sheet">
        {/* Mile-Marker Logo & Heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-control bg-marking-yellow border-2 border-asphalt text-asphalt font-heading font-black text-xl shadow-sm">
            JG
          </div>
          <h1 className="text-2xl font-heading font-black text-asphalt tracking-tight">
            Sign In to Jaago
          </h1>
          <p className="text-xs font-sans text-asphalt-muted">
            Greater Bengaluru Municipal Redressal &amp; Field Portal
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-plate bg-alert-red/10 border border-alert-red/30 text-alert-red text-xs font-sans flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Demo Profiles */}
        {isDemoAuth && (
          <>
            <div className="space-y-2.5">
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-asphalt-muted block">
                1-Click Demo Personas
              </span>

              {/* Officer Persona */}
              <button
                onClick={() => handleSignIn('officer.bellandur@demo.jaago.app')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-control border border-border bg-kerb hover:bg-border-subtle text-left transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-plate bg-asphalt text-marking-yellow flex items-center justify-center font-heading font-bold text-xs">
                    AEE
                  </div>
                  <div>
                    <p className="text-xs font-heading font-bold text-asphalt">Ramesh Gowda</p>
                    <p className="text-[11px] font-sans text-asphalt-muted">
                      Ward Officer • Bellandur (W-150)
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-plate bg-signboard-blue/10 text-signboard-blue border border-signboard-blue/30">
                  Officer
                </span>
              </button>

              {/* Citizen Persona */}
              <button
                onClick={() => handleSignIn('citizen.rahul@demo.jaago.app')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-control border border-border bg-kerb hover:bg-border-subtle text-left transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-plate bg-asphalt text-white flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-heading font-bold text-asphalt">Rahul Sharma</p>
                    <p className="text-[11px] font-sans text-asphalt-muted">Resident • Bellandur</p>
                  </div>
                </div>
                <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-plate bg-kerb text-asphalt border border-border">
                  Citizen
                </span>
              </button>

              {/* Admin Persona */}
              <button
                onClick={() => handleSignIn('admin@demo.jaago.app')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-control border border-border bg-kerb hover:bg-border-subtle text-left transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-plate bg-asphalt text-marking-yellow flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-heading font-bold text-asphalt">Municipal Admin</p>
                    <p className="text-[11px] font-sans text-asphalt-muted">Control Center &amp; Triage</p>
                  </div>
                </div>
                <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-plate bg-asphalt text-marking-yellow">
                  Admin
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-2 font-heading font-semibold text-asphalt-muted">
                  Or sign in with email
                </span>
              </div>
            </div>
          </>
        )}

        {/* Custom Credentials Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSignIn(email, password);
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-heading font-bold text-asphalt mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. resident@example.com"
              className="w-full px-3 py-2 border border-border rounded-plate text-xs font-sans text-asphalt bg-white focus:outline-none focus:ring-1 focus:ring-signboard-blue"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-heading font-bold text-asphalt mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-plate text-xs font-sans text-asphalt bg-white focus:outline-none focus:ring-1 focus:ring-signboard-blue"
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
