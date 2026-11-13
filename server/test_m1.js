const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const express = require('express');
const { Organization, User, Template } = require('./src/models');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');

async function runM1AcceptanceTests() {
  console.log('====================================================');
  console.log('       DOCUMIND MILESTONE M1 ACCEPTANCE TESTS       ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 6;

  // Setup express test server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);

  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✓ Connected to MongoDB Atlas\n');

    const rand = Math.floor(Math.random() * 100000);
    const orgAEmail = `admin_a_${rand}@test.com`;
    const orgBEmail = `admin_b_${rand}@test.com`;

    // ----------------------------------------------------
    // Test 1: Register Two Separate Organizations & Seed Templates
    // ----------------------------------------------------
    console.log('1. Testing Organization Registration & 5 Built-in Templates Copy...');
    const regResA = await fetch(`${baseUrl}/api/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `Tenant Alpha ${rand}`,
        name: 'Admin Alpha',
        email: orgAEmail,
        password: 'Password123!'
      })
    });
    const regDataA = await regResA.json();

    const regResB = await fetch(`${baseUrl}/api/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `Tenant Beta ${rand}`,
        name: 'Admin Beta',
        email: orgBEmail,
        password: 'Password123!'
      })
    });
    const regDataB = await regResB.json();

    if (regResA.status === 201 && regResB.status === 201) {
      // Check that 5 templates were copied for Org A
      const templatesA = await Template.find({ orgId: regDataA.organization.id });
      const templatesB = await Template.find({ orgId: regDataB.organization.id });

      if (templatesA.length === 5 && templatesB.length === 5) {
        console.log(`   ✓ Org A created with 5 templates (OrgID: ${regDataA.organization.id})`);
        console.log(`   ✓ Org B created with 5 templates (OrgID: ${regDataB.organization.id})`);
        passed++;
      } else {
        console.error(`   ✗ Expected 5 templates per org, got A: ${templatesA.length}, B: ${templatesB.length}`);
      }
    } else {
      console.error('   ✗ Failed to register organizations:', regDataA, regDataB);
    }

    const tokenA = regDataA.token;
    const tokenB = regDataB.token;

    // ----------------------------------------------------
    // Test 2: Multi-Tenant Isolation (Org A cannot see Org B)
    // ----------------------------------------------------
    console.log('\n2. Testing Strict Multi-Tenant Isolation between Org A and Org B...');
    // Create an employee in Org A
    const empEmailA = `employee_a_${rand}@test.com`;
    const addEmpRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: 'Employee Alpha',
        email: empEmailA,
        password: 'Password123!',
        role: 'employee'
      })
    });
    const empDataA = await addEmpRes.json();

    // Query users as Org B Admin
    const listUsersB = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const usersB = await listUsersB.json();

    const leakedUser = usersB.find(u => u.email === empEmailA || u.email === orgAEmail);
    if (!leakedUser && usersB.length === 1 && usersB[0].email === orgBEmail) {
      console.log('   ✓ Tenant isolation verified: Org B sees 0 users from Org A.');
      passed++;
    } else {
      console.error('   ✗ Cross-tenant leak detected! Users returned to Org B:', usersB);
    }

    // ----------------------------------------------------
    // Test 3: Authentication & 401 Without Token
    // ----------------------------------------------------
    console.log('\n3. Testing 401 Without Token or with Invalid Token...');
    const noTokenRes = await fetch(`${baseUrl}/api/users`);
    const badTokenRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: 'Bearer invalid_garbage_token_123' }
    });

    if (noTokenRes.status === 401 && badTokenRes.status === 401) {
      console.log('   ✓ 401 returned when request lacks token or token is invalid.');
      passed++;
    } else {
      console.error(`   ✗ Expected 401, got noToken=${noTokenRes.status}, badToken=${badTokenRes.status}`);
    }

    // ----------------------------------------------------
    // Test 4: RBAC Role Checks & 403 Forbidden
    // ----------------------------------------------------
    console.log('\n4. Testing RBAC Role Enforcement (403 for unauthorized role)...');
    // Login as Employee A
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: empEmailA,
        password: 'Password123!'
      })
    });
    const empLoginData = await empLoginRes.json();
    const empToken = empLoginData.token;

    // Employee attempts to access Admin-only /api/users
    const empAccessAdminRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${empToken}` }
    });

    if (empAccessAdminRes.status === 403) {
      console.log('   ✓ 403 Forbidden correctly returned when employee attempts admin action.');
      passed++;
    } else {
      console.error(`   ✗ Expected 403 for employee on /api/users, got ${empAccessAdminRes.status}`);
    }

    // ----------------------------------------------------
    // Test 5: Deactivated User Blocking
    // ----------------------------------------------------
    console.log('\n5. Testing Immediate Deactivated User Blocking...');
    // Deactivate Employee A using Admin A
    const deactRes = await fetch(`${baseUrl}/api/users/${empDataA.user._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ isActive: false })
    });
    const deactData = await deactRes.json();

    // Deactivated user tries to login
    const deactLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: empEmailA,
        password: 'Password123!'
      })
    });

    // Deactivated user tries to use existing token
    const deactApiRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${empToken}` }
    });

    if (deactLoginRes.status === 403 && deactApiRes.status === 403) {
      console.log('   ✓ Deactivated user blocked on login (403) and existing token immediately revoked (403).');
      passed++;
    } else {
      console.error(`   ✗ Deactivation check failed: login=${deactLoginRes.status}, api=${deactApiRes.status}`);
    }

    // ----------------------------------------------------
    // Test 6: Password Policy (Min 8 characters) & Session Profile
    // ----------------------------------------------------
    console.log('\n6. Testing Password Policy (>= 8 chars) & Profile Routes...');
    const shortPassRes = await fetch(`${baseUrl}/api/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: 'ShortPass Org',
        name: 'Tester',
        email: `shortpass_${rand}@test.com`,
        password: '123'
      })
    });

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meData = await meRes.json();

    if (shortPassRes.status === 400 && meRes.status === 200 && meData.user.name === 'Admin Alpha') {
      console.log('   ✓ Minimum 8-char password enforcement passed.');
      console.log('   ✓ Profile GET /me returned user and org data.');
      passed++;
    } else {
      console.error('   ✗ Password or profile check failed:', shortPassRes.status, meRes.status);
    }

    // Cleanup created test orgs and users
    await User.deleteMany({ email: { $in: [orgAEmail, orgBEmail, empEmailA] } });
    await Template.deleteMany({ orgId: { $in: [regDataA.organization.id, regDataB.organization.id] } });
    await Organization.deleteMany({ _id: { $in: [regDataA.organization.id, regDataB.organization.id] } });

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(` M1 ACCEPTANCE RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================');

  process.exit(passed === total ? 0 : 1);
}

runM1AcceptanceTests();
