import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { User } from '../models/User';
import { OfficerAllowList } from '../models/OfficerAllowList';

const isDemoAuthEnabled = process.env.DEMO_AUTH === 'true';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    ...(isDemoAuthEnabled
      ? [
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
              const allowEntry = await OfficerAllowList.findOne({ email, isActive: true });

              if (!user) {
                // If user doesn't exist yet, auto-provision user account
                const hashedPassword = await bcrypt.hash(credentials.password || 'password123', 10);
                user = await User.create({
                  name: allowEntry ? allowEntry.name : email.split('@')[0],
                  email,
                  password: hashedPassword,
                  role: allowEntry ? 'officer' : 'citizen',
                  assignedWardId: allowEntry ? allowEntry.assignedWardId : undefined,
                  agencyId: allowEntry ? allowEntry.agencyId : undefined,
                });
              } else {
                // If credentials password provided, verify password if user has password set
                if (credentials.password && user.password) {
                  const isValid = await bcrypt.compare(credentials.password, user.password);
                  if (!isValid) {
                    throw new Error('Invalid password');
                  }
                }

                // If in allow list, upgrade or ensure officer status
                if (allowEntry && (user.role !== 'officer' || !user.assignedWardId?.equals(allowEntry.assignedWardId))) {
                  user.role = 'officer';
                  user.assignedWardId = allowEntry.assignedWardId;
                  user.agencyId = allowEntry.agencyId;
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
          }),
        ]
      : []),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      await connectToDatabase();
      const email = user.email.toLowerCase().trim();
      const allowEntry = await OfficerAllowList.findOne({ email, isActive: true });

      let dbUser = await User.findOne({ email });
      if (!dbUser) {
        dbUser = await User.create({
          name: user.name || email.split('@')[0],
          email,
          image: user.image,
          role: allowEntry ? 'officer' : 'citizen',
          assignedWardId: allowEntry?.assignedWardId,
          agencyId: allowEntry?.agencyId,
        });
      } else if (allowEntry && dbUser.role !== 'officer') {
        dbUser.role = 'officer';
        dbUser.assignedWardId = allowEntry.assignedWardId;
        dbUser.agencyId = allowEntry.agencyId;
        await dbUser.save();
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
