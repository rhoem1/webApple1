
import Cpu, { IRQBRK_VECTOR } from "./Cpu";
import { SR_NEGATIVE_B, SR_OVERFLOW_B } from "./Registers";

	// addressing modes
	//enum eADDRESSING
export enum eADDRESSING {
  ADR_NON = 0,
  ADR_IMP,
  ADR_IMM,
  ADR_ABS,
  ADR_ABX,
  ADR_ABY,
  ADR_IND,
  ADR_AIX,
  ADR_INX,
  ADR_INY,
  ADR_ZPG,
  ADR_ZPX,
  ADR_ZPY,
  ADR_ZPI,
  ADR_ACC,
  ADR_REL
};

export interface AddressingModeFunction extends Function {
  mode: eADDRESSING;
}


// opcode attributes
class Opcode {
  op: Function;
  fetch: Function;
  step: number;
  cycles: number;
  rw: boolean;
  mode: eADDRESSING;
	constructor(op: Function, fetch: AddressingModeFunction, step: number, cycles: number, rw: number) {
		this.op = op;
		this.fetch = fetch;
    this.mode = fetch.mode;
		this.step = step;
		this.cycles = cycles;
		this.rw = !!rw;
	}
}

export const OPCODES: Opcode[] = [];

const A_NON:AddressingModeFunction = (cpu: Cpu) => {
	return 0;
}
A_NON.mode = eADDRESSING.ADR_NON;

const A_IMP:AddressingModeFunction = (cpu: Cpu) => {
	cpu.address = 0;
	return 0;
}
A_IMP.mode = eADDRESSING.ADR_IMP;

const A_ACC:AddressingModeFunction = (cpu: Cpu) => {
	cpu.address = 0;
	if(!OPCODES[cpu.opcode].rw)
		cpu.alu = cpu.r.A;
	return 0;
}
A_ACC.mode = eADDRESSING.ADR_ACC;

const A_IMM:AddressingModeFunction = (cpu: Cpu) => {
	cpu.address = 0;
	if(!OPCODES[cpu.opcode].rw)
		cpu.alu = cpu.readMemoryByte(cpu.r.PC);
	return 0;
}
A_IMM.mode = eADDRESSING.ADR_IMM;

const A_ABS:AddressingModeFunction = (cpu: Cpu) => {
	cpu.address = cpu.readMemoryWord(cpu.r.PC);
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_ABS.mode = eADDRESSING.ADR_ABS;

const A_ABX:AddressingModeFunction = (cpu: Cpu) => {
	// look for page crossings
	cpu.address = cpu.readMemoryWord(cpu.r.PC);
	let page = cpu.address & 0xFF00;
	// apparently we need to read the address before
	// adding X
	cpu.readMemoryWord(cpu.address);
	cpu.address += cpu.r.X;
	cpu.address &= 0xFFFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	if ((cpu.address & 0xFF00) > page)
		return 1
	return 0;
}
A_ABX.mode = eADDRESSING.ADR_ABX;

const A_ABY:AddressingModeFunction = (cpu: Cpu) => {
	// look for page crossings
	cpu.address = cpu.readMemoryWord(cpu.r.PC);
	let page = cpu.address & 0xFF00;
	// apparently we need to read the address before
	// adding X
	cpu.readMemoryWord(cpu.address);
	cpu.address += cpu.r.Y;
	cpu.address &= 0xFFFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	if ((cpu.address & 0xFF00) > page)
		return 1
	return 0;
}
A_ABY.mode = eADDRESSING.ADR_ABY;

const A_AIX:AddressingModeFunction = (cpu: Cpu) => {
	let o1 = cpu.readMemoryByte(cpu.r.PC);
	let o2 = cpu.readMemoryByte(cpu.r.PC + 1) << 8;

	o1 += cpu.r.X; // add X to the address specified

	cpu.address = cpu.readMemoryByte(o2 + o1);
	o1++;
	cpu.address += cpu.readMemoryByte(o2 + o1) << 8;
	cpu.address &= 0xFFFF;
	return 0;
}
A_AIX.mode = eADDRESSING.ADR_AIX;

// used by jmp, so doesn't set alu, since absolute mode for jmp is address
const A_IND:AddressingModeFunction = (cpu: Cpu) => {
	// nmos bug
	// if indirect addressing points to last byte in page
	// then next byte for address is first byte in same page
	// and not first byte from next page
	let o1 = cpu.readMemoryByte(cpu.r.PC);
	let o2 = cpu.readMemoryByte(cpu.r.PC + 1) << 8;
	cpu.address = cpu.readMemoryByte(o2 + o1);
	//o1 = (o1 + 1) & 0xFF;
	//
	//the c doesn't have this bug
	o1++;
	cpu.address += cpu.readMemoryByte(o2 + o1) << 8;
	cpu.address &= 0xFFFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_IND.mode = eADDRESSING.ADR_IND;

const A_INX:AddressingModeFunction = (cpu: Cpu) => {
	let zpage = cpu.readMemoryByte(cpu.r.PC);
	// address to look up is ZP + X without carry
	let o1 = (zpage + cpu.r.X) & 0xFF; // is cpu right?
	cpu.address = cpu.readMemoryByte(o1);
	cpu.address += (cpu.readMemoryByte((o1 + 1) & 0xFF)) << 8;
	cpu.address &= 0xFFFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_INX.mode = eADDRESSING.ADR_INX;

const A_INY:AddressingModeFunction = (cpu: Cpu) => {
	let zpage = cpu.readMemoryByte(cpu.r.PC);
	// IAH wraps if zpage = 0xFF
	let o1 = cpu.readMemoryByte(zpage) + cpu.r.Y;
	let o2 = cpu.readMemoryByte((zpage + 1) & 0xFF) << 8;
	// now add Y, look for page boundries
	cpu.address = (o2 + o1) & 0xFFFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	if (o1 > 0x0100)
		return 1;
	return 0;
}
A_INY.mode = eADDRESSING.ADR_INY;

const A_ZPG:AddressingModeFunction = (cpu: Cpu) => {
	let zpage = cpu.readMemoryByte(cpu.r.PC);
	cpu.address = zpage;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_ZPG.mode = eADDRESSING.ADR_ZPG;

	// address is zpage + X without carry
const A_ZPX:AddressingModeFunction = (cpu: Cpu) => {
	let zpage = cpu.readMemoryByte(cpu.r.PC);
	cpu.address = (zpage + cpu.r.X) & 0xFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_ZPX.mode = eADDRESSING.ADR_ZPX;

	// address is zpage + Y without carry
const A_ZPY:AddressingModeFunction = (cpu: Cpu) => {
	let zpage = cpu.readMemoryByte(cpu.r.PC);
	cpu.address =  (zpage + cpu.r.Y) & 0xFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_ZPY.mode = eADDRESSING.ADR_ZPY;

const A_ZPI:AddressingModeFunction = (cpu: Cpu) => {
	let zpage = cpu.readMemoryByte(cpu.r.PC);
	let o1 = cpu.readMemoryByte(zpage);
	let o2 = cpu.readMemoryByte(zpage + 1) << 8;
	cpu.address = (o1 + o2) & 0xFFFF;
	if(!OPCODES[cpu.opcode].rw)
	  cpu.alu = cpu.readMemoryByte(cpu.address);
	return 0;
}
A_ZPI.mode = eADDRESSING.ADR_ZPI;

const A_REL:AddressingModeFunction = (cpu: Cpu) => {
	cpu.address = cpu.r.PC;
	let page = cpu.address >> 8;
	cpu.alu = cpu.readMemoryByte(cpu.r.PC);
	//zpage = alu;
	if (cpu.alu >= 0x80) {
		// 2's compliment
		cpu.alu = -(256 - cpu.alu);
	}
	cpu.address += (OPCODES[cpu.opcode].step + cpu.alu) & 0xFFFF;
	// reusing alu as the cycle bump if we branch
	cpu.alu = 1;
	if (cpu.address >> 8 != page)
		cpu.alu = 2;
	return 0;
}
A_REL.mode = eADDRESSING.ADR_REL;


// illegal opcodes are skipped, even the dangerous ones
const OP_BAD = (cpu: Cpu) => {
	return 0;
}

const OP_NOP = (cpu: Cpu) => {  // no operation
	return 0;
}

// add and subtract
const OP_ADC = (cpu: Cpu) => {  // add with carry
	let o1 = cpu.r.A;
	let o2 = cpu.alu;
	if (cpu.r.SR_DECIMAL) {
		// decimal mode behavior following Marko Makela's explanations
		cpu.r.SR_ZERO = ((o1 + o2 + (cpu.r.SR_CARRY ? 1 : 0)) & 0xFF) == 0;

		// add low nybs of A and alu with carry
		cpu.alu = (o1 & 0x0F) + (o2 & 0x0F) + (cpu.r.SR_CARRY ? 1 : 0);

		// if alu > 10 then alu += 6
		cpu.r.A = cpu.alu < 0x0A ? cpu.alu : cpu.alu + 6;

		// add high nybs of A, input alu and overflow from low nyb
		cpu.alu = (o1 & 0xF0) + (o2 & 0xF0) + (cpu.r.A & 0xF0);

		cpu.r.SR_NEGATIVE = (cpu.alu & 0xFF) < 0;

		cpu.r.SR_OVERFLOW = ((o1 & 0x80) == (o2 & 0x80)) && ((o1 & 0x80) != (cpu.alu & 0x80));

		// redo alu for output, merge low nyb from r.A
		// and high nyb from alu, overflow if alu > 160 (100)
		cpu.alu = (cpu.r.A & 0x0F) | (cpu.alu < 0xA0 ? cpu.alu : cpu.alu + 0x60);

		cpu.r.SRcarry(cpu.alu);

		cpu.r.A = cpu.alu & 0xFF;

	} else {
		// A + M + C -> A
		cpu.alu = o1 + o2 + (cpu.r.SR_CARRY ? 1 : 0);

		// clear flags
		// set them
		cpu.r.SRcarry(cpu.alu);

		// the test wants cpu?
		cpu.r.SR_OVERFLOW = ((o1 & 0x80) == (o2 & 0x80)) && ((o1 & 0x80) != (cpu.alu & 0x80));


		// update A
		cpu.r.A = cpu.alu & 0xFF;

		cpu.r.SRsetNZ(cpu.r.A);

	}
	return 0;
}

const OP_SBC = (cpu: Cpu) => {  // subtract with carry
	let o1 = cpu.r.A;
	let o2 = cpu.alu;
	if (cpu.r.SR_DECIMAL) {

		// decimal mode behavior following Marko Makela's explanations
		cpu.alu = (o1 & 0x0F) - (o2 & 0x0F) - (cpu.r.SR_CARRY ? 0 : 1);
		cpu.r.A = (cpu.alu & 0x10) == 0 ? cpu.alu : cpu.alu - 6;
		cpu.alu = (o1 & 0xF0) - (o2 & 0xF0) - (cpu.r.A & 0x10);
		cpu.r.A = (cpu.r.A & 0x0F) | ((cpu.alu & 0x100) == 0 ? cpu.alu : cpu.alu - 0x60);
		cpu.alu = o1 - o2 - (cpu.r.SR_CARRY ? 0 : 1);

		cpu.r.SRsetNZ(cpu.r.A);
		cpu.r.SRborrow(cpu.alu);

	} else {
		// A + M + C -> A
		cpu.alu = o1 - o2 - (cpu.r.SR_CARRY ? 0 : 1);

		// store A
		cpu.r.A = cpu.alu & 0xFF;

		// set carry, set others
		// oddly, cpu is what's needed here, even tho it's different than ADC's overflow
		cpu.r.SR_OVERFLOW = ((o1 ^ o2) & (o1 ^ cpu.r.A) & 0x80) != 0;
		cpu.r.SRsetNZ(cpu.r.A);
		cpu.r.SRborrow(cpu.alu);

	}
	return 0;
}


// compare memory with...
const OP_CMP = (cpu: Cpu) => {  // compare with A
	cpu.alu = (cpu.r.A - cpu.alu);
	cpu.r.SRborrow(cpu.alu);
	cpu.r.SRsetNZ(cpu.alu);
	return 0;
}

const OP_CPX = (cpu: Cpu) => {  // compare with X
	cpu.alu = (cpu.r.X - cpu.alu);
	cpu.r.SRborrow(cpu.alu);
	cpu.r.SRsetNZ(cpu.alu);
	return 0;
}

const OP_CPY = (cpu: Cpu) => {  // compare with Y
	cpu.alu = (cpu.r.Y - cpu.alu);
	cpu.r.SRborrow(cpu.alu);
	cpu.r.SRsetNZ(cpu.alu);
	return 0;
}

// logical operators
const OP_AND = (cpu: Cpu) => {  // and (with accumulator)
	// apply cpu.alu to A
	cpu.r.A &= cpu.alu;
	cpu.r.SRsetNZ(cpu.r.A);
	return 0;
}
const OP_ORA = (cpu: Cpu) => {  // or with accumulator
	// apply cpu.alu to A
	cpu.r.A |= cpu.alu;
	cpu.r.SRsetNZ(cpu.r.A);
	return 0;
}
const OP_EOR = (cpu: Cpu) => {  // exclusive or (with accumulator)
	// apply cpu.alu to A
	cpu.r.A ^= cpu.alu;
	cpu.r.SRsetNZ(cpu.r.A);
	return 0;
}


const OP_ASL = (cpu: Cpu) => {  // arithmetic shift left
	// catch carry
	cpu.r.SR_CARRY = (cpu.alu & 0x80) != 0;
	// a jump, to the left!
	cpu.alu <<= 1;
	cpu.r.SRsetNZ(cpu.alu);
	cpu.writeOK = true;
	return 0;
}
const OP_LSR = (cpu: Cpu) => {  // logical shift right
	cpu.r.SR_CARRY = (cpu.alu & 0x01) != 0;
	// and a step, to the right!
	cpu.alu >>= 1;
	// set flags
	cpu.r.SRsetNZ(cpu.alu);
	cpu.writeOK = true;
	return 0;
}
const OP_ROL = (cpu: Cpu) => {  // rotate left
	// rotate left and mix in carry
	let o1 = cpu.alu & 0x80;
	cpu.alu <<= 1;
	if (cpu.r.SR_CARRY)
		cpu.alu |= 0x01;
	cpu.r.SR_CARRY = o1 != 0;
	// set flags
	cpu.r.SRsetNZ(cpu.alu);
	cpu.writeOK = true;
	return 0;
}
const OP_ROR = (cpu: Cpu) => {  // rotate right
	let o1 = cpu.alu & 0x01;
	cpu.alu >>= 1;
	if (cpu.r.SR_CARRY)
		cpu.alu |= 0x80;
	// set flags
	cpu.r.SR_CARRY = o1 == 0x01;
	cpu.r.SRsetNZ(cpu.alu);
	cpu.writeOK = true;
	return 0;
}


// Increment, decrement A, X, Y
const OP_INC = (cpu: Cpu) => {  // increment
	cpu.alu = (cpu.alu + 1) & 0xFF;
	cpu.r.SRsetNZ(cpu.alu);
	cpu.writeOK = true;
	return 0;
}

const OP_DEC = (cpu: Cpu) => {  // decrement
	cpu.alu = (cpu.alu - 1) & 0xFF;
	cpu.r.SRsetNZ(cpu.alu);
	cpu.writeOK = true;
	return 0;
}

const OP_INX = (cpu: Cpu) => {  // increment X
	cpu.r.X = (cpu.r.X + 1) & 0xFF;
	cpu.r.SRsetNZ(cpu.r.X);
	return 0;
}

const OP_INY = (cpu: Cpu) => {  // increment Y
	cpu.r.Y = (cpu.r.Y + 1) & 0xFF;
	cpu.r.SRsetNZ(cpu.r.Y);
	return 0;
}

const OP_DEX = (cpu: Cpu) => {  // decrement X
	cpu.r.X = (cpu.r.X - 1) & 0xFF;
	cpu.r.SRsetNZ(cpu.r.X);
	return 0;
}
const OP_DEY = (cpu: Cpu) => {  // decrement Y
	cpu.r.Y = (cpu.r.Y - 1) & 0xFF;
	cpu.r.SRsetNZ(cpu.r.Y);
	return 0;
}

const OP_BIT = (cpu: Cpu) => {  // bit test
	// does a non-destructive AND vs A and memory
	// sets Z if there's no matches
	// sets N to bit 7
	// sets V to bit 6
	cpu.r.SR_OVERFLOW = !!(cpu.alu & SR_OVERFLOW_B); // bit 6
	cpu.r.SR_NEGATIVE = !!(cpu.alu & SR_NEGATIVE_B); // bit 7
	cpu.r.SR_ZERO = (cpu.alu & cpu.r.A) === 0;
	return 0;
}


// flag clear and set
const OP_CLC = (cpu: Cpu) => {  // clear carry
	cpu.r.SR_CARRY = false;
	return 0;
}
const OP_SEC = (cpu: Cpu) => {  // set carry
	cpu.r.SR_CARRY = true;
	return 0;
}
const OP_CLD = (cpu: Cpu) => {  // clear decimal
	cpu.r.SR_DECIMAL = false;
	return 0;
}
const OP_SED = (cpu: Cpu) => {  // set decimal
	cpu.r.SR_DECIMAL = true;
	return 0;
}
const OP_CLI = (cpu: Cpu) => {  // clear interrupt disable
	cpu.r.SR_INTERRUPT = false;
	return 0;
}
const OP_SEI = (cpu: Cpu) => {  // set interrupt disable
	cpu.r.SR_INTERRUPT = true;
	return 0;
}
const OP_CLV = (cpu: Cpu) => {  // clear overflow
	cpu.r.SR_OVERFLOW = false;
	return 0;
}


// branching
// cpu.alu holds bonus cycle count if page is crossed
const OP_BCS = (cpu: Cpu) => {  // branch on carry set
	if (cpu.r.SR_CARRY) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BCC = (cpu: Cpu) => {  // branch on carry clear
	if (!(cpu.r.SR_CARRY)) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BEQ = (cpu: Cpu) => {  // branch on equal (zero set)
	if (cpu.r.SR_ZERO) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BNE = (cpu: Cpu) => {  // branch on not equal (zero clear)
	if (!(cpu.r.SR_ZERO)) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BMI = (cpu: Cpu) => {  // branch on minus (negative set)
	if (cpu.r.SR_NEGATIVE) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BPL = (cpu: Cpu) => {  // branch on plus (negative clear)
	if (!(cpu.r.SR_NEGATIVE)) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BVS = (cpu: Cpu) => {  // branch on overflow set
	if (cpu.r.SR_OVERFLOW) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BVC = (cpu: Cpu) => {  // branch on overflow clear
	if (!(cpu.r.SR_OVERFLOW)) {
		cpu.setPC(cpu.address);
		return cpu.alu;
	}
	return 0;
}
const OP_BRA = (cpu: Cpu) => {
	cpu.setPC(cpu.address);
	return cpu.alu;
}



const OP_JMP = (cpu: Cpu) => {  // jump
	cpu.setPC(cpu.address);
	return 0;
}

const OP_JSR = (cpu: Cpu) => {  // jump subroutine
	// push PC onto stack
	cpu.alu = cpu.r.PC - 1;
	cpu.pushStack((cpu.alu & 0xFF00) >> 8);
	cpu.pushStack(cpu.alu & 0xFF);
	// update to new address in cpu.alu
	cpu.setPC(cpu.address);
	return 0;
}
const OP_RTS = (cpu: Cpu) => {  // return from subroutine
	// address should be -1 from next opcode
	cpu.alu = cpu.popStack() | (cpu.popStack() << 8);
	cpu.alu++;
	cpu.alu &= 0xFFFF;
	cpu.address = cpu.alu;
	cpu.setPC(cpu.address);
	return 0;
}

const OP_BRK = (cpu: Cpu) => {  // interrupt
	cpu.pushCpuInterrupt(cpu.r.PC, true);
	cpu.setPC(cpu.readMemoryWord(IRQBRK_VECTOR));
	return 0;
}

const OP_RTI = (cpu: Cpu) => {  // return from interrupt
	cpu.r.SRsetByte(cpu.popStack());
	cpu.alu = cpu.popStack() | (cpu.popStack() << 8);
	cpu.alu &= 0xFFFF;
	cpu.address = cpu.alu;
	cpu.setPC(cpu.address);
	return 0;
}

const OP_LDA = (cpu: Cpu) => {  // load accumulator
	cpu.r.SRsetNZ(cpu.alu);
	cpu.r.A = cpu.alu & 0xFF;
	return 0;
}

const OP_LDX = (cpu: Cpu) => {  // load X
	cpu.r.SRsetNZ(cpu.alu);
	cpu.r.X = cpu.alu & 0xFF;
	return 0;
}

const OP_LDY = (cpu: Cpu) => {  // load Y
	cpu.r.SRsetNZ(cpu.alu);
	cpu.r.Y = cpu.alu & 0xFF;
	return 0;
}

const OP_STA = (cpu: Cpu) => {  // store accumulator
	cpu.alu = cpu.r.A;
	return 0;
}

const OP_STX = (cpu: Cpu) => {  // store X
	cpu.alu = cpu.r.X;
	return 0;
}

const OP_STY = (cpu: Cpu) => {  // store Y
	cpu.alu = cpu.r.Y;
	return 0;
}

const OP_STZ = (cpu: Cpu) => {
	cpu.alu = 0;
	return 0;
}

const OP_PHA = (cpu: Cpu) => {  // push accumulator
	cpu.pushStack(cpu.r.A);
	return 0;
}

const OP_PLA = (cpu: Cpu) => {  // pull accumulator, uses write
	cpu.alu = cpu.popStack();
	cpu.r.SRsetNZ(cpu.alu);
	return 0;
}

const OP_PHX = (cpu: Cpu) => {  // push accumulator
	cpu.pushStack(cpu.r.X);
	return 0;
}

const OP_PLX = (cpu: Cpu) => {  // pull accumulator, uses write
	cpu.alu = cpu.popStack();
	cpu.r.SRsetNZ(cpu.alu);
	cpu.r.X = cpu.alu & 0xFF;
	return 0;
}

const OP_PHY = (cpu: Cpu) => {  // push accumulator
	cpu.pushStack(cpu.r.Y);
	return 0;
}

const OP_PLY = (cpu: Cpu) => {  // pull accumulator, uses write
	cpu.alu = cpu.popStack();
	cpu.r.SRsetNZ(cpu.alu);
	cpu.r.Y = cpu.alu & 0xFF;
	return 0;
}

const OP_PHP = (cpu: Cpu) => {  // push processor status (SR)
	cpu.pushStack(cpu.r.SRgetByte(true));
	return 0;
}

const OP_PLP = (cpu: Cpu) => {  // pull processor status (SR)
	cpu.r.SRsetByte(cpu.popStack());
	return 0;
}

const OP_TSX = (cpu: Cpu) => {  // transfer stack pointer to X
	cpu.r.X = cpu.r.SP;
	cpu.r.SRsetNZ(cpu.r.X);
	return 0;
}

const OP_TXS = (cpu: Cpu) => {  // transfer X to stack pointer
	cpu.r.SP = cpu.r.X;
	return 0;
}

const OP_TAX = (cpu: Cpu) => {  // transfer accumulator to X
	cpu.r.X = cpu.r.A;
	cpu.r.SRsetNZ(cpu.r.X);
	return 0;
}

const OP_TAY = (cpu: Cpu) => {  // transfer accumulator to Y
	cpu.r.Y = cpu.r.A;
	cpu.r.SRsetNZ(cpu.r.Y);
	return 0;
}

const OP_TXA = (cpu: Cpu) => {  // transfer X to accumulator
	cpu.r.A = cpu.r.X;
	cpu.r.SRsetNZ(cpu.r.A);
	return 0;
}

const OP_TYA = (cpu: Cpu) => {  // transfer Y to accumulator
	cpu.r.A = cpu.r.Y;
	cpu.r.SRsetNZ(cpu.r.A);
	return 0;
}

const OP_TRB = (cpu: Cpu) => { // test and reset bits
	cpu.r.SR_ZERO = (cpu.alu & cpu.r.A) == 0;
	cpu.alu &= ~cpu.r.A;
	cpu.writeOK = true;
	return 0;
}

const OP_TSB = (cpu: Cpu) => { // test and set bits
	cpu.r.SR_ZERO = (cpu.alu & cpu.r.A) == 0;
	cpu.alu |= cpu.r.A;
	cpu.writeOK = true;
	return 0;
}

const BBR = (cpu: Cpu, bit: number) => {
	if (!(cpu.alu & bit)) {
    cpu.r.PC--;
    cpu.r.cycles += A_REL(cpu);
    cpu.r.PC = cpu.address;
		return cpu.alu;
	}
	return 0;
}

const BBS = (cpu: Cpu, bit: number) => {
	if ((cpu.alu & bit))
	{
    cpu.r.PC--;
    cpu.r.cycles += A_REL(cpu);
    cpu.r.PC = cpu.address;
		return cpu.alu;
	}
	return 0;
}

const RMB = (cpu: Cpu, bit: number) => {
  cpu.alu &= ~bit;
  cpu.writeOK = true;
	return 0;
}

const SMB = (cpu: Cpu, bit: number) => {
  cpu.alu |= bit;
  cpu.writeOK = true;
	return 0;
}

const OP_BR0 = (cpu: Cpu) => {
  return BBR(cpu, 0x01);
}

const OP_BR1 = (cpu: Cpu) => {
  return BBR(cpu, 0x02);
}

const OP_BR2 = (cpu: Cpu) => {
  return BBR(cpu, 0x04);
}

const OP_BR3 = (cpu: Cpu) => {
  return BBR(cpu, 0x08);
}

const OP_BR4 = (cpu: Cpu) => {
  return BBR(cpu, 0x10);
}

const OP_BR5 = (cpu: Cpu) => {
  return BBR(cpu, 0x20);
}

const OP_BR6 = (cpu: Cpu) => {
  return BBR(cpu, 0x40);
}

const OP_BR7 = (cpu: Cpu) => {
  return BBR(cpu, 0x80);
}

const OP_BB0 = (cpu: Cpu) => {
  return BBS(cpu, 0x01);
}

const OP_BB1 = (cpu: Cpu) => {
  return BBS(cpu, 0x02);
}

const OP_BB2 = (cpu: Cpu) => {
  return BBS(cpu, 0x04);
}

const OP_BB3 = (cpu: Cpu) => {
  return BBS(cpu, 0x08);
}

const OP_BB4 = (cpu: Cpu) => {
  return BBS(cpu, 0x10);
}

const OP_BB5 = (cpu: Cpu) => {
  return BBS(cpu, 0x20);
}

const OP_BB6 = (cpu: Cpu) => {
  return BBS(cpu, 0x40);
}

const OP_BB7 = (cpu: Cpu) => {
  return BBS(cpu, 0x80);
}

const OP_RB0 = (cpu: Cpu) => {
  return RMB(cpu, 0x01);
}

const OP_RB1 = (cpu: Cpu) => {
  return RMB(cpu, 0x02);
}

const OP_RB2 = (cpu: Cpu) => {
  return RMB(cpu, 0x04);
}

const OP_RB3 = (cpu: Cpu) => {
  return RMB(cpu, 0x08);
}

const OP_RB4 = (cpu: Cpu) => {
  return RMB(cpu, 0x10);
}

const OP_RB5 = (cpu: Cpu) => {
  return RMB(cpu, 0x20);
}

const OP_RB6 = (cpu: Cpu) => {
  return RMB(cpu, 0x40);
}

const OP_RB7 = (cpu: Cpu) => {
  return RMB(cpu, 0x80);
}

const OP_SB0 = (cpu: Cpu) => {
  return SMB(cpu, 0x01);
}

const OP_SB1 = (cpu: Cpu) => {
  return SMB(cpu, 0x02);
}

const OP_SB2 = (cpu: Cpu) => {
  return SMB(cpu, 0x04);
}

const OP_SB3 = (cpu: Cpu) => {
  return SMB(cpu, 0x08);
}

const OP_SB4 = (cpu: Cpu) => {
  return SMB(cpu, 0x10);
}

const OP_SB5 = (cpu: Cpu) => {
  return SMB(cpu, 0x20);
}

const OP_SB6 = (cpu: Cpu) => {
  return SMB(cpu, 0x40);
}

const OP_SB7= (cpu: Cpu) => {
  return SMB(cpu, 0x80);
}

const OP_STP = (cpu: Cpu) => {
  cpu.r.stopped = true;
  return 0;
}

const OP_WAI = (cpu: Cpu) => {
  cpu.r.waiting = true;
  return 0;
}


// opcode attribute table

OPCODES[0x00] = new Opcode(OP_BRK, A_IMP, 1, 7, 0); // 0x00
OPCODES[0x01] = new Opcode(OP_ORA, A_INX, 1, 6, 0); // 0x01
OPCODES[0x02] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x02
OPCODES[0x03] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x03
OPCODES[0x04] = new Opcode(OP_TSB, A_ZPG, 1, 5, 0); // 0x04
OPCODES[0x05] = new Opcode(OP_ORA, A_ZPG, 1, 3, 0); // 0x05
OPCODES[0x06] = new Opcode(OP_ASL, A_ZPG, 1, 5, 0); // 0x06
OPCODES[0x07] = new Opcode(OP_RB0, A_ZPG, 1, 5, 0); // 0x07
OPCODES[0x08] = new Opcode(OP_PHP, A_IMP, 0, 3, 0); // 0x08
OPCODES[0x09] = new Opcode(OP_ORA, A_IMM, 1, 2, 0); // 0x09
OPCODES[0x0A] = new Opcode(OP_ASL, A_ACC, 0, 2, 0); // 0x0A
OPCODES[0x0B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x0B
OPCODES[0x0C] = new Opcode(OP_TSB, A_ABS, 2, 6, 0); // 0x0C
OPCODES[0x0D] = new Opcode(OP_ORA, A_ABS, 2, 4, 0); // 0x0D
OPCODES[0x0E] = new Opcode(OP_ASL, A_ABS, 2, 6, 0); // 0x0E
OPCODES[0x0F] = new Opcode(OP_BR0, A_ZPG, 2, 2, 0); // 0x0F
OPCODES[0x10] = new Opcode(OP_BPL, A_REL, 1, 2, 0); // 0x10
OPCODES[0x11] = new Opcode(OP_ORA, A_INY, 1, 5, 0); // 0x11
OPCODES[0x12] = new Opcode(OP_ORA, A_ZPI, 1, 5, 0); // 0x12
OPCODES[0x13] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x13
OPCODES[0x14] = new Opcode(OP_TRB, A_ZPG, 1, 5, 0); // 0x14
OPCODES[0x15] = new Opcode(OP_ORA, A_ZPX, 1, 4, 0); // 0x15
OPCODES[0x16] = new Opcode(OP_ASL, A_ZPX, 1, 6, 0); // 0x16
OPCODES[0x17] = new Opcode(OP_RB1, A_ZPG, 1, 5, 0); // 0x17
OPCODES[0x18] = new Opcode(OP_CLC, A_IMP, 0, 2, 0); // 0x18
OPCODES[0x19] = new Opcode(OP_ORA, A_ABY, 2, 4, 0); // 0x19
OPCODES[0x1A] = new Opcode(OP_DEC, A_ACC, 0, 2, 0); // 0x1A
OPCODES[0x1B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x1B
OPCODES[0x1C] = new Opcode(OP_TRB, A_ABS, 2, 6, 0); // 0x1C
OPCODES[0x1D] = new Opcode(OP_ORA, A_ABX, 2, 4, 0); // 0x1D
OPCODES[0x1E] = new Opcode(OP_ASL, A_ABX, 2, 6, 0); // 0x1E
OPCODES[0x1F] = new Opcode(OP_BR1, A_ZPG, 2, 2, 0); // 0x1F
OPCODES[0x20] = new Opcode(OP_JSR, A_ABS, 2, 6, 0); // 0x20
OPCODES[0x21] = new Opcode(OP_AND, A_INX, 1, 6, 0); // 0x21
OPCODES[0x22] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x22
OPCODES[0x23] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x23
OPCODES[0x24] = new Opcode(OP_BIT, A_ZPG, 1, 3, 0); // 0x24
OPCODES[0x25] = new Opcode(OP_AND, A_ZPG, 1, 3, 0); // 0x25
OPCODES[0x26] = new Opcode(OP_ROL, A_ZPG, 1, 5, 0); // 0x26
OPCODES[0x27] = new Opcode(OP_RB2, A_ZPG, 1, 5, 0); // 0x27
OPCODES[0x28] = new Opcode(OP_PLP, A_IMP, 0, 4, 0); // 0x28
OPCODES[0x29] = new Opcode(OP_AND, A_IMM, 1, 2, 0); // 0x29
OPCODES[0x2A] = new Opcode(OP_ROL, A_ACC, 0, 2, 0); // 0x2A
OPCODES[0x2B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x2B
OPCODES[0x2C] = new Opcode(OP_BIT, A_ABS, 2, 4, 0); // 0x2C
OPCODES[0x2D] = new Opcode(OP_AND, A_ABS, 2, 4, 0); // 0x2D
OPCODES[0x2E] = new Opcode(OP_ROL, A_ABS, 2, 6, 0); // 0x2E
OPCODES[0x2F] = new Opcode(OP_BR2, A_ZPG, 2, 2, 0); // 0x2F
OPCODES[0x30] = new Opcode(OP_BMI, A_REL, 1, 2, 0); // 0x30
OPCODES[0x31] = new Opcode(OP_AND, A_INY, 1, 5, 0); // 0x31
OPCODES[0x32] = new Opcode(OP_AND, A_ZPI, 1, 5, 0); // 0x32
OPCODES[0x33] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x33
OPCODES[0x34] = new Opcode(OP_BIT, A_ZPX, 1, 4, 0); // 0x34
OPCODES[0x35] = new Opcode(OP_AND, A_ZPX, 1, 4, 0); // 0x35
OPCODES[0x36] = new Opcode(OP_ROL, A_ZPX, 1, 6, 0); // 0x36
OPCODES[0x37] = new Opcode(OP_RB3, A_ZPG, 1, 5, 0); // 0x37
OPCODES[0x38] = new Opcode(OP_SEC, A_IMP, 0, 2, 0); // 0x38
OPCODES[0x39] = new Opcode(OP_AND, A_ABY, 2, 4, 0); // 0x39
OPCODES[0x3A] = new Opcode(OP_INC, A_ACC, 0, 2, 0); // 0x3A
OPCODES[0x3B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x3B
OPCODES[0x3C] = new Opcode(OP_BIT, A_ABX, 2, 4, 0); // 0x3C
OPCODES[0x3D] = new Opcode(OP_AND, A_ABX, 2, 4, 0); // 0x3D
OPCODES[0x3E] = new Opcode(OP_ROL, A_ABX, 2, 6, 0); // 0x3E
OPCODES[0x3F] = new Opcode(OP_BR3, A_ZPG, 2, 2, 0); // 0x3F
OPCODES[0x40] = new Opcode(OP_RTI, A_IMP, 0, 6, 0); // 0x40
OPCODES[0x41] = new Opcode(OP_EOR, A_INX, 1, 6, 0); // 0x41
OPCODES[0x42] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x42
OPCODES[0x43] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x43
OPCODES[0x44] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x44
OPCODES[0x45] = new Opcode(OP_EOR, A_ZPG, 1, 3, 0); // 0x45
OPCODES[0x46] = new Opcode(OP_LSR, A_ZPG, 1, 5, 0); // 0x46
OPCODES[0x47] = new Opcode(OP_RB4, A_ZPG, 1, 5, 0); // 0x47
OPCODES[0x48] = new Opcode(OP_PHA, A_IMP, 0, 3, 0); // 0x48
OPCODES[0x49] = new Opcode(OP_EOR, A_IMM, 1, 2, 0); // 0x49
OPCODES[0x4A] = new Opcode(OP_LSR, A_ACC, 0, 2, 0); // 0x4A
OPCODES[0x4B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x4B
OPCODES[0x4C] = new Opcode(OP_JMP, A_ABS, 2, 3, 0); // 0x4C
OPCODES[0x4D] = new Opcode(OP_EOR, A_ABS, 2, 4, 0); // 0x4D
OPCODES[0x4E] = new Opcode(OP_LSR, A_ABS, 2, 6, 0); // 0x4E
OPCODES[0x4F] = new Opcode(OP_BR4, A_ZPG, 2, 2, 0); // 0x4F
OPCODES[0x50] = new Opcode(OP_BVC, A_REL, 1, 2, 0); // 0x50
OPCODES[0x51] = new Opcode(OP_EOR, A_INY, 1, 5, 0); // 0x51
OPCODES[0x52] = new Opcode(OP_EOR, A_ZPI, 1, 5, 0); // 0x52
OPCODES[0x53] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x53
OPCODES[0x54] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x54
OPCODES[0x55] = new Opcode(OP_EOR, A_ZPX, 1, 4, 0); // 0x55
OPCODES[0x56] = new Opcode(OP_LSR, A_ZPX, 1, 6, 0); // 0x56
OPCODES[0x57] = new Opcode(OP_RB5, A_ZPG, 1, 5, 0); // 0x57
OPCODES[0x58] = new Opcode(OP_CLI, A_IMP, 0, 2, 0); // 0x58
OPCODES[0x59] = new Opcode(OP_EOR, A_ABY, 2, 4, 0); // 0x59
OPCODES[0x5A] = new Opcode(OP_PHY, A_IMP, 0, 3, 0); // 0x5A
OPCODES[0x5B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x5B
OPCODES[0x5C] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x5C
OPCODES[0x5D] = new Opcode(OP_EOR, A_ABX, 2, 4, 0); // 0x5D
OPCODES[0x5E] = new Opcode(OP_LSR, A_ABX, 2, 6, 0); // 0x5E
OPCODES[0x5F] = new Opcode(OP_BR5, A_ZPG, 2, 2, 0); // 0x5F
OPCODES[0x60] = new Opcode(OP_RTS, A_IMP, 0, 6, 0); // 0x60
OPCODES[0x61] = new Opcode(OP_ADC, A_INX, 1, 6, 0); // 0x61
OPCODES[0x62] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x62
OPCODES[0x63] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x63
OPCODES[0x64] = new Opcode(OP_STZ, A_ZPG, 1, 3, 1); // 0x64
OPCODES[0x65] = new Opcode(OP_ADC, A_ZPG, 1, 3, 0); // 0x65
OPCODES[0x66] = new Opcode(OP_ROR, A_ZPG, 1, 5, 0); // 0x66
OPCODES[0x67] = new Opcode(OP_RB6, A_ZPG, 1, 5, 0); // 0x67
OPCODES[0x68] = new Opcode(OP_PLA, A_ACC, 0, 4, 1); // 0x68
OPCODES[0x69] = new Opcode(OP_ADC, A_IMM, 1, 2, 0); // 0x69
OPCODES[0x6A] = new Opcode(OP_ROR, A_ACC, 0, 2, 0); // 0x6A
OPCODES[0x6B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x6B
OPCODES[0x6C] = new Opcode(OP_JMP, A_IND, 2, 5, 0); // 0x6C
OPCODES[0x6D] = new Opcode(OP_ADC, A_ABS, 2, 4, 0); // 0x6D
OPCODES[0x6E] = new Opcode(OP_ROR, A_ABS, 2, 6, 0); // 0x6E
OPCODES[0x6F] = new Opcode(OP_BR6, A_ZPG, 2, 2, 0); // 0x6F
OPCODES[0x70] = new Opcode(OP_BVS, A_REL, 1, 2, 0); // 0x70
OPCODES[0x71] = new Opcode(OP_ADC, A_INY, 1, 5, 0); // 0x71
OPCODES[0x72] = new Opcode(OP_ADC, A_ZPI, 1, 5, 0); // 0x72
OPCODES[0x73] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x73
OPCODES[0x74] = new Opcode(OP_STZ, A_ZPX, 1, 4, 1); // 0x74
OPCODES[0x75] = new Opcode(OP_ADC, A_ZPX, 1, 4, 0); // 0x75
OPCODES[0x76] = new Opcode(OP_ROR, A_ZPX, 1, 6, 0); // 0x76
OPCODES[0x77] = new Opcode(OP_RB7, A_ZPG, 1, 5, 0); // 0x77
OPCODES[0x78] = new Opcode(OP_SEI, A_IMP, 0, 2, 0); // 0x78
OPCODES[0x79] = new Opcode(OP_ADC, A_ABY, 2, 4, 0); // 0x79
OPCODES[0x7A] = new Opcode(OP_PLY, A_IMP, 0, 4, 0); // 0x7A
OPCODES[0x7B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x7B
OPCODES[0x7C] = new Opcode(OP_JMP, A_AIX, 2, 6, 0); // 0x7C
OPCODES[0x7D] = new Opcode(OP_ADC, A_ABX, 2, 4, 0); // 0x7D
OPCODES[0x7E] = new Opcode(OP_ROR, A_ABX, 2, 6, 0); // 0x7E
OPCODES[0x7F] = new Opcode(OP_BR7, A_ZPG, 2, 2, 0); // 0x7F
OPCODES[0x80] = new Opcode(OP_BRA, A_REL, 1, 3, 0); // 0x80
OPCODES[0x81] = new Opcode(OP_STA, A_INX, 1, 6, 1); // 0x81
OPCODES[0x82] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x82
OPCODES[0x83] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x83
OPCODES[0x84] = new Opcode(OP_STY, A_ZPG, 1, 3, 1); // 0x84
OPCODES[0x85] = new Opcode(OP_STA, A_ZPG, 1, 3, 1); // 0x85
OPCODES[0x86] = new Opcode(OP_STX, A_ZPG, 1, 3, 1); // 0x86
OPCODES[0x87] = new Opcode(OP_SB0, A_ZPG, 1, 5, 0); // 0x87
OPCODES[0x88] = new Opcode(OP_DEY, A_IMP, 0, 2, 0); // 0x88
OPCODES[0x89] = new Opcode(OP_BIT, A_IMM, 1, 2, 0); // 0x89
OPCODES[0x8A] = new Opcode(OP_TXA, A_IMP, 0, 2, 0); // 0x8A
OPCODES[0x8B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x8B
OPCODES[0x8C] = new Opcode(OP_STY, A_ABS, 2, 4, 1); // 0x8C
OPCODES[0x8D] = new Opcode(OP_STA, A_ABS, 2, 4, 1); // 0x8D
OPCODES[0x8E] = new Opcode(OP_STX, A_ABS, 2, 4, 1); // 0x8E
OPCODES[0x8F] = new Opcode(OP_BB0, A_ZPG, 2, 2, 0); // 0x8F
OPCODES[0x90] = new Opcode(OP_BCC, A_REL, 1, 2, 0); // 0x90
OPCODES[0x91] = new Opcode(OP_STA, A_INY, 1, 6, 1); // 0x91
OPCODES[0x92] = new Opcode(OP_STA, A_ZPI, 1, 5, 1); // 0x92
OPCODES[0x93] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x93
OPCODES[0x94] = new Opcode(OP_STY, A_ZPX, 1, 4, 1); // 0x94
OPCODES[0x95] = new Opcode(OP_STA, A_ZPX, 1, 4, 1); // 0x95
OPCODES[0x96] = new Opcode(OP_STX, A_ZPY, 1, 4, 1); // 0x96
OPCODES[0x97] = new Opcode(OP_SB1, A_ZPG, 1, 5, 0); // 0x97
OPCODES[0x98] = new Opcode(OP_TYA, A_IMP, 0, 2, 0); // 0x98
OPCODES[0x99] = new Opcode(OP_STA, A_ABY, 2, 5, 1); // 0x99
OPCODES[0x9A] = new Opcode(OP_TXS, A_IMP, 0, 2, 0); // 0x9A
OPCODES[0x9B] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0x9B
OPCODES[0x9C] = new Opcode(OP_STZ, A_ABS, 2, 4, 1); // 0x9C
OPCODES[0x9D] = new Opcode(OP_STA, A_ABX, 2, 5, 1); // 0x9D
OPCODES[0x9E] = new Opcode(OP_STZ, A_ABX, 2, 5, 1); // 0x9E
OPCODES[0x9F] = new Opcode(OP_BB1, A_ZPG, 2, 2, 0); // 0x9F
OPCODES[0xA0] = new Opcode(OP_LDY, A_IMM, 1, 2, 0); // 0xA0
OPCODES[0xA1] = new Opcode(OP_LDA, A_INX, 1, 6, 0); // 0xA1
OPCODES[0xA2] = new Opcode(OP_LDX, A_IMM, 1, 2, 0); // 0xA2
OPCODES[0xA3] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xA3
OPCODES[0xA4] = new Opcode(OP_LDY, A_ZPG, 1, 3, 0); // 0xA4
OPCODES[0xA5] = new Opcode(OP_LDA, A_ZPG, 1, 3, 0); // 0xA5
OPCODES[0xA6] = new Opcode(OP_LDX, A_ZPG, 1, 3, 0); // 0xA6
OPCODES[0xA7] = new Opcode(OP_SB2, A_ZPG, 1, 5, 0); // 0xA7
OPCODES[0xA8] = new Opcode(OP_TAY, A_IMP, 0, 2, 0); // 0xA8
OPCODES[0xA9] = new Opcode(OP_LDA, A_IMM, 1, 2, 0); // 0xA9
OPCODES[0xAA] = new Opcode(OP_TAX, A_IMP, 0, 2, 0); // 0xAA
OPCODES[0xAB] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xAB
OPCODES[0xAC] = new Opcode(OP_LDY, A_ABS, 2, 4, 0); // 0xAC
OPCODES[0xAD] = new Opcode(OP_LDA, A_ABS, 2, 4, 0); // 0xAD
OPCODES[0xAE] = new Opcode(OP_LDX, A_ABS, 2, 4, 0); // 0xAE
OPCODES[0xAF] = new Opcode(OP_BB2, A_ZPG, 2, 2, 0); // 0xAF
OPCODES[0xB0] = new Opcode(OP_BCS, A_REL, 1, 2, 0); // 0xB0
OPCODES[0xB1] = new Opcode(OP_LDA, A_INY, 1, 5, 0); // 0xB1
OPCODES[0xB2] = new Opcode(OP_LDA, A_ZPI, 1, 5, 0); // 0xB2
OPCODES[0xB3] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xB3
OPCODES[0xB4] = new Opcode(OP_LDY, A_ZPX, 1, 4, 0); // 0xB4
OPCODES[0xB5] = new Opcode(OP_LDA, A_ZPX, 1, 4, 0); // 0xB5
OPCODES[0xB6] = new Opcode(OP_LDX, A_ZPY, 1, 4, 0); // 0xB6
OPCODES[0xB7] = new Opcode(OP_SB3, A_ZPG, 1, 5, 0); // 0xB7
OPCODES[0xB8] = new Opcode(OP_CLV, A_IMP, 0, 2, 0); // 0xB8
OPCODES[0xB9] = new Opcode(OP_LDA, A_ABY, 2, 4, 0); // 0xB9
OPCODES[0xBA] = new Opcode(OP_TSX, A_IMP, 0, 2, 0); // 0xBA
OPCODES[0xBB] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xBB
OPCODES[0xBC] = new Opcode(OP_LDY, A_ABX, 2, 4, 0); // 0xBC
OPCODES[0xBD] = new Opcode(OP_LDA, A_ABX, 2, 4, 0); // 0xBD
OPCODES[0xBE] = new Opcode(OP_LDX, A_ABY, 2, 4, 0); // 0xBE
OPCODES[0xBF] = new Opcode(OP_BB3, A_ZPG, 2, 2, 0); // 0xBF
OPCODES[0xC0] = new Opcode(OP_CPY, A_IMM, 1, 2, 0); // 0xC0
OPCODES[0xC1] = new Opcode(OP_CMP, A_INX, 1, 6, 0); // 0xC1
OPCODES[0xC2] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xC2
OPCODES[0xC3] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xC3
OPCODES[0xC4] = new Opcode(OP_CPY, A_ZPG, 1, 3, 0); // 0xC4
OPCODES[0xC5] = new Opcode(OP_CMP, A_ZPG, 1, 3, 0); // 0xC5
OPCODES[0xC6] = new Opcode(OP_DEC, A_ZPG, 1, 5, 0); // 0xC6
OPCODES[0xC7] = new Opcode(OP_SB4, A_ZPG, 1, 5, 0); // 0xC7
OPCODES[0xC8] = new Opcode(OP_INY, A_IMP, 0, 2, 0); // 0xC8
OPCODES[0xC9] = new Opcode(OP_CMP, A_IMM, 1, 2, 0); // 0xC9
OPCODES[0xCA] = new Opcode(OP_DEX, A_IMP, 0, 2, 0); // 0xCA
OPCODES[0xCB] = new Opcode(OP_WAI, A_IMP, 0, 3, 0); // 0xCB
OPCODES[0xCC] = new Opcode(OP_CPY, A_ABS, 2, 4, 0); // 0xCC
OPCODES[0xCD] = new Opcode(OP_CMP, A_ABS, 2, 4, 0); // 0xCD
OPCODES[0xCE] = new Opcode(OP_DEC, A_ABS, 2, 6, 0); // 0xCE
OPCODES[0xCF] = new Opcode(OP_BB4, A_ZPG, 2, 2, 0); // 0xCF
OPCODES[0xD0] = new Opcode(OP_BNE, A_REL, 1, 2, 0); // 0xD0
OPCODES[0xD1] = new Opcode(OP_CMP, A_INY, 1, 5, 0); // 0xD1
OPCODES[0xD2] = new Opcode(OP_CMP, A_ZPI, 1, 5, 0); // 0xD2
OPCODES[0xD3] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xD3
OPCODES[0xD4] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xD4
OPCODES[0xD5] = new Opcode(OP_CMP, A_ZPX, 1, 4, 0); // 0xD5
OPCODES[0xD6] = new Opcode(OP_DEC, A_ZPX, 1, 6, 0); // 0xD6
OPCODES[0xD7] = new Opcode(OP_SB5, A_ZPG, 1, 5, 0); // 0xD7
OPCODES[0xD8] = new Opcode(OP_CLD, A_IMP, 0, 2, 0); // 0xD8
OPCODES[0xD9] = new Opcode(OP_CMP, A_ABY, 2, 4, 0); // 0xD9
OPCODES[0xDA] = new Opcode(OP_PHX, A_IMP, 0, 3, 0); // 0xDA
OPCODES[0xDB] = new Opcode(OP_STP, A_IMP, 0, 3, 0); // 0xDB
OPCODES[0xDC] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xDC
OPCODES[0xDD] = new Opcode(OP_CMP, A_ABX, 2, 4, 0); // 0xDD
OPCODES[0xDE] = new Opcode(OP_DEC, A_ABX, 2, 7, 0); // 0xDE
OPCODES[0xDF] = new Opcode(OP_BB5, A_ZPG, 2, 2, 0); // 0xDF
OPCODES[0xE0] = new Opcode(OP_CPX, A_IMM, 1, 2, 0); // 0xE0
OPCODES[0xE1] = new Opcode(OP_SBC, A_INX, 1, 6, 0); // 0xE1
OPCODES[0xE2] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xE2
OPCODES[0xE3] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xE3
OPCODES[0xE4] = new Opcode(OP_CPX, A_ZPG, 1, 3, 0); // 0xE4
OPCODES[0xE5] = new Opcode(OP_SBC, A_ZPG, 1, 3, 0); // 0xE5
OPCODES[0xE6] = new Opcode(OP_INC, A_ZPG, 1, 5, 0); // 0xE6
OPCODES[0xE7] = new Opcode(OP_SB6, A_ZPG, 1, 5, 0); // 0xE7
OPCODES[0xE8] = new Opcode(OP_INX, A_IMP, 0, 2, 0); // 0xE8
OPCODES[0xE9] = new Opcode(OP_SBC, A_IMM, 1, 2, 0); // 0xE9
OPCODES[0xEA] = new Opcode(OP_NOP, A_IMP, 0, 2, 0); // 0xEA
OPCODES[0xEB] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xEB
OPCODES[0xEC] = new Opcode(OP_CPX, A_ABS, 2, 4, 0); // 0xEC
OPCODES[0xED] = new Opcode(OP_SBC, A_ABS, 2, 4, 0); // 0xED
OPCODES[0xEE] = new Opcode(OP_INC, A_ABS, 2, 6, 0); // 0xEE
OPCODES[0xEF] = new Opcode(OP_BB6, A_ZPG, 2, 2, 0); // 0xEF
OPCODES[0xF0] = new Opcode(OP_BEQ, A_REL, 1, 2, 0); // 0xF0
OPCODES[0xF1] = new Opcode(OP_SBC, A_INY, 1, 5, 0); // 0xF1
OPCODES[0xF2] = new Opcode(OP_SBC, A_ZPI, 1, 5, 0); // 0xF2
OPCODES[0xF3] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xF3
OPCODES[0xF4] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xF4
OPCODES[0xF5] = new Opcode(OP_SBC, A_ZPX, 1, 4, 0); // 0xF5
OPCODES[0xF6] = new Opcode(OP_INC, A_ZPX, 1, 6, 0); // 0xF6
OPCODES[0xF7] = new Opcode(OP_SB7, A_ZPG, 1, 5, 0); // 0xF7
OPCODES[0xF8] = new Opcode(OP_SED, A_IMP, 0, 2, 0); // 0xF8
OPCODES[0xF9] = new Opcode(OP_SBC, A_ABY, 2, 4, 0); // 0xF9
OPCODES[0xFA] = new Opcode(OP_PLX, A_IMP, 0, 4, 0); // 0xFA
OPCODES[0xFB] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xFB
OPCODES[0xFC] = new Opcode(OP_BAD, A_NON, 0, 0, 0); // 0xFC
OPCODES[0xFD] = new Opcode(OP_SBC, A_ABX, 2, 4, 0); // 0xFD
OPCODES[0xFE] = new Opcode(OP_INC, A_ABX, 2, 7, 0); // 0xFE
OPCODES[0xFF] = new Opcode(OP_BB7, A_ZPG, 2, 2, 0); // 0xFF
