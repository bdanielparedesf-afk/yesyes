const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const API = 'http://127.0.0.1:3001/api';
const suffix = Date.now();
const password = 'BusinessV3!Test9';
const emails = { a: `bizv3.a.${suffix}@yesyes.cl`, b: `bizv3.b.${suffix}@yesyes.cl`, admin: `bizv3.admin.${suffix}@yesyes.cl` };
const createdUserIds = [];
let businessIds = [];

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let payload = null;
  try { payload = await response.json(); } catch { /* empty */ }
  return { status: response.status, body: payload };
}
function ok(condition, name, detail) {
  if (!condition) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  console.log(`PASS ${name}`);
}
async function createUser(email, role = 'CUSTOMER') {
  const user = await prisma.user.create({ data: { name: 'Business V3 E2E', lastName: 'Fixture', email, password: await bcrypt.hash(password, 4), emailVerified: true, role, isActive: true } });
  createdUserIds.push(user.id);
  return user;
}
async function login(email) {
  const response = await request('/auth/login', { method: 'POST', body: { email, password } });
  ok(response.status === 200 && response.body?.token, `login ${email}`, response.body);
  return response.body.token;
}
async function cleanup() {
  if (businessIds.length) await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
}
module.exports = { prisma, API, suffix, emails, password, request, ok, createUser, login, cleanup, get businessIds() { return businessIds; }, set businessIds(value) { businessIds = value; } };
