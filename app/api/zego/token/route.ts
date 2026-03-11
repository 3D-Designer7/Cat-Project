import { NextResponse } from 'next/server';
import crypto from 'crypto';

function makeRandomIv() {
    const str = '0123456789abcdefghijklmnopqrstuvwxyz';
    const result = [];
    for (let i = 0; i < 16; i++) {
        const r = Math.floor(Math.random() * str.length);
        result.push(str[r]);
    }
    return result.join('');
}

function generateToken04(appId: number, userId: string, secret: string, effectiveTimeInSeconds: number, payload: string) {
    if (!appId || typeof appId !== 'number') {
        throw new Error('appId invalid');
    }
    if (!userId || typeof userId !== 'string') {
        throw new Error('userId invalid');
    }
    if (!secret || typeof secret !== 'string' || secret.length !== 32) {
        throw new Error('secret must be a 32 byte string');
    }
    if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
        throw new Error('effectiveTimeInSeconds invalid');
    }
    const createTime = Math.floor(new Date().getTime() / 1000);
    const tokenInfo = {
        app_id: appId,
        user_id: userId,
        nonce: makeRandomIv(),
        ctime: createTime,
        expire: createTime + effectiveTimeInSeconds,
        payload: payload || ''
    };
    const plaintText = JSON.stringify(tokenInfo);
    const iv = makeRandomIv();
    const cipher = crypto.createCipheriv('aes-256-cbc', secret, iv);
    const encryptBuf = cipher.update(plaintText, 'utf8');
    const b1 = Buffer.concat([encryptBuf, cipher.final()]);
    const b2 = Buffer.alloc(8);
    b2.writeBigInt64BE(BigInt(tokenInfo.expire), 0);
    const b3 = Buffer.alloc(2);
    b3.writeUInt16BE(iv.length, 0);
    const b4 = Buffer.alloc(2);
    b4.writeUInt16BE(b1.length, 0);
    const buf = Buffer.concat([
        b2,
        b3,
        Buffer.from(iv),
        b4,
        b1
    ]);
    return '04' + buf.toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const roomId = searchParams.get('roomId');

  if (!userId || !roomId) {
    return NextResponse.json({ error: 'Missing userId or roomId' }, { status: 400 });
  }

  const appId = Number(process.env.NEXT_PUBLIC_ZEGOCLOUD_APP_ID);
  const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET;

  if (!appId || !serverSecret) {
    return NextResponse.json({ error: 'Missing ZEGOCLOUD credentials' }, { status: 500 });
  }

  try {
    // Generate token valid for 24 hours
    const token = generateToken04(appId, userId, serverSecret, 24 * 3600, '');
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating ZEGOCLOUD token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
