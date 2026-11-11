'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  MapPin,
  AlertTriangle,
  Compass,
  Trophy,
  ShieldCheck,
  User,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/explore', label: 'Civic Map', icon: Compass },
    { href: '/report', label: 'Report Issue', icon: AlertTriangle, highlight: true },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    {
      href: '/officer/dashboard',
      label: 'Officer Command',
      icon: ShieldCheck,
      badge: 'Pilot',
    },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <span className="font-extrabold text-lg tracking-wider">जा</span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-emerald-600">
                  Jaago
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  Bengaluru Wards
                </span>
              </div>
              <p className="text-[10px] text-slate-500 -mt-1 font-medium">
                Geo-Intelligent Civic Redressal
              </p>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    item.highlight
                      ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-500/25'
                      : isActive
                      ? 'bg-slate-100 text-slate-900 border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.highlight ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Section & Auth */}
          <div className="hidden md:flex items-center space-x-3">
            {session?.user ? (
              <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 rounded-full pl-3 pr-2 py-1.5">
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                    {session.user.name || session.user.email}
                  </p>
                  <div className="flex items-center space-x-1">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        session.user.role === 'officer'
                          ? 'bg-emerald-500'
                          : session.user.role === 'admin'
                          ? 'bg-purple-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {session.user.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  title="Sign out"
                  className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
              >
                <User className="w-4 h-4 text-slate-500" />
                <span>Sign In / Demo</span>
              </Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-100">
            {session?.user ? (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{session.user.name}</p>
                  <p className="text-xs text-slate-500 capitalize">
                    {session.user.role} &bull; {session.user.email}
                  </p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center block py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm"
              >
                Sign In / Demo Roles
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
