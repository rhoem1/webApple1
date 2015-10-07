/**
 * a 65c02 CPU emulation
 *
 * @copyright Robert Hoem 2015
 * @website
 * @license 2-term BSD
 */

function SixtyFiveCeeOhTwo() {
	"use strict";


	// important memory locations and
	// status constants

	var 
	ZEROPAGE = 0x0000,
	STACK = 0x0100,
	IRQBRK_VECTOR = 0xFFFE,
	RESET_VECTOR = 0xFFFC,
	NMI_VECTOR = 0xFFFA,

	SR_NEGATIVE_B = 0x80,
	SR_OVERFLOW_B = 0x40,
	SR_UNUSED_B = 0x20,
	SR_BREAK_B = 0x10,
	SR_DECIMAL_B = 0x08,
	SR_INTERRUPT_B = 0x04,
	SR_ZERO_B = 0x02,
	SR_CARRY_B = 0x01;


	// my ram
	this.memory = new Uint8Array(0x10000); //unsigned char 

	// memory intercept
	// when we read or write, we need to tickle these
	// since their the interface to other emulated systems
	var intercepts = [];
	for(var i = 0; i < 65536; ++i) {
		intercepts[i] = 0;
	}


	this.newMemoryIntercept = function(_read, _write) {
		return {
			read : _read,
			write : _write
		};
	}


	// registers
	var r = {

		PC : 0, //unsigned short program counter 
		old_PC : 0, //unsigned short program counter
		A : 0, //int Accumulator
		X : 0, //int X index
		Y : 0, //int Y index
		SP : 0, //unsigned char  stack pointer

		SR_NEGATIVE : false, // bool
		SR_OVERFLOW : false, // bool
		SR_UNUSED : false,   // bool
		SR_BREAK : false,    // bool
		SR_DECIMAL : false,  // bool
		SR_INTERRUPT : false,// bool
		SR_ZERO : false,     // bool
		SR_CARRY : false,    // bool

		SRsetByte : function(b) {
			this.SR_NEGATIVE = (b & SR_NEGATIVE_B);
			this.SR_OVERFLOW = (b & SR_OVERFLOW_B);
			this.SR_UNUSED = true; //(b & SR_UNUSED_B);
			this.SR_BREAK = (b & SR_BREAK_B);
			this.SR_DECIMAL = (b & SR_DECIMAL_B);
			this.SR_INTERRUPT = (b & SR_INTERRUPT_B);
			this.SR_ZERO = (b & SR_ZERO_B);
			this.SR_CARRY = (b & SR_CARRY_B);
		},
		SRgetByte : function() { 
			return (
				(this.SR_NEGATIVE ? SR_NEGATIVE_B : 0) |
				(this.SR_OVERFLOW ? SR_OVERFLOW_B : 0) |
				this.SR_UNUSED_B |
				(this.SR_BREAK ? SR_BREAK_B : 0) |
				(this.SR_DECIMAL ? SR_DECIMAL_B : 0) |
				(this.SR_INTERRUPT ? SR_INTERRUPT_B : 0) |
				(this.SR_ZERO ? SR_ZERO_B : 0) |
				(this.SR_CARRY ? SR_CARRY_B : 0)
			);
		},

		SRsetNZ : function(v) { //unsigned char 
			this.SR_NEGATIVE = (v & SR_NEGATIVE_B) == SR_NEGATIVE_B;
			this.SR_ZERO = (v == 0x00);
		},

		SRborrow : function(alu) { //unsigned short 
			this.SR_CARRY = (alu & 0x100) == 0;
		},

		SRcarry : function(alu) { //unsigned short 
			this.SR_CARRY = (alu & 0x100) != 0;
		}

	};


	// addressing modes
	//enum eADDRESSING
	var 
	ADR_NONE  =  0,
	ADR_IMPL  =  1,
	ADR_IMM   =  2,
	ADR_ABS   =  3,
	ADR_ABS_X =  4,
	ADR_ABS_Y =  5,
	ADR_IND   =  6,
	ADR_AB_IX =  7,
	ADR_IND_X =  8,
	ADR_IND_Y =  9,
	ADR_ZPG   = 10,
	ADR_ZPG_X = 11,
	ADR_ZPG_Y = 12,
	ADR_ZPG_I = 13,
	ADR_A     = 14,
	ADR_REL   = 15;

	//enum eOPCODES
	var OP_BAD =  0,
	OP_ADC =  1, // add with carry
	OP_AND =  2, // and (with accumulator)
	OP_ASL =  3, // arithmetic shift left
	OP_BCC =  4, // branch on carry clear
	OP_BCS =  5, // branch on carry set
	OP_BEQ =  6, // branch on equal (zero set)
	OP_BIT =  7, // bit test
	OP_BMI =  8, // branch on minus (negative set)
	OP_BNE =  9, // branch on not equal (zero clear)
	OP_BPL = 10, // branch on plus (negative clear)
	OP_BRA = 11, // branch always
	OP_BRK = 12, // interrupt
	OP_BVC = 13, // branch on overflow clear
	OP_BVS = 14, // branch on overflow set
	OP_CLC = 15, // clear carry
	OP_CLD = 16, // clear decimal
	OP_CLI = 17, // clear interrupt disable
	OP_CLV = 18, // clear overflow
	OP_CMP = 19, // compare (with accumulator)
	OP_CPX = 20, // compare with X
	OP_CPY = 21, // compare with Y
	OP_DEC = 22, // decrement
	OP_DEX = 23, // decrement X
	OP_DEY = 24, // decrement Y
	OP_EOR = 25, // exclusive or (with accumulator)
	OP_INC = 26, // increment
	OP_INX = 27, // increment X
	OP_INY = 28, // increment Y
	OP_JMP = 29, // jump
	OP_JSR = 30, // jump subroutine
	OP_LDA = 31, // load accumulator
	OP_LDX = 32, // load X
	OP_LDY = 33, // load Y
	OP_LSR = 34, // logical shift right
	OP_NOP = 35, // no operation
	OP_ORA = 36, // or with accumulator
	OP_PHA = 37, // push accumulator
	OP_PHP = 38, // push processor status (SR)
	OP_PLA = 39, // pull accumulator
	OP_PLP = 40, // pull processor status (SR)
	OP_PHX = 41, // push X
	OP_PHY = 42, // push Y
	OP_PLX = 43, // pull X
	OP_PLY = 44, // pull Y
	OP_ROL = 45, // rotate left
	OP_ROR = 46, // rotate right
	OP_RTI = 47, // return from interrupt
	OP_RTS = 48, // return from subroutine
	OP_SBC = 49, // subtract with carry
	OP_SEC = 50, // set carry
	OP_SED = 51, // set decimal
	OP_SEI = 52, // set interrupt disable
	OP_STA = 53, // store accumulator
	OP_STX = 54, // store X
	OP_STY = 55, // store Y
	OP_STZ = 56, // store a 0
	OP_TAX = 57, // transfer accumulator to X
	OP_TAY = 58, // transfer accumulator to Y
	OP_TSX = 59, // transfer stack pointer to X
	OP_TXA = 60, // transfer X to accumulator
	OP_TXS = 61, // transfer X to stack pointer
	OP_TYA = 62, // transfer Y to accumulator
	OP_TRB = 63, // test and reset bits
	OP_TSB = 64; // test and set bits





	// state variables

	var opcode = 0, // unsigned char 

	// SR before opcode
	SR_before = 0x00, // unsigned char 

	// arithmatic logic unit
	alu = 0, // 	int
	old_alu = 0, // 	int

	// byte just after opcode
	zpage = 0x00, // 	unsigned char

	// two bytes just after opcode as a 16 bit word
	address = 0x0000, // 	unsigned short

	// will we write?
	write = false, // 	bool

	// used for debugging
	paused = false, // 	bool


	// are maskable interrupts active
	interrupts_active = false, // 	bool
	interrupted = false; // 	bool




	/**
	 * add a memory intercept
	 * @arg unsigned short address
	 * @arg memoryIntercept i
	 */

	this.addIntercept = function(address,  i) {
		intercepts[address] = i;
	}

	/**
	 * add a memory intercept to a range of addresses
	 * @arg unsigned short start
	 * @arg unsigned short len
	 * @arg memoryIntercept i
	 */
	this.addInterceptRange = function(start, len, i) {
		for(var a = start; a < start + len; ++a) {
			if(a < 65536) 
				intercepts[a] = i;
		}
	}
	this.copyIntoMemory = function(start, len, data) {
		for(var a = 0; a < len; ++a) {
			this.memory[start + a] = data[a];
		}
	}


	/**
	 * read a byte from an address through the intercepts
	 * @arg unsigned short address
	 * @returns unsigned char 
	 */
	this.readMemoryByte = function(address) {
		if(intercepts[address]) 
			this.memory[address] = intercepts[address].read(address, this);
		return this.memory[address];
	}

	/**
	 * read a word (2 bytes in LSB) from an address via readMemoryByte
	 * @arg unsigned short address
	 * @returns unsigned short 
	 */
	this.readMemoryWord = function(address) { 
		return (this.readMemoryByte(address + 1) << 8) | this.readMemoryByte(address);
	}

	/**
	 * write a byte to an address through the intercepts
	 * @arg unsigned short address
	 * @arg int value
	 */
	this.writeMemory = function(address, value) {
		var written = false;
		value &= 0xFF;
		if(intercepts[address]) {
			written = intercepts[address].write(value, address, this);
		}
		if(!written)
			this.memory[address] = value;
	}

	/**
	 * reset the cpu
	 * sets A, X, Y and SR to 0, sets SP to 0xFD and PC to whever the reset vetor points to
	 * cause reset is actually a BRK with the stack pushes read only, therefor it starts
	 * SP at 0, then over the course of attemptying to fake-push PC and SR to the stack
	 * it decrements SP 3 times to 0xFD
	 */
	this.resetCpu = function() {
		r.SRsetByte(0);
		r.SR_INTERRUPT = true;
		r.SR_BREAK = true;
		r.SP = 0xFD; 
		address = this.readMemoryWord(RESET_VECTOR);
		this.setPC(address);
		r.A = 0;
		r.X = 0;
		r.Y = 0;
	}

	/**
	 * Interrupt the pc, maskable
	 */
	this.interruptCpu = function() {
		if(interrupts_active) {
			this.pushStack((r.PC & 0xFF00) >> 8);
			this.pushStack(r.PC & 0xFF);
			this.pushStack(r.SRgetByte());
			address = this.readMemoryWord(IRQBRK_VECTOR);
			this.setPC(address);
			interrupted = true;
		}
	}

	/**
	 * non maskable interrupt
	 */
	this.nmiInterruptCpu = function() {
		this.pushStack((r.PC & 0xFF00) >> 8);
		this.pushStack(r.PC & 0xFF);
		this.pushStack(r.SRgetByte());
		address = this.readMemoryWord(NMI_VECTOR);
		this.setPC(address);
		interrupted = true;
	}

	/**
	 * push a byte to the stack
	 * @arg unsigned char b
	 */
	this.pushStack = function(b) {
		this.writeMemory(STACK + r.SP,b);
		r.SP--;
		if(r.SP < 0)
			r.SP = 255;
	}

	/**
	 * pop a byte from the stack
	 * @returns unsigned char
	 */
	this.popStack = function() {
		r.SP++;
		if(r.SP > 255)
			r.SP = 0;
		return this.readMemoryByte(0x100 + r.SP);
	}

	this.setPC = function(address) {
		r.PC = address & 0xFFFF;
	}


	/**
	 * do next operation
	 * @return unsigned char number of cycles operation took
	 */
	this.do_op = function() {	


		// save program counter
		r.old_PC = r.PC;

		// save SR;
		SR_before = r.SRgetByte();

		// get opcode at PC
		opcode = this.readMemoryByte(r.PC);

		// point to first data byte
		r.PC += 1;

		// starting point for cycle count for this opcode. might increase
		var cycles = OPCODES[opcode].cycles, // unsigned char 
		o1 = 0, // int 
		o2 = 0, // int 
		page = 0, // unsigned short 
		addressingMode = OPCODES[opcode].mode; // eADDRESSING



		// reset ALU to 0
		alu = 0;
		zpage = 0;
		address = 0;

		// write mode
		write = OPCODES[opcode].rw;

		// load address
		switch (addressingMode) {

		case ADR_NONE:
		case ADR_IMPL:
			address = 0;
			break;
		case ADR_A:
			address = 0;
			break;
		case ADR_IMM:
			address = 0;
			break;

		case ADR_ABS:
			address = this.readMemoryWord(r.PC);
			break;
		case ADR_ABS_X:
			// look for page crossings
			address = this.readMemoryWord(r.PC);
			page = address & 0xFF00;
			// apparently we need to read the address before
			// adding X
			this.readMemoryWord(address);
			address += r.X;
			if((address & 0xFF00) > page)
				cycles++;
			// fetch
			break;
		case ADR_ABS_Y:
			// look for page crossings
			address = this.readMemoryWord(r.PC);
			page = address & 0xFF00;
			// apparently we need to read the address before
			// adding X
			this.readMemoryWord(address);
			address += r.Y;
			if((address & 0xFF00) > page)
				cycles++;
			break;

			// used by jmp, so doesn't set alu, since absolute mode for jmp is address
		case ADR_IND:
			// nmos bug
			// if indirect addressing points to last byte in page
			// then next byte for address is first byte in same page
			// and not first byte from next page
			o1 = this.readMemoryByte(r.PC);
			o2 = this.readMemoryByte(r.PC + 1) << 8;
			address = this.readMemoryByte(o2 + o1);
			//o1 = (o1 + 1) & 0xFF;
			//
			//the c doesn't have this bug
			o1++;
			address += this.readMemoryByte(o2 + o1) << 8;
			break;

		case ADR_AB_IX:
			o1 = this.readMemoryByte(r.PC);
			o2 = this.readMemoryByte(r.PC + 1) << 8;

			o1 += r.X; // add X to the address specified

			address = this.readMemoryByte(o2 + o1);
			o1++;
			address += this.readMemoryByte(o2 + o1) << 8;


			break;

		case ADR_ZPG:
			zpage = this.readMemoryByte(r.PC);
			address = zpage;
			break;
		case ADR_ZPG_X:
			zpage = this.readMemoryByte(r.PC);
			address = (zpage + r.X) & 0xFF;
			// address is zpage + X without carry
			break;
		case ADR_ZPG_Y:
			zpage = this.readMemoryByte(r.PC);
			// address is zpage + Y without carry
			address = (zpage + r.Y) & 0xFF;
			break;
		case ADR_ZPG_I:
			zpage = this.readMemoryByte(r.PC);
			o1 = this.readMemoryByte(zpage);
			o2 = this.readMemoryByte(zpage + 1) << 8;
			address = o1 + o2;
			break;

		case ADR_IND_X:
			zpage = this.readMemoryByte(r.PC);
			// address to look up is ZP + X without carry
			o1 = (zpage + r.X) & 0xFF; // is this right?
			address = this.readMemoryByte(o1);
			address += (this.readMemoryByte((o1 + 1) & 0xFF)) << 8;
			break;
		case ADR_IND_Y:
			zpage = this.readMemoryByte(r.PC);
			// IAH wraps if zpage = 0xFF
			o1 = this.readMemoryByte(zpage) + r.Y;
			o2 = this.readMemoryByte((zpage + 1) & 0xFF) << 8;
			// now add Y, look for page boundries
			if(o1 > 0x0100)
				cycles++;
			address = o2 + o1;
			break;

		case ADR_REL:
			address = r.PC;
			page = address >> 8;
			alu = this.readMemoryByte(r.PC);
			zpage = alu;
			if(alu >= 0x80) {
				// 2's compliment
				alu = -(256 - alu);
			}
			address += (OPCODES[opcode].step + alu) & 0xFFFF;
			// reusing alu as the cycle bump if we branch
			alu = 1;
			if(address >> 8 != page)
				alu = 2;
			break;

		}



		// fetch alu from where we need to fetch it
		if(!write) {
			switch (addressingMode) {

			case ADR_NONE:
			case ADR_IND:
			case ADR_REL:
			case ADR_IMPL:
				break;

			case ADR_A:
				alu = r.A;
				break;

			case ADR_IMM:
				zpage = this.readMemoryByte(r.PC);
				alu = zpage;
				break;

			case ADR_ABS:
			case ADR_ABS_X:
			case ADR_ABS_Y:
			case ADR_ZPG:
			case ADR_ZPG_X:
			case ADR_ZPG_Y:
			case ADR_IND_X:
			case ADR_IND_Y:
				alu = this.readMemoryByte(address);
				break;
			}
		}

		// save alu
		old_alu = alu;

		// move PC now
		r.PC += OPCODES[opcode].step;


		// opcode contemplation
		switch (OPCODES[opcode].op) {
			// illegal opcodes are skipped, even the dangerous ones
		case OP_BAD:
			break;

		case OP_NOP:  // no operation
			break;


			// add and subtract
		case OP_ADC:  // add with carry
			o1 = r.A;
			o2 = alu;
			if(r.SR_DECIMAL) {
				// decimal mode behavior following Marko Makela's explanations
				r.SR_ZERO = ((o1 + o2 + (r.SR_CARRY ? 1 : 0)) & 0xFF) == 0;

				// add low nybs of A and alu with carry
				alu = (o1 & 0x0F) + (o2 & 0x0F) + (r.SR_CARRY ? 1 : 0);

				// if alu > 10 then alu += 6
				r.A = alu < 0x0A ? alu : alu + 6;

				// add high nybs of A, input alu and overflow from low nyb
				alu = (o1 & 0xF0) + (o2 & 0xF0) + (r.A & 0xF0);

				r.SR_NEGATIVE = (alu & 0xFF) < 0;

				r.SR_OVERFLOW = ((o1 & 0x80) == (o2 & 0x80)) && ((o1 & 0x80) != (alu & 0x80));

				// redo alu for output, merge low nyb from r.A
				// and high nyb from alu, overflow if alu > 160 (100)
				alu = (r.A & 0x0F) | (alu < 0xA0 ? alu : alu + 0x60);

				r.SRcarry(alu);

				r.A = alu & 0xFF;

				cycles++;

			} else {
				// A + M + C -> A
				alu = o1 + o2 + (r.SR_CARRY?1:0);  

				// clear flags
				// set them
				r.SRcarry(alu);

				// the test wants this?
				r.SR_OVERFLOW = ((o1 & 0x80) == (o2 & 0x80)) && ((o1 & 0x80) != (alu & 0x80));


				// update A
				r.A = alu & 0xFF;

				r.SRsetNZ(r.A);


			}
			break;
		case OP_SBC:  // subtract with carry
			o1 = r.A;
			o2 = alu;
			if(r.SR_DECIMAL) {

				// decimal mode behavior following Marko Makela's explanations
				alu = (o1 & 0x0F) - (o2 & 0x0F) - (r.SR_CARRY ? 0 : 1);
				r.A = (alu & 0x10) == 0 ? alu : alu - 6;
				alu = (o1 & 0xF0) - (o2 & 0xF0) - (r.A & 0x10);
				r.A = (r.A & 0x0F) | ((alu & 0x100) == 0 ? alu : alu - 0x60);
				alu = o1 - o2 - (r.SR_CARRY ? 0 : 1);

				r.SRsetNZ(r.A);
				r.SRborrow(alu);

				cycles++;

			} else {
				// A + M + C -> A
				alu = o1 - o2 - (r.SR_CARRY?0:1);  

				// store A
				r.A = alu & 0xFF;

				// set carry, set others
				// oddly, this is what's needed here, even tho it's different than ADC's overflow
				r.SR_OVERFLOW = ((o1 ^ o2) & (o1 ^ r.A) & 0x80) != 0;
				r.SRsetNZ(r.A);
				r.SRborrow(alu);

			}
			break;


			// compare memory with...
		case OP_CMP:  // compare with A
			alu = (r.A - alu);
			r.SRborrow(alu);
			r.SRsetNZ(alu);
			break;
		case OP_CPX:  // compare with X
			alu = (r.X - alu);
			r.SRborrow(alu);
			r.SRsetNZ(alu);
			break;
		case OP_CPY:  // compare with Y
			alu = (r.Y - alu);
			r.SRborrow(alu);
			r.SRsetNZ(alu);
			break;

			// logical operators
		case OP_AND:  // and (with accumulator)
			// apply alu to A
			r.A &= alu;
			r.SRsetNZ(r.A);
			break;
		case OP_ORA:  // or with accumulator
			// apply alu to A
			r.A |= alu;
			r.SRsetNZ(r.A);
			break;
		case OP_EOR:  // exclusive or (with accumulator)
			// apply alu to A
			r.A ^= alu;
			r.SRsetNZ(r.A);
			break;


		case OP_ASL:  // arithmetic shift left
			// catch carry
			r.SR_CARRY = (alu & 0x80) != 0;
			// a jump, to the left!
			alu <<= 1;
			r.SRsetNZ(alu);
			write = 1;
			break;
		case OP_LSR:  // logical shift right
			r.SR_CARRY = (alu & 0x01) != 0;
			// and a step, to the right!
			alu >>= 1;
			// set flags
			r.SRsetNZ(alu);
			write = 1;
			break;
		case OP_ROL:  // rotate left
			// rotate left and mix in carry
			o1 = alu & 0x80;
			alu <<= 1;
			if(r.SR_CARRY)
				alu |= 0x01;
			r.SR_CARRY = o1 != 0;
			// set flags
			r.SRsetNZ(alu);
			write = 1;
			break;
		case OP_ROR:  // rotate right
			o1 = alu & 0x01;
			alu >>= 1;
			if(r.SR_CARRY)
				alu |= 0x80;
			// set flags
			r.SR_CARRY = o1 == 0x01;
			r.SRsetNZ(alu);
			write = 1;
			break;


			// Increment, decrement A, X, Y
		case OP_INC:  // increment
			alu = (alu + 1) & 0xFF;
			r.SRsetNZ(alu);
			write = 1;
			break;
		case OP_DEC:  // decrement
			alu = (alu - 1) & 0xFF;
			r.SRsetNZ(alu);
			write = 1;
			break;

		case OP_INX:  // increment X
			r.X = (r.X + 1) & 0xFF;
			r.SRsetNZ(r.X);
			break;
		case OP_INY:  // increment Y
			r.Y = (r.Y + 1) & 0xFF;
			r.SRsetNZ(r.Y);
			break;

		case OP_DEX:  // decrement X
			r.X = (r.X - 1) & 0xFF;
			r.SRsetNZ(r.X);
			break;
		case OP_DEY:  // decrement Y
			r.Y = (r.Y - 1) & 0xFF;
			r.SRsetNZ(r.Y);
			break;

		case OP_BIT:  // bit test
			// does a non-destructive AND vs A and memory
			// sets Z if there's no matches
			// sets N to bit 7
			// sets V to bit 6
			if(addressingMode != ADR_IMM)
				r.SR_OVERFLOW = (alu & SR_OVERFLOW_B); // bit 6
			r.SR_NEGATIVE = (alu & SR_NEGATIVE_B); // bit 7
			r.SR_ZERO = (alu & r.A) == 0;
			break;




			// flag clear and set
		case OP_CLC:  // clear carry
			r.SR_CARRY = false;
			break;
		case OP_SEC:  // set carry
			r.SR_CARRY = true;
			break;
		case OP_CLD:  // clear decimal
			r.SR_DECIMAL = false;
			break;
		case OP_SED:  // set decimal
			r.SR_DECIMAL = true;
			break;
		case OP_CLI:  // clear interrupt disable
			r.SR_INTERRUPT = false;
			interrupts_active = true;
			break;
		case OP_SEI:  // set interrupt disable
			r.SR_INTERRUPT = true;
			interrupts_active = false;
			break;
		case OP_CLV:  // clear overflow
			r.SR_OVERFLOW = false;
			break;


			// branching
			// alu holds bonus cycle count if page is crossed
		case OP_BCS:  // branch on carry set
			if(r.SR_CARRY) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BCC:  // branch on carry clear
			if(!(r.SR_CARRY)) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BEQ:  // branch on equal (zero set)
			if(r.SR_ZERO) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BNE:  // branch on not equal (zero clear)
			if(!(r.SR_ZERO)) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BMI:  // branch on minus (negative set)
			if(r.SR_NEGATIVE) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BPL:  // branch on plus (negative clear)
			if(!(r.SR_NEGATIVE)) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BVS:  // branch on overflow set
			if(r.SR_OVERFLOW) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BVC:  // branch on overflow clear
			if(!(r.SR_OVERFLOW)) {
				this.setPC(address);
				cycles += alu;
			}
			break;
		case OP_BRA:
			this.setPC(address);
			cycles += alu;
			break;



		case OP_JMP:  // jump
			this.setPC(address);
			break;

		case OP_JSR:  // jump subroutine
			// push PC onto stack
			alu = r.PC - 1;
			this.pushStack((alu & 0xFF00) >> 8);
			this.pushStack(alu & 0xFF);
			// update to new address in alu
			this.setPC(address);
			break;
		case OP_RTS:  // return from subroutine
			// address should be -1 from next opcode
			alu = this.popStack() | (this.popStack() << 8);
			alu++;
			alu &= 0xFFFF;
			address = alu;
			this.setPC(address);
			break;

		case OP_BRK:  // interrupt
			r.SR_BREAK = true;
			this.pushStack((r.PC + 1 & 0xFF00) >> 8);
			this.pushStack(r.PC + 1 & 0xFF);
			// probably should have a flag to SRgetByte
			// that tells it we're getting the status to be
			// pushed on the stack
			this.pushStack(r.SRgetByte());
			address = this.readMemoryWord(IRQBRK_VECTOR);
			this.setPC(address);
			r.SR_DECIMAL = false;
			r.SR_INTERRUPT = true;
			interrupted = true;
			break;

		case OP_RTI:  // return from interrupt
			r.SRsetByte(this.popStack());
			alu = this.popStack() | (this.popStack() << 8);
			alu &= 0xFFFF;
			address = alu;
			this.setPC(address);
			break;



		case OP_LDA:  // load accumulator
			r.SRsetNZ(alu);
			r.A = alu & 0xFF;
			break;
		case OP_LDX:  // load X
			r.SRsetNZ(alu);
			r.X = alu & 0xFF;
			break;
		case OP_LDY:  // load Y
			r.SRsetNZ(alu);
			r.Y = alu & 0xFF;
			break;
		case OP_STA:  // store accumulator
			alu = r.A;
			break;
		case OP_STX:  // store X
			alu = r.X;
			break;
		case OP_STY:  // store Y
			alu = r.Y;
			break;
		case OP_STZ:
			alu = 0;
			break;



		case OP_PHA:  // push accumulator
			this.pushStack(r.A);
			break;
		case OP_PLA:  // pull accumulator, uses write
			alu = this.popStack();
			r.SRsetNZ(alu);
			break;

		case OP_PHX:  // push accumulator
			this.pushStack(r.X);
			break;
		case OP_PLX:  // pull accumulator, uses write
			alu = this.popStack();
			r.SRsetNZ(alu);
			r.X = alu & 0xFF;
			break;

		case OP_PHY:  // push accumulator
			this.pushStack(r.Y);
			break;
		case OP_PLY:  // pull accumulator, uses write
			alu = this.popStack();
			r.SRsetNZ(alu);
			r.Y = alu & 0xFF;
			break;

		case OP_PHP:  // push processor status (SR)
			this.pushStack(r.SRgetByte());
			break;
		case OP_PLP:  // pull processor status (SR)
			r.SRsetByte(this.popStack());
			r.SR_BREAK = true;
			break;


		case OP_TSX:  // transfer stack pointer to X
			r.X = r.SP;
			r.SRsetNZ(r.X);
			break;
		case OP_TXS:  // transfer X to stack pointer
			r.SP = r.X;
			break;

		case OP_TAX:  // transfer accumulator to X
			r.X = r.A;
			r.SRsetNZ(r.X);
			break;
		case OP_TAY:  // transfer accumulator to Y
			r.Y = r.A;
			r.SRsetNZ(r.Y);
			break;

		case OP_TXA:  // transfer X to accumulator
			r.A = r.X;
			r.SRsetNZ(r.A);
			break;
		case OP_TYA:  // transfer Y to accumulator
			r.A = r.Y;
			r.SRsetNZ(r.A);
			break;

		case OP_TRB: // test and reset bits
			r.SR_ZERO = (alu & r.A) == 0;
			alu &= ~r.A;
			write = 1;
			break;
		case OP_TSB: // test and set bits
			r.SR_ZERO = (alu & r.A) == 0;
			alu |= r.A;
			write = 1;
			break;
		}
		// phew

		// store alu using addressing mode
		if( write ) {
			switch (addressingMode) {
			case ADR_NONE:
				// wah?
			case ADR_IMM:
				// right away, sir!
			case ADR_IMPL:
				// implied, so we've done something already
			case ADR_IND:
				// only used by jsr
			case ADR_REL:
				// used by branches
				break;

			case ADR_A:
				// pushed into A
				r.A = alu & 0xFF;
				break;

				// write to somewhere in memory
			case ADR_ABS:
			case ADR_ABS_X:
			case ADR_ABS_Y:
			case ADR_AB_IX:
			case ADR_ZPG:
			case ADR_ZPG_X:
			case ADR_ZPG_Y:
			case ADR_ZPG_I:
			case ADR_IND_X:
			case ADR_IND_Y:
				this.writeMemory(address,alu & 0xFF);
				break;


			}
		}

		// all done

		return cycles;
	}




	// opcode attributes
	function new__OPCODES(_op, _mode, _step, _cycles, _rw) {
		return {
			op : _op, //eOPCODES  the op enum
			mode : _mode, //eADDRESSING  addressing mode
			step : _step, //unsigned char  PC steps
			cycles : _cycles, //unsigned char  minimum cycles
			rw : _rw //unsigned char  write mode
		};
	}

	// opcode attribute table

	var OPCODES = []; 
	OPCODES[0x00] = new__OPCODES(OP_BRK,  ADR_IMPL,  0, 7, 0);
	OPCODES[0x01] = new__OPCODES(OP_ORA,  ADR_IND_X, 1, 6, 0);
	OPCODES[0x02] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x03] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x04] = new__OPCODES(OP_TSB,  ADR_ZPG,   1, 5, 0);
	OPCODES[0x05] = new__OPCODES(OP_ORA,  ADR_ZPG,   1, 3, 0);
	OPCODES[0x06] = new__OPCODES(OP_ASL,  ADR_ZPG,   1, 5, 0);
	OPCODES[0x07] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x08] = new__OPCODES(OP_PHP,  ADR_IMPL,  0, 3, 0);
	OPCODES[0x09] = new__OPCODES(OP_ORA,  ADR_IMM,   1, 2, 0);
	OPCODES[0x0A] = new__OPCODES(OP_ASL,  ADR_A,     0, 2, 0);
	OPCODES[0x0B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x0C] = new__OPCODES(OP_TSB,  ADR_ABS,   2, 6, 0);
	OPCODES[0x0D] = new__OPCODES(OP_ORA,  ADR_ABS,   2, 4, 0);
	OPCODES[0x0E] = new__OPCODES(OP_ASL,  ADR_ABS,   2, 6, 0);
	OPCODES[0x0F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x10] = new__OPCODES(OP_BPL,  ADR_REL,   1, 2, 0);
	OPCODES[0x11] = new__OPCODES(OP_ORA,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0x12] = new__OPCODES(OP_ORA,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0x13] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x14] = new__OPCODES(OP_TRB,  ADR_ZPG,   1, 5, 0);
	OPCODES[0x15] = new__OPCODES(OP_ORA,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0x16] = new__OPCODES(OP_ASL,  ADR_ZPG_X, 1, 6, 0);
	OPCODES[0x17] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x18] = new__OPCODES(OP_CLC,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x19] = new__OPCODES(OP_ORA,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0x1A] = new__OPCODES(OP_DEC,  ADR_A,     0, 2, 0);
	OPCODES[0x1B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x1C] = new__OPCODES(OP_TRB,  ADR_ABS,   2, 6, 0);
	OPCODES[0x1D] = new__OPCODES(OP_ORA,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0x1E] = new__OPCODES(OP_ASL,  ADR_ABS_X, 2, 6, 0);
	OPCODES[0x1F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x20] = new__OPCODES(OP_JSR,  ADR_ABS,   2, 6, 0);
	OPCODES[0x21] = new__OPCODES(OP_AND,  ADR_IND_X, 1, 6, 0);
	OPCODES[0x22] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x23] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x24] = new__OPCODES(OP_BIT,  ADR_ZPG,   1, 3, 0);
	OPCODES[0x25] = new__OPCODES(OP_AND,  ADR_ZPG,   1, 3, 0);
	OPCODES[0x26] = new__OPCODES(OP_ROL,  ADR_ZPG,   1, 5, 0);
	OPCODES[0x27] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x28] = new__OPCODES(OP_PLP,  ADR_IMPL,  0, 4, 0);
	OPCODES[0x29] = new__OPCODES(OP_AND,  ADR_IMM,   1, 2, 0);
	OPCODES[0x2A] = new__OPCODES(OP_ROL,  ADR_A,     0, 2, 0);
	OPCODES[0x2B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x2C] = new__OPCODES(OP_BIT,  ADR_ABS,   2, 4, 0);
	OPCODES[0x2D] = new__OPCODES(OP_AND,  ADR_ABS,   2, 4, 0);
	OPCODES[0x2E] = new__OPCODES(OP_ROL,  ADR_ABS,   2, 6, 0);
	OPCODES[0x2F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x30] = new__OPCODES(OP_BMI,  ADR_REL,   1, 2, 0);
	OPCODES[0x31] = new__OPCODES(OP_AND,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0x32] = new__OPCODES(OP_AND,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0x33] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x34] = new__OPCODES(OP_BIT,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0x35] = new__OPCODES(OP_AND,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0x36] = new__OPCODES(OP_ROL,  ADR_ZPG_X, 1, 6, 0);
	OPCODES[0x37] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x38] = new__OPCODES(OP_SEC,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x39] = new__OPCODES(OP_AND,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0x3A] = new__OPCODES(OP_INC,  ADR_A,     0, 2, 0);
	OPCODES[0x3B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x3C] = new__OPCODES(OP_BIT,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0x3D] = new__OPCODES(OP_AND,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0x3E] = new__OPCODES(OP_ROL,  ADR_ABS_X, 2, 6, 0);
	OPCODES[0x3F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x40] = new__OPCODES(OP_RTI,  ADR_IMPL,  0, 6, 0);
	OPCODES[0x41] = new__OPCODES(OP_EOR,  ADR_IND_X, 1, 6, 0);
	OPCODES[0x42] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x43] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x44] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x45] = new__OPCODES(OP_EOR,  ADR_ZPG,   1, 3, 0);
	OPCODES[0x46] = new__OPCODES(OP_LSR,  ADR_ZPG,   1, 5, 0);
	OPCODES[0x47] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x48] = new__OPCODES(OP_PHA,  ADR_IMPL,  0, 3, 0);
	OPCODES[0x49] = new__OPCODES(OP_EOR,  ADR_IMM,   1, 2, 0);
	OPCODES[0x4A] = new__OPCODES(OP_LSR,  ADR_A,     0, 2, 0);
	OPCODES[0x4B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x4C] = new__OPCODES(OP_JMP,  ADR_ABS,   2, 3, 0);
	OPCODES[0x4D] = new__OPCODES(OP_EOR,  ADR_ABS,   2, 4, 0);
	OPCODES[0x4E] = new__OPCODES(OP_LSR,  ADR_ABS,   2, 6, 0);
	OPCODES[0x4F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x50] = new__OPCODES(OP_BVC,  ADR_REL,   1, 2, 0);
	OPCODES[0x51] = new__OPCODES(OP_EOR,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0x52] = new__OPCODES(OP_EOR,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0x53] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x54] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x55] = new__OPCODES(OP_EOR,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0x56] = new__OPCODES(OP_LSR,  ADR_ZPG_X, 1, 6, 0);
	OPCODES[0x57] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x58] = new__OPCODES(OP_CLI,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x59] = new__OPCODES(OP_EOR,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0x5A] = new__OPCODES(OP_PHY,  ADR_IMPL,  0, 3, 0);
	OPCODES[0x5B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x5C] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x5D] = new__OPCODES(OP_EOR,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0x5E] = new__OPCODES(OP_LSR,  ADR_ABS_X, 2, 6, 0);
	OPCODES[0x5F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x60] = new__OPCODES(OP_RTS,  ADR_IMPL,  0, 6, 0);
	OPCODES[0x61] = new__OPCODES(OP_ADC,  ADR_IND_X, 1, 6, 0);
	OPCODES[0x62] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x63] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x64] = new__OPCODES(OP_STZ,  ADR_ZPG,   1, 3, 0);
	OPCODES[0x65] = new__OPCODES(OP_ADC,  ADR_ZPG,   1, 3, 0);
	OPCODES[0x66] = new__OPCODES(OP_ROR,  ADR_ZPG,   1, 5, 0);
	OPCODES[0x67] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x68] = new__OPCODES(OP_PLA,  ADR_A,     0, 4, 1);
	OPCODES[0x69] = new__OPCODES(OP_ADC,  ADR_IMM,   1, 2, 0);
	OPCODES[0x6A] = new__OPCODES(OP_ROR,  ADR_A,     0, 2, 0);
	OPCODES[0x6B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x6C] = new__OPCODES(OP_JMP,  ADR_IND,   2, 5, 0);
	OPCODES[0x6D] = new__OPCODES(OP_ADC,  ADR_ABS,   2, 4, 0);
	OPCODES[0x6E] = new__OPCODES(OP_ROR,  ADR_ABS,   2, 6, 0);
	OPCODES[0x6F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x70] = new__OPCODES(OP_BVS,  ADR_REL,   1, 2, 0);
	OPCODES[0x71] = new__OPCODES(OP_ADC,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0x72] = new__OPCODES(OP_ADC,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0x73] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x74] = new__OPCODES(OP_STZ,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0x75] = new__OPCODES(OP_ADC,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0x76] = new__OPCODES(OP_ROR,  ADR_ZPG_X, 1, 6, 0);
	OPCODES[0x77] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x78] = new__OPCODES(OP_SEI,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x79] = new__OPCODES(OP_ADC,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0x7A] = new__OPCODES(OP_PLY,  ADR_IMPL,  0, 4, 0);
	OPCODES[0x7B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x7C] = new__OPCODES(OP_JMP,  ADR_AB_IX, 2, 6, 0);
	OPCODES[0x7D] = new__OPCODES(OP_ADC,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0x7E] = new__OPCODES(OP_ROR,  ADR_ABS_X, 2, 6, 0);
	OPCODES[0x7F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x80] = new__OPCODES(OP_BRA,  ADR_REL,   1, 3, 0);
	OPCODES[0x81] = new__OPCODES(OP_STA,  ADR_IND_X, 1, 6, 1);
	OPCODES[0x82] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x83] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x84] = new__OPCODES(OP_STY,  ADR_ZPG,   1, 3, 1);
	OPCODES[0x85] = new__OPCODES(OP_STA,  ADR_ZPG,   1, 3, 1);
	OPCODES[0x86] = new__OPCODES(OP_STX,  ADR_ZPG,   1, 3, 1);
	OPCODES[0x87] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x88] = new__OPCODES(OP_DEY,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x89] = new__OPCODES(OP_BIT,  ADR_IMM,   1, 2, 0);
	OPCODES[0x8A] = new__OPCODES(OP_TXA,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x8B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x8C] = new__OPCODES(OP_STY,  ADR_ABS,   2, 4, 1);
	OPCODES[0x8D] = new__OPCODES(OP_STA,  ADR_ABS,   2, 4, 1);
	OPCODES[0x8E] = new__OPCODES(OP_STX,  ADR_ABS,   2, 4, 1);
	OPCODES[0x8F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x90] = new__OPCODES(OP_BCC,  ADR_REL,   1, 2, 0);
	OPCODES[0x91] = new__OPCODES(OP_STA,  ADR_IND_Y, 1, 6, 1);
	OPCODES[0x92] = new__OPCODES(OP_STA,  ADR_ZPG_I, 1, 5, 1);
	OPCODES[0x93] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x94] = new__OPCODES(OP_STY,  ADR_ZPG_X, 1, 4, 1);
	OPCODES[0x95] = new__OPCODES(OP_STA,  ADR_ZPG_X, 1, 4, 1);
	OPCODES[0x96] = new__OPCODES(OP_STX,  ADR_ZPG_Y, 1, 4, 1);
	OPCODES[0x97] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x98] = new__OPCODES(OP_TYA,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x99] = new__OPCODES(OP_STA,  ADR_ABS_Y, 2, 5, 1);
	OPCODES[0x9A] = new__OPCODES(OP_TXS,  ADR_IMPL,  0, 2, 0);
	OPCODES[0x9B] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0x9C] = new__OPCODES(OP_STZ,  ADR_ABS,   2, 4, 0);
	OPCODES[0x9D] = new__OPCODES(OP_STA,  ADR_ABS_X, 2, 5, 1);
	OPCODES[0x9E] = new__OPCODES(OP_STZ,  ADR_ABS_X, 2, 5, 0);
	OPCODES[0x9F] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xA0] = new__OPCODES(OP_LDY,  ADR_IMM,   1, 2, 0);
	OPCODES[0xA1] = new__OPCODES(OP_LDA,  ADR_IND_X, 1, 6, 0);
	OPCODES[0xA2] = new__OPCODES(OP_LDX,  ADR_IMM,   1, 2, 0);
	OPCODES[0xA3] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xA4] = new__OPCODES(OP_LDY,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xA5] = new__OPCODES(OP_LDA,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xA6] = new__OPCODES(OP_LDX,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xA7] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xA8] = new__OPCODES(OP_TAY,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xA9] = new__OPCODES(OP_LDA,  ADR_IMM,   1, 2, 0);
	OPCODES[0xAA] = new__OPCODES(OP_TAX,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xAB] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xAC] = new__OPCODES(OP_LDY,  ADR_ABS,   2, 4, 0);
	OPCODES[0xAD] = new__OPCODES(OP_LDA,  ADR_ABS,   2, 4, 0);
	OPCODES[0xAE] = new__OPCODES(OP_LDX,  ADR_ABS,   2, 4, 0);
	OPCODES[0xAF] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xB0] = new__OPCODES(OP_BCS,  ADR_REL,   1, 2, 0);
	OPCODES[0xB1] = new__OPCODES(OP_LDA,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0xB2] = new__OPCODES(OP_LDA,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0xB3] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xB4] = new__OPCODES(OP_LDY,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0xB5] = new__OPCODES(OP_LDA,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0xB6] = new__OPCODES(OP_LDX,  ADR_ZPG_Y, 1, 4, 0);
	OPCODES[0xB7] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xB8] = new__OPCODES(OP_CLV,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xB9] = new__OPCODES(OP_LDA,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0xBA] = new__OPCODES(OP_TSX,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xBB] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xBC] = new__OPCODES(OP_LDY,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0xBD] = new__OPCODES(OP_LDA,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0xBE] = new__OPCODES(OP_LDX,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0xBF] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xC0] = new__OPCODES(OP_CPY,  ADR_IMM,   1, 2, 0);
	OPCODES[0xC1] = new__OPCODES(OP_CMP,  ADR_IND_X, 1, 6, 0);
	OPCODES[0xC2] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xC3] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xC4] = new__OPCODES(OP_CPY,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xC5] = new__OPCODES(OP_CMP,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xC6] = new__OPCODES(OP_DEC,  ADR_ZPG,   1, 5, 0);
	OPCODES[0xC7] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xC8] = new__OPCODES(OP_INY,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xC9] = new__OPCODES(OP_CMP,  ADR_IMM,   1, 2, 0);
	OPCODES[0xCA] = new__OPCODES(OP_DEX,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xCB] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xCC] = new__OPCODES(OP_CPY,  ADR_ABS,   2, 4, 0);
	OPCODES[0xCD] = new__OPCODES(OP_CMP,  ADR_ABS,   2, 4, 0);
	OPCODES[0xCE] = new__OPCODES(OP_DEC,  ADR_ABS,   2, 3, 0);
	OPCODES[0xCF] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xD0] = new__OPCODES(OP_BNE,  ADR_REL,   1, 2, 0);
	OPCODES[0xD1] = new__OPCODES(OP_CMP,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0xD2] = new__OPCODES(OP_CMP,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0xD3] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xD4] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xD5] = new__OPCODES(OP_CMP,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0xD6] = new__OPCODES(OP_DEC,  ADR_ZPG_X, 1, 6, 0);
	OPCODES[0xD7] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xD8] = new__OPCODES(OP_CLD,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xD9] = new__OPCODES(OP_CMP,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0xDA] = new__OPCODES(OP_PHX,  ADR_IMPL,  0, 3, 0);
	OPCODES[0xDB] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xDC] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xDD] = new__OPCODES(OP_CMP,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0xDE] = new__OPCODES(OP_DEC,  ADR_ABS_X, 2, 7, 0);
	OPCODES[0xDF] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xE0] = new__OPCODES(OP_CPX,  ADR_IMM,   1, 2, 0);
	OPCODES[0xE1] = new__OPCODES(OP_SBC,  ADR_IND_X, 1, 6, 0);
	OPCODES[0xE2] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xE3] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xE4] = new__OPCODES(OP_CPX,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xE5] = new__OPCODES(OP_SBC,  ADR_ZPG,   1, 3, 0);
	OPCODES[0xE6] = new__OPCODES(OP_INC,  ADR_ZPG,   1, 5, 0);
	OPCODES[0xE7] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xE8] = new__OPCODES(OP_INX,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xE9] = new__OPCODES(OP_SBC,  ADR_IMM,   1, 2, 0);
	OPCODES[0xEA] = new__OPCODES(OP_NOP,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xEB] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xEC] = new__OPCODES(OP_CPX,  ADR_ABS,   2, 4, 0);
	OPCODES[0xED] = new__OPCODES(OP_SBC,  ADR_ABS,   2, 4, 0);
	OPCODES[0xEE] = new__OPCODES(OP_INC,  ADR_ABS,   2, 6, 0);
	OPCODES[0xEF] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xF0] = new__OPCODES(OP_BEQ,  ADR_REL,   1, 2, 0);
	OPCODES[0xF1] = new__OPCODES(OP_SBC,  ADR_IND_Y, 1, 5, 0);
	OPCODES[0xF2] = new__OPCODES(OP_SBC,  ADR_ZPG_I, 1, 5, 0);
	OPCODES[0xF3] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xF4] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xF5] = new__OPCODES(OP_SBC,  ADR_ZPG_X, 1, 4, 0);
	OPCODES[0xF6] = new__OPCODES(OP_INC,  ADR_ZPG_X, 1, 6, 0);
	OPCODES[0xF7] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xF8] = new__OPCODES(OP_SED,  ADR_IMPL,  0, 2, 0);
	OPCODES[0xF9] = new__OPCODES(OP_SBC,  ADR_ABS_Y, 2, 4, 0);
	OPCODES[0xFA] = new__OPCODES(OP_PLX,  ADR_IMPL,  0, 4, 0);
	OPCODES[0xFB] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xFC] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);
	OPCODES[0xFD] = new__OPCODES(OP_SBC,  ADR_ABS_X, 2, 4, 0);
	OPCODES[0xFE] = new__OPCODES(OP_INC,  ADR_ABS_X, 2, 7, 0);
	OPCODES[0xFF] = new__OPCODES(OP_BAD,  ADR_NONE,  0, 0, 0);




	/**
	 * romIntercept
	 * used to turn a section of memory into "ROM"
	 */
	this.romIntercept = this.newMemoryIntercept(
		function(address,cpu) { // read
			return cpu.memory[address];
		},
		function(value, address) { // write
			// I've handled the write
			return true;
		}
	);

	var CPUstateDumper = function() {
		// opcode name
		var nmem = [
			"BAD",
			"ADC",
			"AND",
			"ASL",
			"BCC", "BCS", "BEQ",
			"BIT",
			"BMI", "BNE", "BPL", "BRA", "BRK", "BVC", "BVS",
			"CLC", "CLD", "CLI", "CLV",
			"CMP", "CPX", "CPY",
			"DEC", "DEX", "DEY",
			"EOR",
			"INC", "INX", "INY",
			"JMP", "JSR",
			"LDA", "LDX", "LDY",
			"LSR",
			"NOP",
			"ORA",
			"PHA", "PHP", "PLA", "PLP",
			"PHX", "PHY", "PLX", "PLY",
			"ROL", "ROR",
			"RTI", "RTS",
			"SBC", "SEC", "SED", "SEI",
			"STA", "STX", "STY", "STZ",
			"TAX", "TAY", "TSX", "TXA", "TXS", "TYA", "TRB", "TSB"
		];


		// addressing mode strings
		var sMODES = [
			"NONE ", // ADR_NONE   
			"IMPL ", // ADR_IMPL   
			"IMM  ", // ADR_IMM    
			"ABS  ", // ADR_ABS    
			"ABS,X", // ADR_ABS_X  
			"ABS,Y", // ADR_ABS_Y  
			"IND  ", // ADR_IND    
			"AB_IX", // ADR_AB_IX  
			"X,IND", // ADR_IND_X  
			"IND,Y", // ADR_IND_Y  
			"ZPG  ", // ADR_ZPG    
			"ZPG,X", // ADR_ZPG_X  
			"ZPG,Y", // ADR_ZPG_Y  
			"ZPG,I", // ADR_ZPG_I  
			"A    ", // ADR_A      
			"REL  "  // ADR_REL    
		];

		/**
		 * dumpCpuState
		 * printf the cpu state
		 */
		this.cpuState = function() {
			var s = '';

			s += r.old_PC.toString(16) + ': ';
			s += r.A.toString(16) + ' ';
			s += r.X.toString(16) + ' ';
			s += r.Y.toString(16) + ' ';
			s += r.SP.toString(16) + ' ';
			s += (old_alu & 0xFFFF).toString(16) + ' ' ;
			s += (alu & 0xFFFF).toString(16) + ' ' ;
			s += (address & 0xFFFF).toString(16) + ' (';
			s += r.SRgetByte().toString(16) + ')';
			s += (r.SR_NEGATIVE)?'N':' ';
			s += (r.SR_OVERFLOW)?'O':' ';
			s += (r.SR_BREAK)?'B':' ';
			s += (r.SR_DECIMAL)?'D':' ';
			s += (r.SR_INTERRUPT)?'I':' ';
			s += (r.SR_ZERO)?'Z':' ';
			s += (r.SR_CARRY)?'C':' ';

			switch(OPCODES[opcode].step) {
			case 0:
				s += opcode.toString(16) + '       ';
				break;
			case 1:
				s += opcode.toString(16) + ' ' + zpage.toString(16) + '    ';
				break;
			case 2:
				s += opcode.toString(16) + ' ' ;
				s += (address & 0xFF).toString(16) + ' ';
				s += ((address & 0xFF00) >> 8).toString(16) + ' ';
				break;
			}

			s += nmem[OPCODES[opcode].op] + ' ' + sMODES[OPCODES[opcode].mode] + '\r\n';

			return s;
		}

		/**
		* printCpuStateHeader
		* printf the column names for dumpCpuState
		*/
		this.cpuStateHeader = function() {
			return "PC     A  X  Y SP  mem  alu addr flags        + OP data OPR MODE";
		}

	}

	this.dumper = new CPUstateDumper();

}



