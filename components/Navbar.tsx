'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Compass,
  Plus,
  FileText,
  Trophy,
  Shield,
  User,
  LogOut,
  Sliders,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslation();

  const isOfficer = session?.user?.role === 'officer';
  const isAdmin = session?.user?.role === 'admin';

  return (
    <>
      {/* Desktop Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Brand Logo & Bengaluru Pilot Plate */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signboard-blue rounded-control p-1"
              >
                {/* Physical Street Mile-Marker Badge */}
                <div className="flex items-center justify-center w-8 h-8 rounded-plate bg-asphalt text-marking-yellow font-heading font-black text-sm tracking-tight border border-asphalt">
                  JG
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading font-bold text-base text-asphalt leading-none">
                      Jaago
                    </span>
                    <span className="px-1.5 py-0.5 rounded-plate bg-kerb text-asphalt-muted font-heading font-medium text-[11px] border border-border">
                      Bengaluru
                    </span>
                  </div>
                  <p className="text-[11px] text-asphalt-muted font-sans leading-none mt-0.5">
                    Civic redressal &amp; accountability
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/explore"
                className={`min-h-[40px] px-3 py-2 rounded-control font-heading text-xs font-semibold transition-colors ${
                  pathname === '/explore' || pathname === '/'
                    ? 'bg-kerb text-asphalt border border-border'
                    : 'text-asphalt-muted hover:text-asphalt hover:bg-kerb/60'
                }`}
              >
                {t.explore}
              </Link>

              <Link
                href="/leaderboard"
                className={`min-h-[40px] px-3 py-2 rounded-control font-heading text-xs font-semibold transition-colors ${
                  pathname === '/leaderboard'
                    ? 'bg-kerb text-asphalt border border-border'
                    : 'text-asphalt-muted hover:text-asphalt hover:bg-kerb/60'
                }`}
              >
                {t.leaderboard}
              </Link>

              {session?.user && (
                <Link
                  href="/my-complaints"
                  className={`min-h-[40px] px-3 py-2 rounded-control font-heading text-xs font-semibold transition-colors ${
                    pathname === '/my-complaints'
                      ? 'bg-kerb text-asphalt border border-border'
                      : 'text-asphalt-muted hover:text-asphalt hover:bg-kerb/60'
                  }`}
                >
                  {t.myComplaints}
                </Link>
              )}

              {(isOfficer || isAdmin) && (
                <Link
                  href="/officer/dashboard"
                  className={`min-h-[40px] px-3 py-2 rounded-control font-heading text-xs font-semibold transition-colors ${
                    pathname === '/officer/dashboard'
                      ? 'bg-kerb text-asphalt border border-border'
                      : 'text-asphalt-muted hover:text-asphalt hover:bg-kerb/60'
                  }`}
                >
                  {t.officer}
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`min-h-[40px] px-3 py-2 rounded-control font-heading text-xs font-semibold transition-colors ${
                    pathname === '/admin'
                      ? 'bg-kerb text-asphalt border border-border'
                      : 'text-asphalt-muted hover:text-asphalt hover:bg-kerb/60'
                  }`}
                >
                  {t.admin}
                </Link>
              )}
            </nav>

            {/* Desktop Actions: Report, Language, User Profile */}
            <div className="hidden md:flex items-center gap-2.5">
              <LanguageSwitch />

              <Link
                href="/report"
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-control bg-marking-yellow hover:bg-marking-hover active:bg-marking-hover text-asphalt font-heading font-semibold text-xs border border-[#D9A304] transition-colors"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{t.reportProblem}</span>
              </Link>

              {session?.user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-border">
                  <div className="text-right">
                    <p className="text-xs font-heading font-bold text-asphalt truncate max-w-[120px]">
                      {session.user.name || session.user.email}
                    </p>
                    <p className="text-[10px] text-asphalt-muted capitalize">
                      {session.user.role}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    title={t.signOut}
                    className="p-2 rounded-control text-asphalt-muted hover:text-alert-red hover:bg-kerb transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="min-h-[40px] px-3 py-2 rounded-control border border-border text-xs font-heading font-semibold text-asphalt hover:bg-kerb transition-colors"
                >
                  {t.signIn}
                </Link>
              )}
            </div>

            {/* Mobile Top Header: Brand + Language + User Session */}
            <div className="flex md:hidden items-center gap-2">
              <LanguageSwitch />
              {session?.user ? (
                <div className="flex items-center gap-1.5 pl-1 border-l border-border">
                  <span
                    className={`px-2 py-0.5 rounded-plate text-[10px] font-heading font-bold uppercase tracking-wider ${
                      isAdmin
                        ? 'bg-asphalt text-marking-yellow'
                        : isOfficer
                        ? 'bg-signboard-blue text-white'
                        : 'bg-kerb text-asphalt border border-border'
                    }`}
                  >
                    {session.user.role}
                  </span>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    title={t.signOut}
                    className="p-1.5 rounded-control text-asphalt-muted hover:text-alert-red hover:bg-kerb transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-2.5 py-1 text-xs font-heading font-semibold text-asphalt border border-border rounded-control"
                >
                  {t.signIn}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Quality Floor Standard) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border px-2 py-1 safe-area-pb"
      >
        <div className="flex items-center justify-around h-14 max-w-md mx-auto relative">
          {/* Tab 1: Explore */}
          <Link
            href="/explore"
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-control text-[11px] font-heading font-semibold transition-colors ${
              pathname === '/explore'
                ? 'text-asphalt font-bold'
                : 'text-asphalt-muted'
            }`}
          >
            <Compass className={`w-5 h-5 ${pathname === '/explore' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            <span className="mt-0.5">{t.explore}</span>
          </Link>

          {/* Tab 2: Floating Primary Report Button */}
          <Link
            href="/report"
            aria-label={t.reportProblem}
            className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-marking-yellow hover:bg-marking-hover text-asphalt border-2 border-asphalt shadow-float transition-transform active:scale-95"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </Link>

          {/* Tab 3: Role-Specific Action (Officer Queue / Admin Control / My Complaints) */}
          {isOfficer ? (
            <Link
              href="/officer/dashboard"
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-control text-[11px] font-heading font-semibold transition-colors ${
                pathname === '/officer/dashboard'
                  ? 'text-signboard-blue font-bold'
                  : 'text-asphalt-muted'
              }`}
            >
              <Sliders className={`w-5 h-5 ${pathname === '/officer/dashboard' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="mt-0.5">{t.officer}</span>
            </Link>
          ) : isAdmin ? (
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-control text-[11px] font-heading font-semibold transition-colors ${
                pathname === '/admin'
                  ? 'text-asphalt font-bold'
                  : 'text-asphalt-muted'
              }`}
            >
              <Shield className={`w-5 h-5 ${pathname === '/admin' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="mt-0.5">{t.admin}</span>
            </Link>
          ) : (
            <Link
              href={session?.user ? '/my-complaints' : '/login'}
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-control text-[11px] font-heading font-semibold transition-colors ${
                pathname === '/my-complaints'
                  ? 'text-asphalt font-bold'
                  : 'text-asphalt-muted'
              }`}
            >
              <FileText className={`w-5 h-5 ${pathname === '/my-complaints' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="mt-0.5">{t.myComplaints}</span>
            </Link>
          )}

          {/* Tab 4: Leaderboard */}
          <Link
            href="/leaderboard"
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-control text-[11px] font-heading font-semibold transition-colors ${
              pathname === '/leaderboard'
                ? 'text-asphalt font-bold'
                : 'text-asphalt-muted'
            }`}
          >
            <Trophy className={`w-5 h-5 ${pathname === '/leaderboard' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            <span className="mt-0.5">{t.leaderboard}</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
