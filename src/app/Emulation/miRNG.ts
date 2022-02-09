import Cpu from './Cpu/Cpu';
import MemoryIntercept from './Cpu/MemoryIntercept';

/*
 * Random number generation
 */
export class miRNG extends MemoryIntercept {
	constructor(cpu: Cpu) {
		super(cpu);
		cpu.addIntercept(0xD01E, this);
	}

	override read(address: number) {
		return Math.floor(Math.random() * 0x100) & 0xFF;
	}

	override write(value: number, address: number) {
		// javascript won't let us set the seed
		//Math.srand(value);
	}
}
