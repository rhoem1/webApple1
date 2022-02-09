/// </reference lib="webworker" />

import { offscreenListenerFunc, offscreenWorkerApi } from '../lib/offscreenListenerFunc';
import { AppleOne } from './AppleOne';

function insideOffscreenWorker(listener: offscreenListenerFunc): offscreenWorkerApi {
  // if we ended up in a Worker context
  // @ts-ignore
  if (typeof (window as any) !== 'object') {
    onmessage = listener;
    return {
      post: (a) => postMessage(a),
      isWorker: true,
    };
  }

  // look for the random id
  // @ts-ignore
  const randomId = document.currentScript.dataset['id'];
  if (randomId) {
    // @ts-ignore
    const connection = window[randomId];
    // @ts-ignore
    delete window[randomId];
    connection.worker = listener;
    setTimeout(() => {
      connection.msgs.forEach((data: any) => connection.worker({ data }));
    }, 1);
    return {
      post: (data) => connection.host({ data }),
      isWorker: false,
    };
  }
  throw new Error('Failed to find a connection to the host');
}

class EmulationWorker {
  toManager: offscreenWorkerApi;
  hardware: AppleOne;
  constructor() {
    this.toManager = insideOffscreenWorker(({ data }) => {
      // @ts-ignore
      this[data.command](data);
    });

    this.hardware = new AppleOne(this.toManager);

  }

  loadFromFile({ file }: { file: string }) {
    file.split('').forEach((key: string) => this.hardware.addKeypressToBuffer(key));
  }

  addKeypressToBuffer({ data }: { data: string }) {
    this.hardware.addKeypressToBuffer(data)
  }

  startEmulation() {
    this.hardware.run();
  }

  stopEmulation() {
    this.hardware.stop();
  }

  resetCpu() {
    this.hardware.resetCpu();
  }

  nmiCpu() {
    this.hardware.nmiCpu();
  }

  startIntBASIC() {
    this.hardware.startIntBASIC();
  }

  startKRUSADER() {
    this.hardware.startKRUSADER();
  }

  startMSBASIC() {
    this.hardware.startMSBASIC();
  }
  
  toggleWidth40() {
    this.hardware.pia.width40 = !this.hardware.pia.width40;
  }

}

const worker = new EmulationWorker();

