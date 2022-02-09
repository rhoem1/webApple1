
export const
	SR_NEGATIVE_B = 0x80,
	SR_OVERFLOW_B = 0x40,
	SR_UNUSED_B = 0x20,
	SR_BREAK_B = 0x10,
	SR_DECIMAL_B = 0x08,
	SR_INTERRUPT_B = 0x04,
	SR_ZERO_B = 0x02,
	SR_CARRY_B = 0x01;

export default class Registers {
  PC: number;
  old_PC: number;
  A: number;
  X: number;
  Y: number;
  SP: number;
  SR_NEGATIVE: boolean;
  SR_OVERFLOW: boolean;
  SR_DECIMAL: boolean;
  SR_INTERRUPT: boolean;
  SR_ZERO: boolean;
  SR_CARRY: boolean;
	intb: boolean;
	stopped: boolean;
	waiting: boolean;
	cycles: number;

	constructor() {
		this.PC = 0; //unsigned short program counter 
		this.old_PC = 0; //unsigned short program counter
		this.A = 0; //int Accumulator
		this.X = 0; //int X index
		this.Y = 0; //int Y index
		this.SP = 0; //unsigned char  stack pointer

		this.SR_NEGATIVE = false; // bool
		this.SR_OVERFLOW = false; // bool
		this.SR_DECIMAL = false;  // bool
		this.SR_INTERRUPT = false;// bool
		this.SR_ZERO = false;     // bool
		this.SR_CARRY = false;    // bool
		this.intb = false;
		this.stopped = false;
		this.waiting = false;
		this.cycles = 0;
	}

	SRsetByte(b: number) {
		this.SR_NEGATIVE = !!(b & SR_NEGATIVE_B);
		this.SR_OVERFLOW = !!(b & SR_OVERFLOW_B);
		this.SR_DECIMAL = !!(b & SR_DECIMAL_B);
		this.SR_INTERRUPT = !!(b & SR_INTERRUPT_B);
		this.SR_ZERO = !!(b & SR_ZERO_B);
		this.SR_CARRY = !!(b & SR_CARRY_B);
	}

	SRgetByte(SR_BREAK: boolean) {
		return (
			(this.SR_NEGATIVE ? SR_NEGATIVE_B : 0) |
			(this.SR_OVERFLOW ? SR_OVERFLOW_B : 0) |
			SR_UNUSED_B |
			(SR_BREAK ? SR_BREAK_B : 0) |
			(this.SR_DECIMAL ? SR_DECIMAL_B : 0) |
			(this.SR_INTERRUPT ? SR_INTERRUPT_B : 0) |
			(this.SR_ZERO ? SR_ZERO_B : 0) |
			(this.SR_CARRY ? SR_CARRY_B : 0)
		);
	}

	SRsetNZ(v: number) { //unsigned char 
		this.SR_NEGATIVE = (v & SR_NEGATIVE_B) == SR_NEGATIVE_B;
		this.SR_ZERO = (v == 0x00);
	}

	SRborrow(alu: number) { //unsigned short 
		this.SR_CARRY = (alu & 0x100) == 0;
	}

	SRcarry(alu: number) { //unsigned short 
		this.SR_CARRY = (alu & 0x100) != 0;
	}

}
