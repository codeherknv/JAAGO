import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint';
import { seedPilotDatabase } from './seedPilot';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

function waitForServer(url: string, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      }).on('error', () => {
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

async function main() {
  console.log('Starting shared MongoMemoryReplSet...');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger', dbName: 'jaago' },
  });
  const mongoUri = replSet.getUri();
  console.log(`MongoMemoryReplSet running at: ${mongoUri}`);

  process.env.MONGODB_URI = mongoUri;

  console.log('Connecting to database and seeding pilot data...');
  await mongoose.connect(mongoUri);
  await seedPilotDatabase();

  const complaint = await Complaint.findOne({ resolutionImageUrl: { $exists: true, $ne: null } });
  if (!complaint) {
    throw new Error('Complaint with resolutionImageUrl not found after seeding');
  }
  const id = complaint._id.toString();
  console.log(`Seeded complaint ID with Before/After: ${id} (${complaint.title})`);

  console.log('Starting Next.js dev server on port 3007...');
  const nextProcess = spawn('cmd.exe', ['/c', 'npx next dev -p 3007'], {
    env: {
      ...process.env,
      MONGODB_URI: mongoUri,
      PORT: '3007',
    },
    shell: true,
    stdio: 'ignore',
  });

  try {
    console.log('Waiting for Next.js dev server on port 3007...');
    await waitForServer('http://localhost:3007/explore');
    console.log('Next.js dev server is ready!');

    const tempDir = process.env.TEMP || 'C:\\Users\\91701\\AppData\\Local\\Temp';
    const out390 = path.join(tempDir, 'complaint-390px.png');
    const out1280 = path.join(tempDir, 'complaint-1280px.png');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const targetUrl = `http://localhost:3007/complaints/${id}`;
    const apiUrl = `http://localhost:3007/api/complaints/${id}`;

    console.log(`Pre-warming API: ${apiUrl}`);
    await waitForServer(apiUrl, 15000);

    console.log(`Pre-warming page: ${targetUrl}`);
    await waitForServer(targetUrl, 20000);
    // Give Next dev server an extra 2 seconds to finish bundling client modules
    await new Promise((r) => setTimeout(r, 3000));

    console.log(`Capturing screenshot of ${targetUrl} (390px)...`);
    execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=6000 --user-data-dir=${tempDir}\\chrome-ss-a --window-size=390,1600 --screenshot="${out390}" "${targetUrl}"`);

    console.log(`Capturing screenshot of ${targetUrl} (1280px)...`);
    execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=6000 --user-data-dir=${tempDir}\\chrome-ss-b --window-size=1280,1400 --screenshot="${out1280}" "${targetUrl}"`);

    const dest390 = path.join(__dirname, '../docs/screenshots/complaint-390px.png');
    const dest1280 = path.join(__dirname, '../docs/screenshots/complaint-1280px.png');

    fs.copyFileSync(out390, dest390);
    fs.copyFileSync(out1280, dest1280);

    console.log(`Saved screenshot 390px: ${dest390}`);
    console.log(`Saved screenshot 1280px: ${dest1280}`);
  } finally {
    console.log('Cleaning up Next.js dev server and database...');
    nextProcess.kill('SIGTERM');
    await mongoose.disconnect();
    await replSet.stop();
  }
}

main().then(() => {
  console.log('Screenshot script completed successfully.');
  process.exit(0);
}).catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
