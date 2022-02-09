import { AfterViewInit, Component } from '@angular/core';

import { Terminal } from './lib/term';
import { AppleOne } from './Emulation/AppleOne';

import { AMAZING_BAS } from './Emulation/Examples/amazing_bas';



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

	constructor() {

		this.terminal = new Terminal({
			useFocus: true,
			useEvents: true,
			useMouse: false,
			//colors: Terminal.colors,
			convertEol: false,
			termName: 'xterm',
			geometry: [80, 24],
			cursorBlink: true,
			visualBell: false,
			popOnBell: false,
			scrollback: 1000,
			screenKeys: false,
			debug: false,
			useStyle: true
		});
		this.terminal.cursorHidden = false;
		this.terminal.cursorBlink = true;

		this.hardware = new AppleOne(this.terminal, false);


		this.terminal.addListener('data',
			(data: string) => {
				var s = data.split('');
				for (var i = 0; i < s.length; ++i) {
					this.hardware.addKeypressToBuffer(s[i]);
				}
			}
		);


		this.exampleBas = AMAZING_BAS;
	}
	
	ngAfterViewInit(): void {
		this.terminal.open(document.querySelectorAll('terminal')[0]);
		this.terminal.focus();
		this.terminal.startBlink();
		this.terminal.showCursor();
		
		this.hardware.run();
	}

	private focusTerminal(event: Event) {
		event.preventDefault();
		(event.target as HTMLInputElement).blur();
		this.terminal.focus(); // doesn't seem to get focus
	}
	
	// set up event handlers for the buttons
	onIntBASIC(event: Event) {
		this.hardware.startIntBASIC();
		this.focusTerminal(event);
	}

	onKRUSADER(event: Event) {
		this.hardware.startKRUSADER();
		this.focusTerminal(event);
	}

	onMSBASIC(event: Event) {
		this.hardware.startMSBASIC();
		this.focusTerminal(event);
	}

  onResetCpu(event: Event) {
		this.hardware.resetCpu();
		this.focusTerminal(event);
	}
	
	onNonMaskableInterrupt(event: Event) {
		this.hardware.nmiCpu();
		this.focusTerminal(event);
	}

  loadFromTextarea(event: Event, value: string) {
		value.split('').forEach((key: string) => this.hardware.addKeypressToBuffer(key));
		this.focusTerminal(event);
	}
	
}
