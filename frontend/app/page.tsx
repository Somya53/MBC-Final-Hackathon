"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

// shadcn/ui components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash, Play, Wallet } from "lucide-react";

// TaskAutomator ABI from Hardhat build artifacts
const ABI: any[] = [
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "taskId", "type": "uint256" }], "name": "TaskCancelled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "taskId", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "string", "name": "action", "type": "string" }], "name": "TaskCreated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "taskId", "type": "uint256" }, { "indexed": false, "internalType": "string", "name": "action", "type": "string" }], "name": "TaskExecuted", "type": "event" },
  { "inputs": [{ "internalType": "uint256", "name": "taskId", "type": "uint256" }], "name": "cancelTask", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "action", "type": "string" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "interval", "type": "uint256" }], "name": "createTask", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "taskId", "type": "uint256" }], "name": "runTask", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "taskCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "tasks", "outputs": [{ "internalType": "address", "name": "user", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "string", "name": "action", "type": "string" }, { "internalType": "uint256", "name": "nextExecution", "type": "uint256" }, { "internalType": "uint256", "name": "interval", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "stateMutability": "view", "type": "function" }
];
const DEFAULT_CONTRACT_ADDRESS = "";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [account, setAccount] = useState("");
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [contract, setContract] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [action, setAction] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [interval, setInterval] = useState<number>(60);

  // mark component as mounted (client-only rendering)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize provider using Web3Provider
  useEffect(() => {
    if (!mounted) return;
    if ((window as any).ethereum) {
      const p = new ethers.providers.Web3Provider((window as any).ethereum);
      setProvider(p);
    }
  }, [mounted]);

  // Initialize contract with provider
  useEffect(() => {
    if (!mounted) return;
    if (!provider || !contractAddress) return;
    setContract(new ethers.Contract(contractAddress, ABI, provider));
  }, [mounted, provider, contractAddress]);

  const connectWallet = async () => {
    if (!provider) return alert('Install MetaMask or Base wallet');
    const s = provider.getSigner();
    const addr = await s.getAddress();
    setSigner(s);
    setAccount(addr);
    if (contractAddress) setContract(new ethers.Contract(contractAddress, ABI, s));
  };

  const loadTasks = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = Number(await contract.taskCount());
      setTaskCount(count);
      const arr = [];
      for (let i = 1; i <= count; i++) {
        const t = await contract.tasks(i);
        arr.push({
          id: i,
          user: t.user,
          amount: t.amount.toString(),
          action: t.action,
          nextExecution: new Date(Number(t.nextExecution) * 1000),
          interval: Number(t.interval),
          active: t.active,
        });
      }
      setTasks(arr.reverse());
    } catch (err) {
      console.error(err);
      alert('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    if (!signer || !contract) return alert('Connect wallet');
    try {
      const tx = await contract.connect(signer).createTask(action, BigInt(amount), interval);
      await tx.wait();
      setAction('');
      setAmount(0);
      setInterval(60);
      await loadTasks();
    } catch (err) {
      console.error(err);
      alert('Create task failed');
    }
  };

  const cancelTask = async (id: number) => {
    if (!signer || !contract) return;
    try {
      const tx = await contract.connect(signer).cancelTask(id);
      await tx.wait();
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const runTask = async (id: number) => {
    if (!signer || !contract) return;
    try {
      const tx = await contract.connect(signer).runTask(id);
      await tx.wait();
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  if (!mounted) return null; // prevent SSR mismatches

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold">TaskAutomator — Dashboard</h1>
          <div className="flex items-center gap-2">
            <Input placeholder="Contract address" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} className="w-96" />
            <Button onClick={loadTasks}>Load</Button>
            <Button onClick={connectWallet}>{account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Connect'}</Button>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Create Task</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label>Action</Label>
                  <Textarea value={action} onChange={(e) => setAction(e.target.value)} />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Interval (seconds)</Label>
                  <Input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createTask}>Create</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loading && <div>Loading tasks...</div>}
                {tasks.map(t => (
                  <div key={t.id} className="border p-3 rounded flex justify-between bg-white">
                    <div>
                      <div>#{t.id} • {t.active ? 'Active' : 'Inactive'}</div>
                      <div>{t.action}</div>
                      <div>Amount: {t.amount} • Interval: {t.interval}s</div>
                      <div>Next execution: {t.nextExecution.toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button onClick={() => runTask(t.id)}><Play size={14}/> Run</Button>
                      <Button variant="destructive" onClick={() => cancelTask(t.id)}><Trash size={14}/> Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />
      </div>
    </div>
  );
}
