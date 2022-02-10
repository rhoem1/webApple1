import Cpu from './Cpu/Cpu';
import MemoryIntercept from './Cpu/MemoryIntercept';
import { offscreenWorkerApi } from '../lib/offscreenListenerFunc';

export const DESTRUCTIVE_BACKSPACE = String.fromCharCode(8) + " " + String.fromCharCode(8);
export const NEWLINE = "\r\n";
export class miPIA extends MemoryIntercept {
	/**
	 * the PIA is made up of 4 memory intercepts
	 *
	 * KB    (keyboard input)
	 * KBcr  (keyboard control, status)
	 * DSP   (display output)
	 * DSPcr (display control, status)
	 */
	regKB: number;
	regKBcr: number;
	regDISP: number;
	regDISPcr: number;
	counter: number;
	readREG: Function[];
	writeREG: Function[];
	cursorX: number;
	keyBuffer: string[];
	worker: offscreenWorkerApi;

	constructor(cpu: Cpu, worker: offscreenWorkerApi) {
		super(cpu);
		this.worker = worker;
		this.regKB = 0;
		this.regKBcr = 0;
		this.regDISP = 0;
		this.regDISPcr = 0;
		this.counter = 0;
		this.cursorX = 0;
		this.keyBuffer = [];
		this.readREG = [
			() => this.readKB(),
			() => this.readKBcr(),
			() => this.readDSP(),
			() => this.readDSPcr()
		];
		this.writeREG = [
			(v: number) => this.writeKB(v),
			(v: number) => this.writeKBcr(v),
			(v: number) => this.writeDSP(v),
			(v: number) => this.writeDSPcr(v)
		];
		cpu.addInterceptRange(0xD000, 0x1000, this);
	}

	/*
	 * this should check a buffer that collects
	 * keystrokes via the keydown events
	 */
	addKeypressToBuffer(input: string) {
    input.split('').forEach((key: string) => this.keyBuffer.unshift(key));
	}


	/**
	 * check for input in keyBuffer
	 * @return bool
	 */
	getKeyboardReady() {
		return this.keyBuffer.length > 0;
	}

	/**
	 * read from keyBuffer
	 */
	getKeyboardData(): number {
		const char: any = this.keyBuffer.pop();
		if (char)
			return char.toString().charCodeAt(0);
		return 0;
	}

	/**
	 * check for input, set PIA KB/KBcr status
	 * called between opcodes, when KBcr is accessed
	 * and when KB is accessed
	 */
	checkKeyboard(reading: boolean) {
		let c = 0;

		if (this.getKeyboardReady()) {
			// set KBcr to character available
			this.regKBcr = 0xA7;

			// this only works when we're reading
			if (reading) {
				c = this.getKeyboardData();


				// mapping
				switch (c) {
					case 0x0A: // linefeed = carriage return
						c = 0x0D;
						break;
					case 0x7F: // delete, backspace = underline
					case 0x08:
						c = 0x5F;
						break;
					default: // uppercase it
						c = String.fromCharCode(c).toUpperCase().charCodeAt(0);
						break;
				}

				c |= 0x80;

			}
		}
		if (c > 127) { // if we set bit 8, update KB
			this.regKB = c;
		}
	}

	/**
	 * output something to stdout from DSP
	 */
	outputDsp(value: number) {
		// this needs to talk to the terminal window

		// ignore any value that does not have bit 8 set
		if (value == 0x7F)
			return;

		value &= 0x7F;

		switch (value) {
			case 0x7F:
			case 0x08:
			case 0x5F:
				// Backspace, del, underline
				// apple 1 used underline for backspace
			  this.worker.post({ v: DESTRUCTIVE_BACKSPACE });
				break;

			case 0x0A:
				break;
			case 0x0D:
				// End of Line
				this.worker.post({ v: NEWLINE });
				break;
			default:
				// Character
				this.worker.post({ v: String.fromCharCode(value) });
				break;
		}
	}

	readKB() {

		this.checkKeyboard(true);

		// reset the control register
		this.regKBcr = 0;
		this.counter = 10;

		return this.regKB;
	}

	writeKB(value: number) {
		this.regKB = value;
	}

	readKBcr() {
		this.checkKeyboard(false);
		return this.regKBcr;
	}

	writeKBcr(value: number) {
		this.regKBcr = value;
	}

	readDSP(): number {
		return 0;
	}

	writeDSP(value: number) {
		this.outputDsp(value);
	}

	readDSPcr() {
		return this.regDISPcr;
	}
	writeDSPcr(value: number) {
		this.regDISPcr = value;
	}

	override read(address: number): number {
		return this.readREG[address % 4]();
	}

	override write(value: number, address: number) {
		this.writeREG[address % 4](value);
	}
}
