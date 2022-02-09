
	const nmem = [
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
	const sMODES = [
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

class StateReporter {
	// opcode name

	/**
	 * dumpCpuState
	 * printf the cpu state
	 */
	cpuState(cpu: SixtyFiveCeeOhTwo) {
		let s = '';

		s += cpu.r.old_PC.toString(16) + ': ';
		s += cpu.r.A.toString(16) + ' ';
		s += cpu.r.X.toString(16) + ' ';
		s += cpu.r.Y.toString(16) + ' ';
		s += cpu.r.SP.toString(16) + ' ';
		s += (cpu.old_alu & 0xFFFF).toString(16) + ' ';
		s += (cpu.alu & 0xFFFF).toString(16) + ' ';
		s += (cpu.address & 0xFFFF).toString(16) + ' (';
		s += cpu.r.SRgetByte().toString(16) + ')';
		s += (cpu.r.SR_NEGATIVE) ? 'N' : ' ';
		s += (cpu.r.SR_OVERFLOW) ? 'O' : ' ';
		s += (cpu.r.SR_BREAK) ? 'B' : ' ';
		s += (cpu.r.SR_DECIMAL) ? 'D' : ' ';
		s += (cpu.r.SR_INTERRUPT) ? 'I' : ' ';
		s += (cpu.r.SR_ZERO) ? 'Z' : ' ';
		s += (cpu.r.SR_CARRY) ? 'C' : ' ';

		switch (OPCODES[cpu.opcode].step) {
			case 0:
				s += cpu.opcode.toString(16) + '       ';
				break;
			case 1:
				s += cpu.opcode.toString(16) + ' ' + cpu.zpage.toString(16) + '    ';
				break;
			case 2:
				s += cpu.opcode.toString(16) + ' ';
				s += (cpu.address & 0xFF).toString(16) + ' ';
				s += ((cpu.address & 0xFF00) >> 8).toString(16) + ' ';
				break;
		}

		s += nmem[OPCODES[cpu.opcode].op] + ' ' + sMODES[OPCODES[cpu.opcode].mode] + '\r\n';

		return s;
	}

	/**
	* printCpuStateHeader
	* printf the column names for dumpCpuState
	*/
	cpuStateHeader() {
		return "PC     A  X  Y SP  mem  alu addr flags        + OP data OPR MODE";
	}

}