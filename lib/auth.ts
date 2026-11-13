import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { User } from '../models/User';
import { OfficerAllowList } from '../models/OfficerAllowList';
import { Ward } from '../models/Ward';
import { Agency } from '../models/Agency';

export function getAuthProviders() {
  const isDemoAuthEnabled = process.env.DEMO_AUTH === 'true';
  const providers: any[] = [];

  if (isDemoAuthEnabled) {
    providers.push(
      CredentialsProvider({
        id: 'credentials',
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email) {
            throw new Error('Email is required');
          }

          if (process.env.DEMO_AUTH !== 'true') {
            throw new Error('Credentials and demo login are disabled in production unless DEMO_AUTH=true');
          }

          await connectToDatabase();
          const email = credentials.email.toLowerCase().trim();

          let user = await User.findOne({ email });

          // Check OfficerAllowList first to ensure role synchronization
          let allowEntry = await OfficerAllowList.findOne({ email, isActive: true });

          // Check if email matches configured ADMIN_EMAIL environment variable or canonical demo admin
          const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
          const isAdminEmail = Boolean(
            (configuredAdminEmail && email === configuredAdminEmail) ||
            email === 'admin@demo.jaago.app'
          );

          // If this is a canonical demo officer but allowlist wasn't populated yet, auto-provision allowlist entry
          if (!allowEntry && (email === 'officer.bellandur@demo.jaago.app' || email === 'officer.hsr@demo.jaago.app')) {
            const isBellandur = email === 'officer.bellandur@demo.jaago.app';
            const wardCode = isBellandur ? 'W-150' : 'W-174';
            const agencyShortName = isBellandur ? 'BBMP-Roads' : 'BBMP-SWM';
            const officerName = isBellandur ? 'Ramesh Gowda (AEE Bellandur)' : 'Sunita Rao (Health Inspector HSR)';

            const ward = await Ward.findOne({ code: wardCode });
            const agency = await Agency.findOne({ shortName: agencyShortName });

            if (ward && agency) {
              allowEntry = await OfficerAllowList.findOneAndUpdate(
                { email },
                {
                  name: officerName,
                  email,
                  agencyId: agency._id,
                  assignedWardId: ward._id,
                  isActive: true,
                },
                { upsert: true, new: true }
              );
            }
          }

          if (!user) {
            // If user doesn't exist yet, auto-provision user account
            // Admin role is strictly restricted to ADMIN_EMAIL or seeded admin; public signups default to citizen
            const initialRole = isAdminEmail ? 'admin' : allowEntry ? 'officer' : 'citizen';
            const hashedPassword = await bcrypt.hash(credentials.password || 'password123', 10);
            user = await User.create({
              name: allowEntry ? allowEntry.name : isAdminEmail ? 'Civic Commissioner Admin' : email.split('@')[0],
              email,
              password: hashedPassword,
              role: initialRole,
              assignedWardId: allowEntry ? allowEntry.assignedWardId : undefined,
              agencyId: allowEntry ? allowEntry.agencyId : undefined,
            });
          } else {
            // If credentials password provided, verify password if user has password set
            if (credentials.password && user.password) {
              const isValid = await bcrypt.compare(credentials.password, user.password);
              if (!isValid) {
                if (credentials.password === 'password123' && process.env.DEMO_AUTH === 'true') {
                  const hashedPassword = await bcrypt.hash('password123', 10);
                  user.password = hashedPassword;
                } else {
                  throw new Error('Invalid password');
                }
              }
            }

            // Ensure and repair roles for existing users
            let updated = false;
            if (isAdminEmail && user.role !== 'admin') {
              user.role = 'admin';
              updated = true;
            } else if (allowEntry) {
              if (user.role !== 'officer' || !user.assignedWardId?.equals(allowEntry.assignedWardId)) {
                user.role = 'officer';
                user.assignedWardId = allowEntry.assignedWardId;
                user.agencyId = allowEntry.agencyId;
                updated = true;
              }
            }
            if (updated) {
              await user.save();
            }
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            assignedWardId: user.assignedWardId ? user.assignedWardId.toString() : undefined,
            agencyId: user.agencyId ? user.agencyId.toString() : undefined,
          };
        },
      })
    );
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  get providers() {
    return getAuthProviders();
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      await connectToDatabase();
      const email = user.email.toLowerCase().trim();
      const allowEntry = await OfficerAllowList.findOne({ email, isActive: true });

      const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      const isAdminEmail = Boolean(
        (configuredAdminEmail && email === configuredAdminEmail) ||
        email === 'admin@demo.jaago.app'
      );

      let dbUser = await User.findOne({ email });
      if (!dbUser) {
        const initialRole = isAdminEmail ? 'admin' : allowEntry ? 'officer' : 'citizen';
        dbUser = await User.create({
          name: user.name || (isAdminEmail ? 'Civic Commissioner Admin' : email.split('@')[0]),
          email,
          image: user.image,
          role: initialRole,
          assignedWardId: allowEntry?.assignedWardId,
          agencyId: allowEntry?.agencyId,
        });
      } else {
        let changed = false;
        if (isAdminEmail && dbUser.role !== 'admin') {
          dbUser.role = 'admin';
          changed = true;
        } else if (allowEntry && (dbUser.role !== 'officer' || !dbUser.assignedWardId?.equals(allowEntry.assignedWardId))) {
          dbUser.role = 'officer';
          dbUser.assignedWardId = allowEntry.assignedWardId;
          dbUser.agencyId = allowEntry.agencyId;
          changed = true;
        }
        if (changed) {
          await dbUser.save();
        }
      }

      user.id = dbUser._id.toString();
      user.role = dbUser.role;
      user.assignedWardId = dbUser.assignedWardId ? dbUser.assignedWardId.toString() : undefined;
      user.agencyId = dbUser.agencyId ? dbUser.agencyId.toString() : undefined;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.assignedWardId = user.assignedWardId;
        token.agencyId = user.agencyId;
      } else if (token.id || token.email) {
        // Synchronize role from DB on session checks so upgraded roles take effect immediately
        try {
          await connectToDatabase();
          const dbUser = token.id
            ? await User.findById(token.id).select('role assignedWardId agencyId')
            : await User.findOne({ email: token.email }).select('role assignedWardId agencyId');
          if (dbUser) {
            token.role = dbUser.role;
            token.assignedWardId = dbUser.assignedWardId ? dbUser.assignedWardId.toString() : undefined;
            token.agencyId = dbUser.agencyId ? dbUser.agencyId.toString() : undefined;
          }
        } catch {
          // Keep existing token values if DB query is temporarily unreachable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'citizen' | 'officer' | 'admin';
        session.user.assignedWardId = token.assignedWardId as string | undefined;
        session.user.agencyId = token.agencyId as string | undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'jaago-secret-super-secure-key-2025-token',
  pages: {
    signIn: '/login',
  },
};
export default authOptions;
