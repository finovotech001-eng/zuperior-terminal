import { PrismaClient } from '../lib/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupTestUser() {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'akhileshlakhanpal660@gmail.com' },
      include: { mt5Accounts: true }
    });

    if (!existingUser) {
      console.log('❌ User not found. Please create the user first.');
      return;
    }

    console.log('✅ Found existing user:', existingUser.email);

    // Check if MT5 accounts are already linked
    if (existingUser.mt5Accounts.length > 0) {
      console.log(`✅ ${existingUser.mt5Accounts.length} MT5 account(s) already linked!`);
      existingUser.mt5Accounts.forEach((account, index) => {
        console.log(`${index + 1}. Account ID: ${account.accountId}`);
      });

      // If only one account exists, add more for testing
      if (existingUser.mt5Accounts.length === 1) {
        console.log('📝 Adding more test accounts...');

        // Add additional test accounts
        const additionalAccounts = [
          '794796',
          '794797',
          '794798'
        ];

        for (const accountId of additionalAccounts) {
          await prisma.mT5Account.create({
            data: {
              accountId: accountId,
              userId: existingUser.id,
            },
          });
          console.log(`✅ Added MT5 Account: ${accountId}`);
        }
      }
      return;
    }

    // Create multiple MT5 accounts linked to this user for testing
    const testAccountIds = [
      '19876933', // Existing account
      '794795',
      '794796',
      '794797',
      '794798'
    ];

    for (const accountId of testAccountIds) {
      await prisma.mT5Account.create({
        data: {
          accountId: accountId,
          userId: existingUser.id,
        },
      });
      console.log(`✅ Created MT5 Account: ${accountId}`);
    }

    console.log('🎉 All MT5 Accounts linked successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestUser();