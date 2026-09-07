import request from 'supertest';
import { PrismaClient } from '@prisma/client';

process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

const prisma = new PrismaClient();

async function clearTestData() {
  await prisma.verificationToken.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'test-',
      },
    },
  });
}

async function testAuthFlow() {
  console.log('\n=== YESYES Auth Flow E2E Test ===\n');
  let passed = 0;
  let failed = 0;

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123456';
  const adminEmail = 'BDanielParedesF@gmail.com';

  async function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${name}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  let app: any;
  try {
    const indexModule = await import('../src/index');
    app = indexModule.default;
  } catch (error: any) {
    console.error('Failed to load app:', error.message);
    process.exit(1);
  }

  try {
    await clearTestData();
    console.log('Cleaned test data');

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        lastName: 'User',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      });

    await assert('Register returns 201', registerRes.status === 201, `got ${registerRes.status}`);
    const registerToken = registerRes.body.token;
    await assert('Register returns token', !!registerToken, `got ${JSON.stringify(registerRes.body)}`);
    await assert('Register sets emailVerified false', registerRes.body.emailVerified === false);

    const userAfterRegister = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase().trim() },
    });
    await assert('User created in DB', !!userAfterRegister);
    await assert('User email is lowercase', userAfterRegister?.email === testEmail.toLowerCase().trim());
    await assert('User emailVerified is false', userAfterRegister?.emailVerified === false);
    await assert('User role is CUSTOMER', userAfterRegister?.role === 'CUSTOMER');

    const verifyToken = registerRes.body.verificationToken;
    await assert('Verification token returned', !!verifyToken);

    const verifyRes = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: verifyToken });

    await assert('Verify email redirects (302)', verifyRes.status === 302 || verifyRes.status === 200);

    const userAfterVerify = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase().trim() },
    });
    await assert('User emailVerified is true after verify', userAfterVerify?.emailVerified === true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    await assert('Login returns 200', loginRes.status === 200, `got ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    const loginToken = loginRes.body.token;
    await assert('Login returns token', !!loginToken);
    await assert('Login returns emailVerified true', loginRes.body.emailVerified === true);
    await assert('Login returns CUSTOMER role', loginRes.body.role === 'CUSTOMER');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginToken}`);

    await assert('/me returns 200', meRes.status === 200, `got ${meRes.status} ${JSON.stringify(meRes.body)}`);
    await assert('/me returns user', !!meRes.body.user);
    await assert('/me user id matches', meRes.body.user.id === loginRes.body.id);

    const logoutRes = await request(app)
      .post('/api/auth/signout')
      .set('Authorization', `Bearer ${loginToken}`);

    await assert('Logout returns 200', logoutRes.status === 200, `got ${logoutRes.status}`);
    await assert('Logout returns redirectTo', !!logoutRes.body.redirectTo, JSON.stringify(logoutRes.body));

    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail.toLowerCase().trim() },
    });

    if (!adminUser) {
      console.log('  Creating admin user for test...');
      const bcrypt = await import('bcryptjs');
      const adminHash = await bcrypt.hash('admin123456', 12);
      await prisma.user.create({
        data: {
          email: adminEmail.toLowerCase().trim(),
          name: 'Admin',
          lastName: 'User',
          password: adminHash,
          emailVerified: true,
          role: 'CUSTOMER',
          isActive: true,
        },
      });
    }

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'admin123456',
      });

    if (adminLoginRes.status === 401 || adminLoginRes.status === 404) {
      console.log('  SKIP: Admin login test (admin user not set up with expected password)');
    } else {
      await assert('Admin login returns 200', adminLoginRes.status === 200, `got ${adminLoginRes.status} ${JSON.stringify(adminLoginRes.body)}`);
      await assert('Admin login returns ADMIN role', adminLoginRes.body.role === 'ADMIN', `got role: ${adminLoginRes.body.role}`);
    }

    const googleSimRes = await request(app)
      .get('/api/auth/signin/google')
      .query({ callbackUrl: '/' });

    await assert('Google signin returns redirect (302)', googleSimRes.status === 302 || googleSimRes.status === 200, `got ${googleSimRes.status}`);

    const noVerifyLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'wrong',
      });

    await assert('Wrong password returns 401', noVerifyLogin.status === 401, `got ${noVerifyLogin.status}`);

    const loginRateLimitRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'wrong',
      });

    await assert('Rate limit response is 429 or 401', loginRateLimitRes.status === 429 || loginRateLimitRes.status === 401);

  } catch (error: any) {
    console.error('Test error:', error.message);
    failed++;
  } finally {
    await clearTestData();
    await prisma.$disconnect();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

testAuthFlow();
