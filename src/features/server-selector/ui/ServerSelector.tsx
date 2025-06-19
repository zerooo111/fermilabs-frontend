/**
 * Server selector component
 * Allows users to select a server from a dropdown
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { useSelectedServer } from '../../../entities/server';
import { cn } from '@/lib/utils';
import { Server } from '@/types';

interface ServerWithHealth extends Server {
  status: 'healthy' | 'unhealthy' | 'checking';
}

async function checkServerLatency(
  server: Server,
  logError = true
): Promise<{ latency: number; isHealthy: boolean }> {
  const startTime = performance.now();
  try {
    await axios.get(`${server.url}/health`, { timeout: 5000 });
    return { latency: performance.now() - startTime, isHealthy: true };
  } catch (error) {
    if (logError) {
      console.error(`Error checking latency for ${server.label}:`, error);
    }
    return { latency: Infinity, isHealthy: false };
  }
}

function ServerStatus({ server }: { server: ServerWithHealth }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full border border-black/50',
          server.status === 'healthy' && 'bg-emerald-500 ',
          server.status === 'unhealthy' && 'bg-red-500',
          server.status === 'checking' && 'bg-yellow-500 animate-pulse'
        )}
      />
      <span>{server.label}</span>
      {server.latency !== null && server.status !== 'unhealthy' && (
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.round(server.latency)}ms
        </span>
      )}
      {server.status === 'unhealthy' && (
        <span className="ml-auto text-xs text-red-500">Offline</span>
      )}
    </div>
  );
}

export function ServerSelector() {
  const { selectedServer, setSelectedServer, servers } = useSelectedServer();
  const [serversWithLatency, setServersWithLatency] = useState<ServerWithHealth[]>(
    servers.map(server => ({ ...server, status: 'checking' }))
  );

  useEffect(() => {
    // Initialize checking status for all servers
    setServersWithLatency(current => current.map(server => ({ ...server, status: 'checking' })));

    const checkServers = async () => {
      // Check all servers in parallel
      const results = await Promise.all(
        servers.map(async (server, index) => {
          // Only log error for first server to avoid console spam
          const { latency, isHealthy } = await checkServerLatency(server, index === 0);
          return {
            server,
            latency: latency === Infinity ? null : latency,
            status: isHealthy ? ('healthy' as const) : ('unhealthy' as const),
          };
        })
      );

      // Update state with all results at once
      setServersWithLatency(current => {
        const updatedServers = current.map(s => {
          const result = results.find(r => r.server.url === s.url);
          if (result) {
            return {
              ...result.server,
              latency: result.latency,
              status: result.status,
            };
          }
          return s;
        });

        // Sort servers: healthy (by latency) first, then checking, then unhealthy
        return updatedServers.sort((a, b) => {
          if (a.status === 'unhealthy' && b.status !== 'unhealthy') return 1;
          if (b.status === 'unhealthy' && a.status !== 'unhealthy') return -1;
          if (a.latency === null) return 1;
          if (b.latency === null) return -1;
          return a.latency - b.latency;
        });
      });
    };

    // Initial check
    checkServers();

    // Set up interval to recheck all servers
    const interval = setInterval(checkServers, 30000);

    // Clean up interval
    return () => clearInterval(interval);
  }, [servers]);

  const selectedServerWithHealth = serversWithLatency.find(s => s.url === selectedServer.url);

  return (
    <Select
      value={selectedServer.url}
      onValueChange={value => {
        const server = serversWithLatency.find(s => s.url === value);
        if (server) {
          setSelectedServer(server);
        }
      }}
      f
    >
      <SelectTrigger className="w-[250px] glass-panel">
        <SelectValue>
          {selectedServerWithHealth && <ServerStatus server={selectedServerWithHealth} />}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {serversWithLatency.map(server => (
          <SelectItem
            key={server.url}
            value={server.url}
            className="flex items-center justify-between"
          >
            <ServerStatus server={server} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
