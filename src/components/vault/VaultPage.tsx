import { ArrowUpRight, ExternalLink, KeyRound, Lock, Plus } from 'lucide-react';
import Input from '../ui/Input';

export function VaultFilters() {
  return (
    <div className="flex items-center justify-between mt-3">
      <Input
        disabled={false}
        className="max-w-[500px] !bg-white"
        placeholder="Search vaults by name, address."
      />
    </div>
  );
}

export function VaultCard({
  name,
  tvl,
  apr,
  link,
  address,
}: {
  name: string;
  tvl: number;
  apr: number;
  link: string;
  address: string;
}) {
  return (
    <div className="hover:ring-zinc-400 ring-1 ring-zinc-300 rounded-2xl shadow-lg flex flex-col gap-3  hover:scale-101 transition-all duration-300 bg-white p-4">
      <div className="flex items-center justify-between border-zinc-300 ">
        <h1 className="text-lg font-semibold text-zinc-900 ">{name}</h1>
        <span className="text-xs font-mono bg-lime-300 text-emerald-900 px-2 py-1 ring ring-lime-600 rounded-md font-bold">
          {apr}% APR
        </span>
      </div>
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col gap-1 p-3">
          <div className="flex items-center  justify-between gap-3 ">
            <span className="text-sm text-zinc-600 whitespace-nowrap">Total Value Locked </span>
            <span className="h-0.5 rounded-full w-full bg-zinc-300" />
            <span className="text-zinc-700 font-mono  font-bold">${tvl}</span>
          </div>

          <div className="flex items-center  justify-between gap-3 ">
            <span className="text-sm text-zinc-600 whitespace-nowrap">Annual Percentage Rate</span>
            <span className="h-0.5 rounded-full w-full bg-zinc-300" />
            <span className="text-zinc-700 font-mono  font-bold">${apr}%</span>
          </div>

          <div className="flex items-center  justify-between gap-3 ">
            <span className="text-sm text-zinc-600 whitespace-nowrap">Deposit Token</span>
            <span className="h-0.5 rounded-full w-full bg-zinc-300" />
            <span className="text-zinc-700 font-mono  font-bold">USDC</span>
          </div>
        </div>
        <div className="flex flex-col rounded-t-xl  gap-1 bg-zinc-200 p-3 rounded-">
          <div className="flex font-mono items-center text-xs  justify-between gap-3 ">
            <span className=" text-zinc-600 whitespace-nowrap font-medium">Vault Address</span>
            <span className="h-0.5 rounded-full w-full bg-blue-500" />
            <a
              href={`https://solscan.io/address/${address}`}
              className="text-zinc-500  hover:text-blue-500 font-mono font-bold flex items-center gap-1 group"
              target="_blank"
              rel="noopener noreferrer"
            >
              0x1234...7890
              <ArrowUpRight className="w-0 group-hover:w-5 h-5 scale-0 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </a>
          </div>

          <div className="flex font-mono  items-center text-xs  justify-between gap-3 ">
            <span className="text-zinc-600 font-medium whitespace-nowrap">Website</span>
            <span className="h-0.5 rounded-full w-full bg-blue-500" />
            <a
              href={link}
              className="text-zinc-500  hover:text-blue-500 font-mono font-bold flex items-center gap-1 group"
              target="_blank"
              rel="noopener noreferrer"
            >
              {link}
              <ArrowUpRight className="w-0 group-hover:w-5 h-5 scale-0 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </a>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="bg-lime-400 text-lime-900 hover:brightness-110 duration-100 cursor-pointer font-semibold  px-4 py-2 rounded-xl flex items-center justify-center gap-2">
          <Lock className="w-4 h-4" />
          Deposit
        </button>
        <button className="bg-zinc-900 hover:bg-zinc-800 duration-100 cursor-pointer font-semibold text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2">
          <KeyRound className="w-4 h-4" />
          Withdraw
        </button>
      </div>
    </div>
  );
}

export function CreateVaultCard() {
  return (
    <div className="bg-white ring-1 ring-zinc-300 rounded-2xl shadow-lg flex flex-col gap-3  hover:scale-101 transition-all duration-300  p-3">
      <button className="bg-zinc-100 h-full w-full hover:bg-zinc-200 rounded-2xl flex items-center justify-center text-zinc-700 duration-100 cursor-pointer font-semibold text-2xl px-4 py-2">
        <Plus className="w-10 h-10" />
        Create Vault
      </button>
    </div>
  );
}
export function VaultPage() {
  return (
    <div className="flex-1 bg-zinc-100">
      <div className="flex flex-col p-6 container mx-auto">
        <div className="mt-6">
          <h1 className="text-4xl font-bold font-mono ">$1239510.00</h1>
          <div className="text-lg text-zinc-500 font-medium flex items-center gap-1">
            Locked Capital.{' '}
            <a className="text-blue-500 flex items-center gap-1">
              Learn More
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
        <VaultFilters />
        <div className="grid grid-cols-3 gap-3 mt-6">
          <VaultCard
            name="Marginfyi"
            link="https://marginfyi.com"
            tvl={35134}
            apr={7.6}
            address="0x1234...7890"
          />
          <VaultCard
            name="Kamino Finance"
            link="https://kamino.finance"
            tvl={13414}
            apr={2.1}
            address="0x1234...7890"
          />
          <VaultCard
            address="0x1234...7890"
            name="Drift Protocol"
            link="https://driftprotocol.com"
            tvl={13436453}
            apr={10.6}
          />
          <VaultCard
            name="Orca-Lp"
            link="https://orca.so"
            tvl={1000000}
            apr={256.3}
            address="0x1234...7890"
          />
          <CreateVaultCard />
        </div>
      </div>
    </div>
  );
}
