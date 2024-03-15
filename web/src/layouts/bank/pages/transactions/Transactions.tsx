import React from 'react';
import CharacterAccounts from '@/layouts/bank/pages/accounts/components/CharacterAccounts';
import BaseCard from '@/layouts/bank/components/BaseCard';
import TransactionItem from '@/layouts/bank/pages/dashboard/components/TransactionItem';
import { useQuery } from '@tanstack/react-query';
import { fetchNui } from '@/utils/fetchNui';
import { useActiveAccount } from '@/state/accounts/accounts';
import { ServerOff, Repeat } from 'lucide-react';
import type { Transaction } from '~/typings';
import locales from '@/locales';

const MOCK_TRANSACTIONS: any = [
    { amount: 1500, message: 'Salary', date: '28/10/2023', type: 'inbound' },
    { amount: 2900, message: 'Salary', date: '28/10/2023', type: 'inbound' },
    { amount: 12700, message: 'Withdraw', date: '28/10/2023', type: 'outbound' },
    { amount: 3500, message: 'Deposit', date: '28/10/2023', type: 'inbound' },
    { amount: 3550, message: 'Deposit', date: '28/10/2023', type: 'inbound' },
    { amount: 3550, message: 'Deposit', date: '28/10/2023', type: 'inbound' },
    { amount: 3550, message: 'Deposit', date: '28/10/2023', type: 'inbound' },
    { amount: 3550, message: 'Deposit', date: '28/10/2023', type: 'inbound' },
    { amount: 3550, message: 'Deposit', date: '28/10/2023', type: 'inbound' },
];

const Transactions: React.FC = () => {
    const activeAccount = useActiveAccount();

    const { data, isLoading } = useQuery<Transaction[]>({
        queryKey: ['transactions'],
        queryFn: async () => {
            const resp = await fetchNui<Transaction[]>('getTransactionsData', null, {
                data: MOCK_TRANSACTIONS,
                delay: 1500,
            });

            return resp;
        },
    });

    return (
        <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">
            <React.Suspense fallback={<p>Loading...</p>}>
                <CharacterAccounts />
            </React.Suspense>
            {activeAccount ? (
                <div className="flex flex-col w-full gap-2">
                    <BaseCard title={locales.logs} icon={Repeat} className='flex-1'>
                        {data?.map((transaction) => (
                            <TransactionItem
                                key={`${transaction.amount}-${transaction.type}-${transaction.date}`}
                                amount={transaction.amount}
                                message={transaction.message}
                                date={transaction.date}
                                type={transaction.type}
                            />
                        ))}
                    </BaseCard>
                    <div className="px-2 text-sm w-full flex justify-between">
                        <p>
                            Showing <span className="font-bold">1</span> to <span className="font-bold">10</span> of <span className="font-bold">100</span> entries
                        </p>
                        <div className="flex gap-2 -mt-1">
                            <button className="px-2 py-1 border bg-secondary rounded cursor-pointer">Previous</button>
                            <button className="px-2 py-1 border bg-secondary rounded cursor-pointer">Next</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                    <ServerOff size={32} />
                    <p className="text-xl">{locales.no_account_selected}</p>
                </div>
            )}
        </div>
    );
};

export default Transactions;
