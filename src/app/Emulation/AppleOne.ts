/**
 * Apple 1 Hardware emulation
 *
 *
 * @copyright Robert Hoem 2015
 * @website
 * @license 2-term BSD
 *
 */


import Cpu, { NMI_VECTOR, VECTOR_TABLE, VECTOR_TABLE_LENGTH } from './Cpu/Cpu';
import RomIntercept from './Cpu/RomIntercept';
import { miRNG } from './miRNG';
import { miPIA } from './PIA';
import miIntBASIC from './Rom/miIntBASIC';
import miWOZMON from './Rom/miWOZMON';
import miKRUSADER from './Rom/miKRUSADER';
import miMSBASIC from './Rom/miMSBASIC';
import { offscreenWorkerApi } from "../lib/offscreenListenerFunc";

const CYCLES_PER_SECOND = 16*1024*1024;


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
	startFrameTime: any;
	execution: number = -1;
	stopEmulationLoop: boolean = false;
	cyclesLeft: number = 0;
	workerApi: offscreenWorkerApi;
	avgFrameTime: { frameTime: number, cycles: number }[] = [];
	outdata: any[] = [];

	constructor(workerApi: offscreenWorkerApi) {
		this.workerApi = workerApi;
		this.cpu = new Cpu();
		// wire up pia intercepts
		this.pia = new miPIA(this.cpu, {
			post: (a) => {
				this.outdata.push(a.v);
				if (this.outdata.length > 80)
					this.sendOutdata();
			},
			isWorker: this.workerApi.isWorker,
		});
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

	private sendOutdata() {
		this.workerApi.post({ v: this.outdata.join('') });
		this.outdata = [];
	}

	addKeypressToBuffer(keyPress: string) {
		this.pia.addKeypressToBuffer(keyPress);
	}
	
	run() {
		if(this.startFrameTime === undefined) {
			this.stopEmulationLoop = false;
			this.getNextFrame();
		}
	}
	
	private getNextFrame() {
		this.execution = requestAnimationFrame((timestamp: number) => this.emulateFrame(timestamp));
	}

	stop() {
		cancelAnimationFrame(this.execution);
		this.stopEmulationLoop = true;
		this.startFrameTime = undefined;
		if(this.outdata.length)
			this.sendOutdata();
	}
	

	emulateFrame(timestamp: number) {
		if (!this.startFrameTime) this.startFrameTime = timestamp;
		const frameTime = (timestamp - this.startFrameTime) / 1000;
		this.startFrameTime = timestamp;
		// the main loop
		const cycles = frameTime * CYCLES_PER_SECOND;
		this.cyclesLeft += cycles;
		while(this.cyclesLeft > CYCLES_PER_SECOND)
			this.cyclesLeft -= CYCLES_PER_SECOND;
	  
    this.avgFrameTime.push({
			frameTime,
			cycles
		});
    if(this.avgFrameTime.length > 10) this.avgFrameTime.shift();
    const avgFT = this.avgFrameTime.reduce((prev, curr) => prev + curr.frameTime, 0) / this.avgFrameTime.length;
		const avgCYCLES = this.avgFrameTime.reduce((prev, curr) => prev + curr.cycles, 0) / this.avgFrameTime.length;
    const fps = 1.0 / avgFT;
    const info = [
      `fps=${fps.toFixed(2)}`,
      `time=${avgFT.toFixed(3)}`,
			`cycles=${avgCYCLES.toFixed(1)}`,
		].join("\n");
		this.workerApi.post({ fps: info });

		while (this.cyclesLeft > 0) {

			// run an op, get the cycles used
			const cycles = this.cpu.doOperation();

			//	console.log(cpu.dumper.cpuState());

			// pass the cycles used to things that need to know
			//this.updateCycles(cycles);
			this.cyclesLeft -= cycles;

		}
		if(this.outdata.length)
			this.sendOutdata();
		if(!this.stopEmulationLoop) 
			this.getNextFrame();
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




