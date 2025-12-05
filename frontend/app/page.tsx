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
const templates = [
  {
    title: "Swap 10 USDC → ETH every Friday",
    action: "Swap 10 USDC to ETH every Friday using AgentKit on Base (use 0x/Uniswap router).",
    amount: 10,
    interval: 7 * 24 * 60 * 60,
  },
  {
    title: "Send rent on the 1st",
    action: "Send rent to landlord on the 1st of each month from smart wallet.",
    amount: 1000,
    interval: 30 * 24 * 60 * 60,
  },
  {
    title: "Auto-buy friend’s NFT if under 0.005 ETH",
    action: "Auto-buy friend's NFT if price drops below 0.005 ETH; monitor listings hourly.",
    amount: 0,
    interval: 60 * 60,
  },
  {
    title: "Notify me when balance < X",
    action: "Notify me when my balance drops below threshold; check every 10 minutes.",
    amount: 0,
    interval: 600,
  },
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
  const [status, setStatus] = useState<string>("");
  const [notifications, setNotifications] = useState<string[]>([]);

  const pushNotification = (msg: string) => {
    setNotifications((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 8));
  };

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

  // Listen for on-chain events to surface agent/contract activity
  useEffect(() => {
    if (!contract) return;

    const onCreated = (taskId: any, user: string, action: string) => {
      pushNotification(`Task #${Number(taskId)} created by ${user} (${action})`);
    };
    const onExecuted = (taskId: any, action: string) => {
      pushNotification(`Task #${Number(taskId)} executed (${action})`);
    };
    const onCancelled = (taskId: any) => {
      pushNotification(`Task #${Number(taskId)} cancelled`);
    };

    contract.on("TaskCreated", onCreated);
    contract.on("TaskExecuted", onExecuted);
    contract.on("TaskCancelled", onCancelled);

    return () => {
      contract.off("TaskCreated", onCreated);
      contract.off("TaskExecuted", onExecuted);
      contract.off("TaskCancelled", onCancelled);
    };
  }, [contract]);

  const applyTemplate = (tpl: (typeof templates)[number]) => {
    setAction(tpl.action);
    setAmount(tpl.amount);
    setInterval(tpl.interval);
    setStatus(`Loaded template: ${tpl.title}`);
  };

  const connectWallet = async () => {
    if (!provider) return alert('Install MetaMask or Base wallet');

    // request user accounts
    await provider.send("eth_requestAccounts", []);

    const s = provider.getSigner();
    const addr = await s.getAddress();
    setSigner(s);
    setAccount(addr);

    // make sure contract address is valid
    if (!contractAddress) return alert("Enter contract address first");

    const c = new ethers.Contract(contractAddress, ABI, s);
    setContract(c);

    // optionally load tasks immediately
    await loadTasks();
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
      const note = `Loaded ${arr.length} task(s)`;
      setStatus(note);
      pushNotification(note);
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
      setStatus('Task created and queued for agent/Run');
      pushNotification('Task created');
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
      pushNotification(`Cancelled task #${id}`);
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
      pushNotification(`Manually ran task #${id}`);
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
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Base Mini-Agent</p>
            <h1 className="text-3xl font-extrabold">Onchain Personal Assistant</h1>
            <p className="text-sm text-slate-600">Build timed actions the agent will execute (swaps, rent, NFT snipes, balance alerts).</p>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Contract address" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} className="w-96" />
            <Button onClick={loadTasks}>Load</Button>
            <Button onClick={connectWallet}>{account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Connect'}</Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Quick templates</CardTitle>
            <p className="text-sm text-slate-600">Prefill the task form with common agent instructions.</p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <button
                key={tpl.title}
                onClick={() => applyTemplate(tpl)}
                className="text-left border rounded-lg p-3 bg-white hover:border-slate-400 transition"
              >
                <div className="font-semibold">{tpl.title}</div>
                <div className="text-xs text-slate-600 mt-1">{tpl.action}</div>
                <div className="text-xs text-slate-500 mt-1">Interval: {tpl.interval}s</div>
              </button>
            ))}
          </CardContent>
        </Card>

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
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <p className="text-xs text-slate-600">Agent will call <code>runTask</code> when Next execution has passed. Hit Load to refresh.</p>
              {status && <p className="text-xs text-green-700">{status}</p>}
            </CardHeader>
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

        <Card>
          <CardHeader>
            <CardTitle>Agent Notifications</CardTitle>
            <p className="text-xs text-slate-600">Recent actions and updates. The off-chain agent logs to its console; this panel shows quick UI breadcrumbs.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.length === 0 && <div className="text-sm text-slate-500">No notifications yet.</div>}
            {notifications.map((n, idx) => (
              <div key={idx} className="text-sm border rounded p-2 bg-white">{n}</div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
