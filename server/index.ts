import { onClientCallback } from '@overextended/ox_lib/server';
import type { AccessTableData, Account, AccountRole, DashboardData } from '../typings';
import { oxmysql } from '@overextended/oxmysql';
import { Ox, GetPlayer } from '@overextended/ox_core/server';
import * as console from 'console';
import { GetCharIdFromStateId } from '@overextended/ox_core/package/server/player/db';

type GetAccountsReponse = {
  id: Account['id'];
  label?: Account['label'];
  group?: Account['group'];
  balance: Account['balance'];
  isDefault?: Account['isDefault'];
  owner: number;
  type: Account['type'];
  role: AccountRole;
  firstName: string;
  lastName: string;
};

onClientCallback('ox_banking:getAccounts', async (playerId): Promise<Account[]> => {
  const player = GetPlayer(playerId);

  if (!player) return;

  const accessAccounts = await oxmysql.rawExecute<GetAccountsReponse[]>(
    `
    SELECT a.id, a.label, a.owner, a.group, a.balance, a.isDefault, a.type, b.firstName, b.lastName, c.role
    FROM \`accounts_access\` c
    LEFT JOIN accounts a ON a.id = c.accountId
    LEFT JOIN characters b ON b.charId = a.owner
    WHERE c.charId = ?
    `,
    [player.charId]
  );

  const accounts: Account[] = accessAccounts.map((account) => ({
    group: account.group,
    id: account.id,
    label: account.label,
    isDefault: player.charId === account.owner ? account.isDefault : false,
    balance: account.balance,
    type: account.type,
    owner: `${account.firstName} ${account.lastName}`,
    role: account.role,
  }));

  return accounts;
});

onClientCallback('ox_banking:createAccount', async (playerId, { name, shared }: { name: string; shared: boolean }) => {
  const { charId } = GetPlayer(playerId);

  if (!charId) return;

  return await Ox.CreateAccount(charId, name, shared);
});

onClientCallback('ox_banking:deleteAccount', async (playerId, accountId: number) => {
  const { charId } = GetPlayer(playerId);
  const role = charId && (await Ox.GetAccountRole(accountId, charId));

  if (role !== 'owner' && role !== 'manager') return;

  return await Ox.DeleteAccount(accountId);
});

interface UpdateBalance {
  accountId: number;
  amount: number;
}

interface TransferBalance {
  fromAccountId: number;
  target: string | number;
  transferType: 'account' | 'person';
  amount: number;
}

onClientCallback('ox_banking:depositMoney', async (playerId, { accountId, amount }: UpdateBalance) => {
  return await Ox.DepositMoney(playerId, accountId, amount);
});

onClientCallback('ox_banking:withdrawMoney', async (playerId, { accountId, amount }: UpdateBalance) => {
  return await Ox.WithdrawMoney(playerId, accountId, amount);
});

onClientCallback(
  'ox_banking:transferMoney',
  async (playerId, { fromAccountId, target, transferType, amount }: TransferBalance) => {
    const { charId } = GetPlayer(playerId);
    const role = charId && (await Ox.GetAccountRole(fromAccountId, charId));

    if (role !== 'owner' && role !== 'manager') return;

    const targetAccountId =
      transferType === 'account' ? (target as number) : (await Ox.GetCharacterAccount(target))?.id;

    if (targetAccountId) {
      //@todo notify
      return await Ox.TransferAccountBalance(fromAccountId, targetAccountId, amount);
    }
  }
);

onClientCallback('ox_banking:getDashboardData', async (playerId): Promise<DashboardData> => {
  const account = await GetPlayer(playerId)?.getAccount();

  if (!account) return;

  const lastTransactions = await oxmysql.rawExecute<{
    amount: number;
    date: string;
    toId?: number;
    fromId?: number;
    reason: string;
  }[]>(
    `
    SELECT amount, date, toId, fromId, reason
    FROM accounts_transactions
    WHERE toId = ? OR fromId = ?
    ORDER BY date DESC
    LIMIT 5
    `,
    [account.id, account.id]
  );

  const transactions : {
    amount: number;
    date: string;
    reason: string;
    type: 'inbound' | 'outbound';
  }[] = lastTransactions.map((transaction) => {
    return {
      amount: transaction.amount,
      date: transaction.date,
      reason: transaction.reason,
      type: transaction.toId === account.id ? 'inbound' : 'outbound',
    };
  });

  return {
    balance: account.balance,
    overview: [],
    transactions: transactions,
    invoices: [],
  };
});

onClientCallback(
  'ox_banking:getAccountUsers',
  async (
    playerId,
    data: {
      accountId: number;
      page: number;
      search?: string;
    }
  ): Promise<AccessTableData> => {
    const { accountId, page, search } = data;

    const wildcard = `%${search}%`;

    const users = await oxmysql.rawExecute<AccessTableData['users']>(
      `
      SELECT c.stateId, a.role, CONCAT(c.firstName, " ", c.lastName) AS \`name\` FROM \`accounts_access\` a
      LEFT JOIN \`characters\` c ON c.charId = a.charId
      WHERE a.accountId = ?
      AND CONCAT(c.firstName, " ", c.lastName) LIKE ?
      ORDER BY a.role DESC
      LIMIT 7
      OFFSET ?
      `,
      [accountId, wildcard, page * 7]
    );

    const usersCount = await oxmysql.prepare<number>(
      'SELECT COUNT(*) FROM `accounts_access` ac LEFT JOIN characters c ON c.charId = ac.charId WHERE accountId = ? AND CONCAT(c.firstName, " ", c.lastName) LIKE ?',
      [accountId, wildcard]
    );

    return {
      numberOfPages: Math.ceil(usersCount / 7),
      users,
    };
  }
);

onClientCallback(
  'ox_banking:addUserToAccount',
  async (
    playerId,
    data: {
      accountId: number;
      stateId: string;
      role: string;
    }
  ) => {
    const { accountId, stateId, role } = data;
    const { charId } = GetPlayer(playerId);
    const userRole = await Ox.GetAccountRole(accountId, charId);

    if (userRole !== 'owner' && userRole !== 'manager') return;

    const success = await oxmysql.prepare('SELECT 1 FROM `characters` WHERE `stateId` = ?', [stateId]);

    // todo locale
    if (!success) return 'No person with provided state id found.';

    return await Ox.SetAccountAccess(accountId, charId, role);
  }
);

onClientCallback(
  'ox_banking:manageUser',
  async (
    playerId,
    data: {
      accountId: number;
      targetStateId: string;
      values: { role: string };
    }
  ): Promise<boolean> => {
    const { charId } = GetPlayer(playerId);
    const role = await Ox.GetAccountRole(data.accountId, charId);

    if (role !== 'owner') return false;

    return (await Ox.SetAccountAccess(data.accountId, data.targetStateId, data.values.role)) > 0;
  }
);

onClientCallback('ox_banking:removeUser', async (playerId, data: { targetStateId: string; accountId: number }) => {
  const { charId } = GetPlayer(playerId);
  const role = await Ox.GetAccountRole(data.accountId, charId);

  if (role !== 'owner' && role !== 'manager') return;

  return await Ox.RemoveAccountAccess(data.accountId, data.targetStateId);
});

onClientCallback(
  'ox_banking:transferOwnership',
  async (
    playerId,
    data: {
      targetStateId: string;
      accountId: number;
    }
  ): Promise<true | 'state_id_not_exists'> => {
    // todo: move to ox_core

    const { charId } = GetPlayer(playerId);
    const accountRole = await Ox.GetAccountRole(data.accountId, charId);

    if (accountRole !== 'owner') return;

    const targetCharId = await oxmysql.prepare<number | null>('SELECT `charId` FROM `characters` WHERE `stateId` = ?', [
      data.targetStateId,
    ]);

    if (!targetCharId) return 'state_id_not_exists';

    await oxmysql.prepare(
      "INSERT INTO `accounts_access` (`accountId`, `charId`, `role`) VALUES (?, ?, 'owner') ON DUPLICATE KEY UPDATE `role` = 'owner'",
      [data.accountId, targetCharId]
    );

    await oxmysql.prepare('UPDATE `accounts` SET `owner` = ? WHERE `id` = ?', [targetCharId, data.accountId]);

    await oxmysql.prepare("UPDATE `accounts_access` SET `role` = 'manager' WHERE `accountId` = ? AND `charId` = ?", [
      data.accountId,
      charId,
    ]);

    return true;
  }
);
