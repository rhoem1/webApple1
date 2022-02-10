import { AfterViewInit, Component, HostListener } from '@angular/core';

import { Terminal } from './lib/term';
import { AppleOne } from './Emulation/AppleOne';

import { AMAZING_BAS } from './Emulation/Examples/amazing_bas';
import { offscreenListenerFunc, offscreenWorkerApi } from './lib/offscreenListenerFunc';
import { 
	EW_addKeypressToBuffer,
	EW_loadFromFile,
	EW_nmiCpu,
	EW_resetCpu,
	EW_startEmulation,
	EW_startIntBASIC,
	EW_startKRUSADER,
	EW_startMSBASIC,
	EW_toggleWidth40,
	EW_stopEmulation
} from './Emulation/emulation.worker.commands';

/**
 * called by the browser to create a worker with an offscreen canvas
 * @param {offscreenListenerFunc} listener worker's onmessage
 * @returns {*} api
 */
 function createWorker(listener: offscreenListenerFunc): offscreenWorkerApi {

  let api = offscreenWorker(listener);
  
  if(!api) {
    const randomId = 'Offscreen' + Math.round(Math.random() * 1000);
    const altUrl = `src_app_Emulation_emulation_worker_ts.js`;

    // Not chrome. firefox
    const script = document.createElement('script');
    script.src = altUrl;
    script.async = true;
    script.dataset['id'] = randomId;
    const connection:{msgs: any[], host: Function, worker: null|Function} = { msgs: [], host: listener, worker: null };
    api = {
      post: (data: any) => {
        if(connection.worker) {
          connection.worker({ data });
        } else {
          connection.msgs.push(data);
        }
      },
			isWorker: false,
    }
    document.head.appendChild(script);
		// @ts-ignore
    window[randomId] = connection;
  }

  return api;
}

// chrome
function offscreenWorker(listener: offscreenListenerFunc): offscreenWorkerApi|null {
  let api = null;
  if(Worker) {
    const worker = new Worker(new URL('./Emulation/emulation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = listener;
    api = {
      post(a: any) { 
				return worker.postMessage(a);
			},
			isWorker: false,
    };
  }
  return api;
}

const CHECKED = '✔';
const UNCHECKED = ' ';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  title = 'webApple1';
  terminal: any;
	hardware: any;
	exampleBas: string;
	emulatorWorker: any;
	fps: any;
	checked: string = UNCHECKED;
  width40: boolean = true;

	constructor() {

		this.exampleBas = AMAZING_BAS;
		
		this.emulatorWorker = createWorker(({ data }) => {
			if(data.fps) {
				this.fps = data.fps;
				return;
			} 
      if(this.terminal)
			this.terminalWrite(data.v);
		});

		this.createTerminal();
		
	}
  
  private createTerminal() {
    const geometry = [
      this.width40 ? 40 : 80,
      25
    ]
    this.terminal = new Terminal({
      useFocus: true,
      useEvents: true,
      useMouse: false,
      convertEol: false,
      termName: 'xterm',
      geometry,
      cursorBlink: true,
      cursorHidden: false,
      visualBell: false,
      popOnBell: false,
      scrollback: 1000,
      screenKeys: false,
      debug: false,
      useStyle: true,
      fontFamily: 'Printchar21',
    });

    this.terminal.colors[256] = '#000000';
    this.terminal.colors[257] = '#00D000';


    //this.terminal.cursorHidden = false;
    this.terminal.cursorBlink = true;


    this.terminal.addListener('data',
      (data: string) => {
        var s = data.split('');
        for (var i = 0; i < s.length; ++i) {
          this.emulatorWorker.post({
            command: EW_addKeypressToBuffer,
            data: s[i],
          });
        }
      }
    );
  }

  private terminalWrite(value: string) {
    this.terminal.write(value);
  }
	
  private insertTerminalIntoView() {
    this.terminal.open(document.querySelectorAll('terminal')[0]);
    this.terminal.focus();
    this.terminal.startBlink();
    this.terminal.showCursor();
  }
  
  private removeTerminalFromView() {
    this.terminal.end();
    this.terminal = null;
  }

	ngAfterViewInit(): void {
		this.insertTerminalIntoView();
		
		this.startEmulation();
	}

  @HostListener('window:focus')
	startEmulation() {
		this.emulatorWorker.post({
			command: EW_startEmulation,
		})
	}
	
  @HostListener('window:blur')
	stopEmulation() {
		this.emulatorWorker.post({
			command: EW_stopEmulation,
		})
	}
	
	// set up event handlers for the buttons
	onIntBASIC(event: Event) {
		this.emulatorWorker.post({
			command: EW_startIntBASIC,
		});
		this.focusTerminal(event);
	}

	onKRUSADER(event: Event) {
		this.emulatorWorker.post({
			command: EW_startKRUSADER,
		});
		this.focusTerminal(event);
	}

	onMSBASIC(event: Event) {
		this.emulatorWorker.post({
		  command: EW_startMSBASIC,
		});
		this.focusTerminal(event);
	}

  onResetCpu(event: Event) {
		this.emulatorWorker.post({
			command: EW_resetCpu,
		})
		this.focusTerminal(event);
	}
	
	onNonMaskableInterrupt(event: Event) {
		this.emulatorWorker.post({
			command: EW_nmiCpu,
		})
		this.focusTerminal(event);
	}

  onLoadFromTextarea(event: Event, value: string) {
		this.emulatorWorker.post({
			command: EW_loadFromFile,
			file: value,
		})
		this.focusTerminal(event);
	}
	
	onToggleWidth40(event: Event) {
    this.width40 = !this.width40;
    
    this.removeTerminalFromView();

    this.createTerminal();

		this.insertTerminalIntoView();
   
		this.focusTerminal(event);
		if(this.width40) {
			this.checked = UNCHECKED;
		} else {
			this.checked = CHECKED;
		}
	}

	private focusTerminal(event: Event) {
		event.preventDefault();
		(event.target as HTMLInputElement).blur();
		this.terminal.focus(); // doesn't seem to get focus
	}
}
