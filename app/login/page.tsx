'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, UserCheck, User, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-orange-500/20">
            जा
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Sign in to Jaago
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Greater Bengaluru Pilot Identity & Access Portal
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Demo Profiles */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            1-Click Demo Test Personas
          </p>

          <button
            onClick={() => handleSignIn('officer.bellandur@bbmp.gov.in')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-left transition"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                AEE
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Ramesh Gowda</p>
                <p className="text-xs text-emerald-700 font-medium">
                  Ward Officer &bull; Bellandur (W-150)
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              Officer
            </span>
          </button>

          <button
            onClick={() => handleSignIn('officer.hsr@bbmp.gov.in')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 text-left transition"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                HI
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Sunita Rao</p>
                <p className="text-xs text-teal-700 font-medium">
                  Health Inspector &bull; HSR Layout (W-174)
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
              Officer
            </span>
          </button>

          <button
            onClick={() => handleSignIn('citizen.rahul@example.com')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-left transition"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Rahul Sharma</p>
                <p className="text-xs text-blue-700 font-medium">Resident &bull; Bellandur</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
              Citizen
            </span>
          </button>

          <button
            onClick={() => handleSignIn('admin@jaago.kar.nic.in')}
            disabled={loading}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-left transition"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Civic Commissioner</p>
                <p className="text-xs text-purple-700 font-medium">Municipal Oversight & Audit</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
              Admin
            </span>
          </button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-medium">
              Or sign in with custom credentials
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSignIn(email, password);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. resident@gmail.com"
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
