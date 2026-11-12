import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { seedPilotDatabase } from './seedPilot';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { encode } from 'next-auth/jwt';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'jaago-secret-super-secure-key-2025-token';

function waitForServer(url: string, timeoutMs: number = 35000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        })
        .on('error', () => {
          retry();
        });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`));
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

class CdpSession {
  private ws: WebSocket;
  private idCounter = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {
        console.error('CDP message parse error', e);
      }
    };
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.idCounter++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function createCdpClient(debuggingPort: number): Promise<{ session: CdpSession; close: () => void }> {
  // Query new target
  const newTargetRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?about:blank`, { method: 'PUT' });
  const targetData: any = await newTargetRes.json();
  const wsUrl = targetData.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
  });

  const session = new CdpSession(ws);
  await session.send('Page.enable');
  await session.send('Network.enable');

  return {
    session,
    close: () => {
      try {
        ws.close();
      } catch {}
    },
  };
}

async function main() {
  console.log('Starting shared MongoMemoryReplSet...');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger', dbName: 'jaago' },
  });
  const mongoUri = replSet.getUri();
  console.log(`MongoMemoryReplSet running at: ${mongoUri}`);

  process.env.MONGODB_URI = mongoUri;
  process.env.NEXTAUTH_SECRET = NEXTAUTH_SECRET;
  process.env.DEMO_AUTH = 'true';

  console.log('Connecting to database and seeding pilot data...');
  await mongoose.connect(mongoUri);
  await seedPilotDatabase();

  const adminUser = await User.findOne({ role: 'admin' });
  const officerUser = await User.findOne({ role: 'officer' });
  const citizenUser = await User.findOne({ role: 'citizen' });

  if (!adminUser || !officerUser || !citizenUser) {
    throw new Error('Required seed users not found');
  }

  // Create JWT session tokens
  const adminToken = await encode({
    token: {
      id: adminUser._id.toString(),
      name: adminUser.name,
      email: adminUser.email,
      role: 'admin',
      sub: adminUser._id.toString(),
    },
    secret: NEXTAUTH_SECRET,
  });

  const officerToken = await encode({
    token: {
      id: officerUser._id.toString(),
      name: officerUser.name,
      email: officerUser.email,
      role: 'officer',
      assignedWardId: officerUser.assignedWardId?.toString(),
      agencyId: officerUser.agencyId?.toString(),
      sub: officerUser._id.toString(),
    },
    secret: NEXTAUTH_SECRET,
  });

  const citizenToken = await encode({
    token: {
      id: citizenUser._id.toString(),
      name: citizenUser.name,
      email: citizenUser.email,
      role: 'citizen',
      sub: citizenUser._id.toString(),
    },
    secret: NEXTAUTH_SECRET,
  });

  console.log('Starting Next.js dev server on port 3007...');
  const nextProcess = spawn('cmd.exe', ['/c', 'npx next dev -p 3007'], {
    env: {
      ...process.env,
      MONGODB_URI: mongoUri,
      NEXTAUTH_SECRET,
      DEMO_AUTH: 'true',
      PORT: '3007',
    },
    shell: true,
    stdio: 'ignore',
  });

  const tempDir = process.env.TEMP || 'C:\\Users\\91701\\AppData\\Local\\Temp';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9222;

  console.log('Starting headless Chrome with remote debugging on port 9222...');
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${tempDir}\\chrome-all-ss`,
    ],
    { stdio: 'ignore' }
  );

  try {
    console.log('Waiting for Next.js dev server on port 3007...');
    await waitForServer('http://localhost:3007/explore');
    console.log('Next.js dev server is ready!');

    // Wait for Chrome CDP port
    await new Promise((r) => setTimeout(r, 2000));
    const { session, close } = await createCdpClient(cdpPort);

    const screenshotsDir = path.join(__dirname, '../docs/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const pages = [
      { name: 'explore', url: 'http://localhost:3007/explore', token: null },
      { name: 'leaderboard', url: 'http://localhost:3007/leaderboard', token: null },
      { name: 'login', url: 'http://localhost:3007/login', token: null },
      { name: 'officer-dashboard', url: 'http://localhost:3007/officer/dashboard', token: officerToken },
      { name: 'my-complaints', url: 'http://localhost:3007/my-complaints', token: citizenToken },
      { name: 'admin', url: 'http://localhost:3007/admin', token: adminToken },
    ];

    for (const page of pages) {
      console.log(`Processing screenshots for: ${page.name}`);

      // Clear or set session cookie
      await session.send('Network.clearBrowserCookies');
      if (page.token) {
        await session.send('Network.setCookie', {
          name: 'next-auth.session-token',
          value: page.token,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
        });
      }

      // Pre-warm route
      await fetch(page.url).catch(() => {});

      // 1. Mobile 390px
      console.log(`  Capturing 390px...`);
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await session.send('Page.navigate', { url: page.url });
      await new Promise((r) => setTimeout(r, 3500));
      const ss390 = await session.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotsDir, `${page.name}-390px.png`), Buffer.from(ss390.data, 'base64'));

      // 2. Desktop 1280px
      console.log(`  Capturing 1280px...`);
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await session.send('Page.navigate', { url: page.url });
      await new Promise((r) => setTimeout(r, 3500));
      const ss1280 = await session.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotsDir, `${page.name}-1280px.png`), Buffer.from(ss1280.data, 'base64'));
    }

    close();
    console.log('All screenshots captured successfully!');
  } finally {
    console.log('Cleaning up processes...');
    chromeProcess.kill('SIGKILL');
    nextProcess.kill('SIGTERM');
    await mongoose.disconnect();
    await replSet.stop();
  }
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
