import { createServer, createConnection, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEffect, useState, useRef } from 'react';
import type { BoardProps } from '@/features/board/Board';

export const getIpcPath = (sessionId: string) => {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\chess-tui-${sessionId}`;
  }
  return join(tmpdir(), `chess-tui-${sessionId}.sock`);
};

export const useBoardIpcServer = (sessionId: string, props: BoardProps) => {
  const clientsRef = useRef<Set<Socket>>(new Set());

  useEffect(() => {
    const path = getIpcPath(sessionId);
    const server = createServer((socket) => {
      clientsRef.current.add(socket);
      
      // Send initial state upon connection
      socket.write(JSON.stringify(props) + '\n');

      socket.on('end', () => {
        clientsRef.current.delete(socket);
      });
      socket.on('error', () => {
        clientsRef.current.delete(socket);
      });
    });

    server.listen(path, () => {
      // ready
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        // cleanup old socket
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const fs = require('node:fs');
          fs.unlinkSync(path);
          server.listen(path);
        } catch {}
      }
    });

    return () => {
      server.close();
      for (const socket of clientsRef.current) {
        socket.destroy();
      }
      clientsRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Server stays alive for the session id

  useEffect(() => {
    // Broadcast state on change
    const payload = JSON.stringify(props) + '\n';
    for (const socket of clientsRef.current) {
      if (!socket.destroyed) {
        socket.write(payload);
      }
    }
  }, [props]);
};

export const useBoardIpcClient = (sessionId: string): BoardProps | null => {
  const [props, setProps] = useState<BoardProps | null>(null);

  useEffect(() => {
    const path = getIpcPath(sessionId);
    const socket = createConnection(path);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line) as BoardProps;
            setProps(parsed);
          } catch (e) {
            // parse error
          }
        }
      }
    });

    socket.on('error', () => {
      // ignore
    });

    return () => {
      socket.destroy();
    };
  }, [sessionId]);

  return props;
};