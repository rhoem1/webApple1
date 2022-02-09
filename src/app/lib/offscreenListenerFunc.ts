export type offscreenListenerFunc = (ev: MessageEvent<any>) => any;
export type offscreenWorkerApi = { 
  post: (a: any) => void; 
  isWorker: boolean;
};
