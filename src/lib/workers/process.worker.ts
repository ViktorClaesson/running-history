import { handleRequest, type ProcessRequest } from './protocol';

// The worker's whole job: answer each request. All the logic is in protocol.ts, which is
// plain TypeScript and tested without a worker.
addEventListener('message', (event: MessageEvent<ProcessRequest>) => {
  const { response, transfer } = handleRequest(event.data);
  postMessage(response, { transfer });
});
