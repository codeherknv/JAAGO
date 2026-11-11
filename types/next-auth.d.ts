import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'citizen' | 'officer' | 'admin';
      assignedWardId?: string;
      agencyId?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'citizen' | 'officer' | 'admin';
    assignedWardId?: string;
    agencyId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'citizen' | 'officer' | 'admin';
    assignedWardId?: string;
    agencyId?: string;
  }
}
