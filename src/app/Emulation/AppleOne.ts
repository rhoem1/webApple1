/**
 * Apple 1 Hardware emulation
 *
 *
 * @copyright Robert Hoem 2015
 * @website
 * @license 2-term BSD
 *
 */

import AnimationFrame from "../lib/AnimationFrame";

import Cpu, { NMI_VECTOR, VECTOR_TABLE, VECTOR_TABLE_LENGTH } from './Cpu/Cpu';
import RomIntercept from './Cpu/RomIntercept';
import { miRNG } from './miRNG';
import { miPIA } from './PIA';
import miIntBASIC from './Rom/miIntBASIC';
import miWOZMON from './Rom/miWOZMON';
import miKRUSADER from './Rom/miKRUSADER';
import miMSBASIC from './Rom/miMSBASIC';
import { Terminal } from "../lib/term";

const CYCLEMULTIPLIER = 4;

const aFrame = new AnimationFrame();

/**
 * Apple One Emulation
 */
export class AppleOne {
	cpu: Cpu;
	pia: miPIA;
	rng: any;
	cyclecounter: any;
	WOZMON: RomIntercept;
	KRUSADER: RomIntercept;
	IntBASIC: RomIntercept;
	MSBASIC:  RomIntercept;
	startTime: any;

	constructor(terminal: typeof Terminal, width40: boolean) {
		this.cpu = new Cpu();
		// wire up pia intercepts
		this.pia = new miPIA(this.cpu, terminal, width40);
		this.rng = new miRNG(this.cpu);

	// add ROMS
	// first comes the WOZ monitor
		this.WOZMON = miWOZMON(this.cpu);
		this.cpu.addInterceptRange(this.WOZMON.startAddress, this.WOZMON.length - 6, this.WOZMON);
		this.cpu.clearInterceptRange(VECTOR_TABLE, VECTOR_TABLE_LENGTH);
		this.cpu.copyIntoMemory(VECTOR_TABLE, VECTOR_TABLE_LENGTH, this.WOZMON.data.slice(-VECTOR_TABLE_LENGTH));

		this.KRUSADER = miKRUSADER(this.cpu);
		this.cpu.addInterceptRange(this.KRUSADER.startAddress, this.KRUSADER.length, this.KRUSADER);
		// set NMI to hop into Krusader's debugger
		this.cpu.writeMemory(NMI_VECTOR, 0x19);
		this.cpu.writeMemory(NMI_VECTOR + 1, 0xFE);

		// add integer basic
		this.IntBASIC = miIntBASIC(this.cpu);
		this.cpu.addInterceptRange(this.IntBASIC.startAddress, this.IntBASIC.length, this.IntBASIC);

		// prep MS basic
		this.MSBASIC = miMSBASIC(this.cpu);

		// reset and run WOZMON
		this.cpu.resetCpu();

	}

	addKeypressToBuffer(keyPress: string) {
		this.pia.addKeypressToBuffer(keyPress);
	}
	
	run() {
		aFrame.request((timestamp: number) => this.emulateFrame(timestamp));
	}
	

	emulateFrame(timestamp: number) {
		if (!this.startTime) this.startTime = timestamp;
		const progress = timestamp - this.startTime;
		this.startTime = timestamp;
		// the main loop
		var cyclesLeft = Math.floor(progress * 1000) * CYCLEMULTIPLIER;
		if (cyclesLeft < 20000000)
			while (cyclesLeft > 0) {

				// run an op, get the cycles used
				const cycles = this.cpu.doOperation();

				//	console.log(cpu.dumper.cpuState());

				// pass the cycles used to things that need to know
				//this.updateCycles(cycles);
				cyclesLeft -= cycles;

			}
		this.run();
	}
		


	set40columnLimit(width40: boolean) {
		this.pia.width40 = width40;
	}
	
	resetCpu() {
		this.cpu.resetCpu();
	}
	
	nmiCpu() {
		this.cpu.nonMaskableInterrupt();
	}
	
	startIntBASIC() {
		this.cpu.resetCpu();
		this.cpu.setPC(this.IntBASIC.startAddress);
	}
	
	startKRUSADER() {
		this.cpu.resetCpu();
		this.cpu.setPC(this.KRUSADER.startAddress);
	}
	
	startMSBASIC() {
		// mix in MSBasic
		this.cpu.resetCpu();
		this.MSBASIC.copyIntoMemory();
		this.cpu.setPC(this.MSBASIC.startAddress);
	}

}




