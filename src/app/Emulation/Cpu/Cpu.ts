
import MemoryIntercept from './MemoryIntercept';
import { OPCODES, eADDRESSING, AddressingModeFunction } from './Opcodes';
import Registers from './Registers';

export const
	ZEROPAGE = 0x0000,
	STACK = 0x0100,
	VECTOR_TABLE_LENGTH = 8,
	VECTOR_TABLE = 0xFFF8,
	NMI_VECTOR = 0xFFFA,
	RESET_VECTOR = 0xFFFC,
	IRQBRK_VECTOR = 0xFFFE;


export default class Cpu {
	newMemoryIntercept(arg0: (address: any) => number, arg1: (value: any, address: any) => void) {
		throw new Error('Method not implemented.');
	}
  memory: Uint8Array;
  intercepts: any[];
  r: Registers;
  opcode: number;
  alu: number;
  old_alu: number;
  address: number;
  writeOK: boolean;
  paused: boolean;
  interruptSources: any;


	// important memory locations and
	// status constants
	constructor() {

		// my ram
		this.memory = new Uint8Array(0x10000); //unsigned char 

		// memory intercept
		// when we read or write, we need to tickle these
		// since their the interface to other emulated systems
		this.intercepts = [];
		for (var i = 0; i < 65536; ++i) {
			this.intercepts[i] = null;
		}

		// registers
		this.r = new Registers();

		// state variables

		this.opcode = 0; // unsigned char 

		// arithmatic logic unit
		this.alu = 0; // 	int
		this.old_alu = 0; // 	int

		// two bytes just after opcode as a 16 bit word
		this.address = 0x0000; // 	unsigned short

		// will we write?
		this.writeOK = false; // 	bool

		// used for debugging
		this.paused = false; // 	bool

		// are maskable interrupts active
		this.interruptSources = {};

	}


	/**
	 * add a memory intercept
	 * @arg unsigned short address
	 * @arg memoryIntercept i
	 */

	addIntercept(address: number, i: MemoryIntercept) {
		this.intercepts[address] = i;
	}

	/**
	 * add a memory intercept to a range of addresses
	 * @arg unsigned short start
	 * @arg unsigned short len
	 * @arg memoryIntercept i
	 */
	addInterceptRange(start: number, len: number, i: MemoryIntercept ) {
		for (let a = start; a < start + len; ++a) {
			if (a < 65536)
				this.intercepts[a] = i;
		}
	}
	clearInterceptRange(start: number, len: number) {
		for(let a = start; a < start + len; ++a) {
			if(a < 65536)
			  this.intercepts[a] = null;
		}
	}

	copyIntoMemory(start: number, len: number, data: Uint8Array | Array<number>) {
		for (let a = 0; a < len; ++a) {
			this.memory[start + a] = data[a];
		}
	}


	/**
	 * read a byte from an address through the intercepts
	 * @arg unsigned short address
	 * @returns unsigned char 
	 */
	readMemoryByte(address: number) {
		if (this.intercepts[address])
			this.memory[address] = this.intercepts[address].read(address, this);
		return this.memory[address];
	}

	/**
	 * read a word (2 bytes in LSB) from an address via readMemoryByte
	 * @arg unsigned short address
	 * @returns unsigned short 
	 */
	readMemoryWord(address: number) {
		return (this.readMemoryByte(address + 1) << 8) | this.readMemoryByte(address);
	}

	/**
	 * write a byte to an address through the intercepts
	 * @arg unsigned short address
	 * @arg int value
	 */
	writeMemory(address: number, value: number) {
		let written = false;
		value &= 0xFF;
		if (this.intercepts[address]) {
			written = this.intercepts[address].write(value, address, this);
		}
		if (!written)
			this.memory[address] = value;
	}

	/**
	 * reset the cpu
	 * sets A, X, Y and SR to 0, sets SP to 0xFD and PC to whever the reset vetor points to
	 * cause reset is actually a BRK with the stack pushes read only, therefor it starts
	 * SP at 0, then over the course of attemptying to fake-push PC and SR to the stack
	 * it decrements SP 3 times to 0xFD
	 */
	resetCpu() {
		this.r.SRsetByte(0);
		this.r.SR_INTERRUPT = true;
		this.r.SP = 0xFD;
		this.setPC(this.readMemoryWord(RESET_VECTOR));
		this.r.A = 0;
		this.r.X = 0;
		this.r.Y = 0;
	}

	/**
	 * Interrupt the pc, maskable
	 */
	maskableInterrupt(source: string) {
		this.interruptSources[source] = true;
		this.r.intb = true;
		this.r.waiting = false;
	}
	
	clearMaskableInterrupt(source: string) {
		if(this.interruptSources[source])
			delete this.interruptSources[source];
		if(Object.keys(this.interruptSources).length)
		  return;
		this.r.intb = false;
	}

	/**
	 * non maskable interrupt
	 */
	nonMaskableInterrupt() {
		this.pushCpuInterrupt(this.r.PC, false);
		this.setPC(this.readMemoryWord(NMI_VECTOR));
		this.r.waiting = false;
		this.r.cycles += 8;
	}


	pushCpuInterrupt(pc: number, fromInt: boolean) {
		this.pushStack((pc & 0xFF00) >> 8);
		this.pushStack(pc & 0xFF);
		// probably should have a flag to SRgetByte
		// that tells it we're getting the status to be
		// pushed on the stack
		this.pushStack(this.r.SRgetByte(fromInt));
	}

	/**
	 * push a byte to the stack
	 * @arg unsigned char b
	 */
	pushStack(b: number) {
		this.writeMemory(STACK + this.r.SP, b);
		this.r.SP--;
		if (this.r.SP < 0)
			this.r.SP = 255;
	}

	/**
	 * pop a byte from the stack
	 * @returns unsigned char
	 */
	popStack() {
		this.r.SP++;
		if (this.r.SP > 255)
			this.r.SP = 0;
		return this.readMemoryByte(0x100 + this.r.SP);
	}

	setPC(address: number) {
		this.r.PC = address & 0xFFFF;
	}


	/**
	 * do next operation
	 * @return unsigned char number of cycles operation took
	 */
	doOperation() {
		if (this.r.stopped)
			return 0;

		if (!this.r.waiting) {

			// save program counter
			this.r.old_PC = this.r.PC;

			// get opcode at PC
			this.opcode = this.readMemoryByte(this.r.PC);

			// point to first data byte
			this.r.PC += 1;

			// starting point for cycle count for this opcode. might increase
			this.r.cycles += OPCODES[this.opcode].cycles;
			// reset ALU to 0
			this.alu = 0;
			this.address = 0;

			// write mode
			this.writeOK = OPCODES[this.opcode].rw;

			this.r.cycles += OPCODES[this.opcode].fetch(this);

			// save alu
			this.old_alu = this.alu;

			// move PC now
			this.r.PC += OPCODES[this.opcode].step;

			// opcode contemplation
			this.r.cycles += OPCODES[this.opcode].op(this);

			// store alu using addressing mode
			if (this.writeOK) {
				switch (OPCODES[this.opcode].mode) {
					default:
						break;

					case eADDRESSING.ADR_ACC:
						// pushed into A
						this.r.A = this.alu & 0xFF;
						break;

					// write to somewhere in memory
					case eADDRESSING.ADR_ABS:
					case eADDRESSING.ADR_ABX:
					case eADDRESSING.ADR_ABY:
					case eADDRESSING.ADR_AIX:
					case eADDRESSING.ADR_ZPG:
					case eADDRESSING.ADR_ZPX:
					case eADDRESSING.ADR_ZPY:
					case eADDRESSING.ADR_ZPI:
					case eADDRESSING.ADR_INX:
					case eADDRESSING.ADR_INY:
						this.writeMemory(this.address, this.alu & 0xFF);
						break;

				}
			}

			if (this.r.SR_INTERRUPT === false && this.r.intb === true) {
				this.pushCpuInterrupt(this.r.PC, false);
				this.setPC(this.readMemoryWord(IRQBRK_VECTOR));
				this.r.SR_DECIMAL = false;
				this.r.SR_INTERRUPT = true;
				this.r.cycles += 8;
			}

		}
    // all done
    const cycles = this.r.cycles;
    this.r.cycles = 0;
    return cycles;

	}
}





